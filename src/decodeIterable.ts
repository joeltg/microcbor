import { getFloat16 } from "fp16"

import type { CBORValue } from "./types.js"

import { UnsafeIntegerError, maxSafeInteger, minSafeInteger } from "./utils.js"

class Decoder implements IterableIterator<CBORValue> {
	private offset = 0
	private byteLength = 0
	private readonly chunks: Uint8Array[] = []
	private readonly constantBuffer = new ArrayBuffer(8)
	private readonly constantView = new DataView(this.constantBuffer)
	private readonly iter: Iterator<Uint8Array, void, undefined>
	constructor(source: Iterable<Uint8Array>) {
		this.iter = source[Symbol.iterator]()
	}

	[Symbol.iterator] = () => this

	private allocate(size: number) {
		while (this.byteLength < size) {
			const { done, value } = this.iter.next()
			if (done) {
				throw new Error("stream ended prematurely")
			} else {
				this.chunks.push(value)
				this.byteLength += value.byteLength
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

		this.chunks.splice(0, deleteCount)
	}

	private constant = <T>(size: number, f: (view: DataView) => T) => {
		return () => {
			this.allocate(size)
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

	private decodeBytes(length: number): Uint8Array {
		this.allocate(length)
		const array = new Uint8Array(length)
		this.fill(array)
		return array
	}

	private decodeString(length: number): string {
		this.allocate(length)
		const data = new Uint8Array(length)
		this.fill(data)
		return new TextDecoder().decode(data)
	}

	private getArgument(additionalInformation: number): { value: number; uint64?: bigint } {
		if (additionalInformation < 24) {
			return { value: additionalInformation }
		} else if (additionalInformation === 24) {
			return { value: this.uint8() }
		} else if (additionalInformation === 25) {
			return { value: this.uint16() }
		} else if (additionalInformation === 26) {
			return { value: this.uint32() }
		} else if (additionalInformation === 27) {
			const uint64 = this.uint64()
			const value = maxSafeInteger < uint64 ? Infinity : Number(uint64)
			return { value, uint64 }
		} else if (additionalInformation === 31) {
			throw new Error("microcbor does not support decoding indefinite-length items")
		} else {
			throw new Error("invalid argument encoding")
		}
	}

	public next(): { done: true; value: undefined } | { done: false; value: CBORValue } {
		while (this.byteLength === 0) {
			const { done, value } = this.iter.next()
			if (done) {
				return { done: true, value: undefined }
			} else if (value.byteLength > 0) {
				this.chunks.push(value)
				this.byteLength += value.byteLength
			}
		}

		const value = this.decodeValue()
		return { done: false, value }
	}

	private decodeValue(): CBORValue {
		const initialByte = this.uint8()
		const majorType = initialByte >> 5
		const additionalInformation = initialByte & 0x1f

		if (majorType === 0) {
			const { value, uint64 } = this.getArgument(additionalInformation)
			if (uint64 !== undefined && maxSafeInteger < uint64) {
				throw new UnsafeIntegerError("cannot decode integers greater than 2^53-1", uint64)
			} else {
				return value
			}
		} else if (majorType === 1) {
			const { value, uint64 } = this.getArgument(additionalInformation)
			if (uint64 !== undefined && -1n - uint64 < minSafeInteger) {
				throw new UnsafeIntegerError("cannot decode integers less than -2^53+1", -1n - uint64)
			} else {
				return -1 - value
			}
		} else if (majorType === 2) {
			const { value: length } = this.getArgument(additionalInformation)
			return this.decodeBytes(length)
		} else if (majorType === 3) {
			const { value: length } = this.getArgument(additionalInformation)
			return this.decodeString(length)
		} else if (majorType === 4) {
			const { value: length } = this.getArgument(additionalInformation)
			const value = new Array(length)
			for (let i = 0; i < length; i++) {
				value[i] = this.decodeValue()
			}
			return value
		} else if (majorType === 5) {
			const { value: length } = this.getArgument(additionalInformation)
			const value: Record<string, any> = {}
			for (let i = 0; i < length; i++) {
				const key = this.decodeValue()
				if (typeof key !== "string") {
					throw new Error("microcbor only supports string keys in objects")
				}
				value[key] = this.decodeValue()
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
					return undefined
				case 24:
					throw new Error("microcbor does not support decoding unassigned simple values")
				case 25:
					return this.float16()
				case 26:
					return this.float32()
				case 27:
					return this.float64()
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

/** Decode an iterable of Uint8Array chunks into an iterable of CBOR values */
export function* decodeIterable(source: Iterable<Uint8Array>): IterableIterator<CBORValue> {
	yield* new Decoder(source)
}
