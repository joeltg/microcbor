import { getFloat16 } from "fp16"

import type { CBORValue } from "./types.js"

import { UnsafeIntegerError, maxSafeInteger, minSafeInteger } from "./utils.js"

export class Decoder {
	#offset: number
	#view: DataView

	constructor(private readonly data: Uint8Array) {
		this.#offset = 0
		this.#view = new DataView(data.buffer, data.byteOffset, data.byteLength)
	}

	public getOffset(): number {
		return this.#offset
	}

	private constant =
		<T>(size: number, f: () => T) =>
		() => {
			const value = f()
			this.#offset += size
			return value
		}

	private float16 = this.constant(2, () => getFloat16(this.#view, this.#offset))
	private float32 = this.constant(4, () => this.#view.getFloat32(this.#offset))
	private float64 = this.constant(8, () => this.#view.getFloat64(this.#offset))
	private uint8 = this.constant(1, () => this.#view.getUint8(this.#offset))
	private uint16 = this.constant(2, () => this.#view.getUint16(this.#offset))
	private uint32 = this.constant(4, () => this.#view.getUint32(this.#offset))
	private uint64 = this.constant(8, () => this.#view.getBigUint64(this.#offset))

	private decodeBytes(length: number): Uint8Array {
		const value = new Uint8Array(length)
		value.set(this.data.subarray(this.#offset, this.#offset + length), 0)
		this.#offset += length
		return value
	}

	private decodeString(length: number): string {
		const value = new TextDecoder().decode(this.data.subarray(this.#offset, this.#offset + length))
		this.#offset += length
		return value
	}

	private getArgument(additionalInformation: number): {
		value: number
		uint64?: bigint
	} {
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

	public decodeValue(): CBORValue {
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

/** Decode a single CBOR value */
export function decode(data: Uint8Array): CBORValue {
	return new Decoder(data).decodeValue()
}
