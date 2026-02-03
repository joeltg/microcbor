import { getFloat16 } from "fp16"

import type { CBORValue } from "./types.js"

import { UnsafeIntegerError, maxSafeInteger, minSafeInteger } from "./utils.js"
import { DecodeOptions, FloatSize } from "./options.js"

export interface AsyncDecodeOptions extends DecodeOptions {
	onFree?: (chunk: Uint8Array) => void
}

export class Decoder<T extends CBORValue = CBORValue> implements AsyncIterableIterator<T> {
	public readonly allowUndefined: boolean
	public readonly minFloatSize: (typeof FloatSize)[keyof typeof FloatSize]

	private offset = 0
	private byteLength = 0
	private readonly chunks: Uint8Array[] = []
	private readonly constantBuffer = new ArrayBuffer(8)
	private readonly constantView = new DataView(this.constantBuffer)
	private readonly iter: AsyncIterator<Uint8Array, void, undefined>
	private readonly onFree?: (chunk: Uint8Array) => void
	private readonly touchedChunks = new WeakSet<Uint8Array>()
	private readonly freedChunks = new WeakSet<Uint8Array>()

	public constructor(source: AsyncIterable<Uint8Array>, options: AsyncDecodeOptions = {}) {
		this.onFree = options.onFree
		this.allowUndefined = options.allowUndefined ?? true
		this.minFloatSize = options.minFloatSize ?? 16
		this.iter = source[Symbol.asyncIterator]()
	}

	[Symbol.asyncIterator] = () => this

	private async allocate(size: number) {
		// If we need more data, first call onFree for all touched chunks
		// This allows the transform stream to provide more chunks
		if (this.byteLength < size && this.onFree !== undefined) {
			for (const chunk of this.chunks) {
				if (this.touchedChunks.has(chunk) && !this.freedChunks.has(chunk)) {
					this.freedChunks.add(chunk)
					this.onFree(chunk)
				}
			}
		}

		while (this.byteLength < size) {
			const { done, value } = await this.iter.next()
			if (done) {
				throw new Error("stream ended prematurely")
			} else {
				this.chunks.push(value)
				this.byteLength += value.byteLength

				// If we still need more data after adding this chunk,
				// immediately call onFree to allow the next chunk to flow
				if (this.byteLength < size && this.onFree !== undefined && !this.freedChunks.has(value)) {
					this.freedChunks.add(value)
					this.onFree(value)
				}
			}
		}
	}

	private fill(target: Uint8Array) {
		if (this.byteLength < target.byteLength) {
			throw new Error("internal error - please file a bug report!")
		}

		let byteLength = 0
		let deleteCount = 0
		for (let i = 0; byteLength < target.byteLength; i++) {
			const chunk = this.chunks[i]

			// Track which chunks we touched
			if (!this.touchedChunks.has(chunk)) {
				this.touchedChunks.add(chunk)
			}

			const capacity = target.byteLength - byteLength
			const length = chunk.byteLength - this.offset
			if (length <= capacity) {
				// copy the entire remainder of the chunk
				target.set(chunk.subarray(this.offset), byteLength)
				byteLength += length
				deleteCount += 1
				this.offset = 0
				this.byteLength -= length
			} else {
				// fill the remainder of the target
				target.set(chunk.subarray(this.offset, this.offset + capacity), byteLength)

				byteLength += capacity // equivalent to break
				this.offset += capacity
				this.byteLength -= capacity
			}
		}

		// Call onFree for chunks that are being removed (fully consumed)
		if (this.onFree !== undefined) {
			for (let i = 0; i < deleteCount; i++) {
				const chunk = this.chunks[i]
				if (!this.freedChunks.has(chunk)) {
					this.freedChunks.add(chunk)
					this.onFree(chunk)
				}
			}
		}

		this.chunks.splice(0, deleteCount)
	}

	private constant = <T>(size: number, f: (view: DataView) => T) => {
		return async () => {
			await this.allocate(size)
			const array = new Uint8Array(this.constantBuffer, 0, size)
			this.fill(array)
			return f(this.constantView)
		}
	}

	private float16 = this.constant(2, (view) => getFloat16(view, 0))
	private float32 = this.constant(4, (view) => view.getFloat32(0))
	private float64 = this.constant(8, (view) => view.getFloat64(0))
	private uint8 = this.constant(1, (view) => view.getUint8(0))
	private uint16 = this.constant(2, (view) => view.getUint16(0))
	private uint32 = this.constant(4, (view) => view.getUint32(0))
	private uint64 = this.constant(8, (view) => view.getBigUint64(0))

	private async decodeBytes(length: number): Promise<Uint8Array> {
		await this.allocate(length)
		const array = new Uint8Array(length)
		this.fill(array)
		return array
	}

	private async decodeString(length: number): Promise<string> {
		await this.allocate(length)
		const data = new Uint8Array(length)
		this.fill(data)
		return new TextDecoder().decode(data)
	}

	private async getArgument(additionalInformation: number): Promise<{
		value: number
		uint64?: bigint
	}> {
		if (additionalInformation < 24) {
			return { value: additionalInformation }
		} else if (additionalInformation === 24) {
			return { value: await this.uint8() }
		} else if (additionalInformation === 25) {
			return { value: await this.uint16() }
		} else if (additionalInformation === 26) {
			return { value: await this.uint32() }
		} else if (additionalInformation === 27) {
			const uint64 = await this.uint64()
			const value = maxSafeInteger < uint64 ? Infinity : Number(uint64)
			return { value, uint64 }
		} else if (additionalInformation === 31) {
			throw new Error("microcbor does not support decoding indefinite-length items")
		} else {
			throw new Error("invalid argument encoding")
		}
	}

	public async next(): Promise<{ done: true; value: undefined } | { done: false; value: T }> {
		while (this.byteLength === 0) {
			const { done, value } = await this.iter.next()
			if (done) {
				return { done: true, value: undefined }
			} else if (value.byteLength > 0) {
				this.chunks.push(value)
				this.byteLength += value.byteLength
			}
		}

		const value = await this.decodeValue()
		return { done: false, value: value as T }
	}

	private async decodeValue(): Promise<CBORValue> {
		const initialByte = await this.uint8()
		const majorType = initialByte >> 5
		const additionalInformation = initialByte & 0x1f

		if (majorType === 0) {
			const { value, uint64 } = await this.getArgument(additionalInformation)
			if (uint64 !== undefined && maxSafeInteger < uint64) {
				throw new UnsafeIntegerError("cannot decode integers greater than 2^53-1", uint64)
			} else {
				return value
			}
		} else if (majorType === 1) {
			const { value, uint64 } = await this.getArgument(additionalInformation)
			if (uint64 !== undefined && -1n - uint64 < minSafeInteger) {
				throw new UnsafeIntegerError("cannot decode integers less than -2^53+1", -1n - uint64)
			} else {
				return -1 - value
			}
		} else if (majorType === 2) {
			const { value: length } = await this.getArgument(additionalInformation)
			return await this.decodeBytes(length)
		} else if (majorType === 3) {
			const { value: length } = await this.getArgument(additionalInformation)
			return await this.decodeString(length)
		} else if (majorType === 4) {
			const { value: length } = await this.getArgument(additionalInformation)
			const value = new Array(length)
			for (let i = 0; i < length; i++) {
				value[i] = await this.decodeValue()
			}
			return value
		} else if (majorType === 5) {
			const { value: length } = await this.getArgument(additionalInformation)
			const value: Record<string, any> = {}
			for (let i = 0; i < length; i++) {
				const key = await this.decodeValue()
				if (typeof key !== "string") {
					throw new Error("microcbor only supports string keys in objects")
				}
				value[key] = await this.decodeValue()
			}
			return value
		} else if (majorType === 6) {
			throw new Error("microcbor does not support tagged data items")
		} else if (majorType === 7) {
			switch (additionalInformation) {
				case 20:
					return false
				case 21:
					return true
				case 22:
					return null
				case 23:
					if (this.allowUndefined) {
						return undefined
					} else {
						throw new TypeError("`undefined` not allowed")
					}
				case 24:
					throw new Error("microcbor does not support decoding unassigned simple values")
				case 25:
					if (this.minFloatSize <= 16) {
						return this.float16()
					} else {
						throw new Error("cannot decode float16 type - below provided minFloatSize")
					}
				case 26:
					if (this.minFloatSize <= 32) {
						return this.float32()
					} else {
						throw new Error("cannot decode float32 type - below provided minFloatSize")
					}
				case 27:
					return await this.float64()
				case 31:
					throw new Error("microcbor does not support decoding indefinite-length items")
				default:
					throw new Error("invalid simple value")
			}
		} else {
			throw new Error("invalid major type")
		}
	}
}

/** Decode an async iterable of Uint8Array chunks into an async iterable of CBOR values */
export async function* decodeAsyncIterable(
	source: AsyncIterable<Uint8Array>,
	options: AsyncDecodeOptions = {},
): AsyncIterableIterator<CBORValue> {
	yield* new Decoder(source, options)
}
