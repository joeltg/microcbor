import { Precision, getFloat16Precision, getFloat32Precision, setFloat16 } from "fp16"

import type { CBORValue } from "./types.js"
import { assert } from "./utils.js"

export const FloatSize = {
	f16: 16,
	f32: 32,
	f64: 64,
}

export interface EncodeOptions {
	/**
	 * Re-use the same underlying ArrayBuffer for all yielded chunks.
	 * If this is enabled, the consumer must copy each chunk content
	 * themselves to a new buffer if they wish to keep it.
	 * This mode is useful for efficiently hashing objects without
	 * ever allocating memory for the entire encoded result.
	 * @default false
	 */
	chunkRecycling?: boolean

	/**
	 * Maximum chunk size
	 * @default 4096
	 */
	chunkSize?: number

	/**
	 * Minimum bitsize for floating-point numbers: 16, 32, or 64
	 * @default 16
	 */
	minFloatSize?: (typeof FloatSize)[keyof typeof FloatSize]
}

export class Encoder {
	public static defaultChunkSize = 4096

	#closed: boolean
	public readonly chunkRecycling: boolean
	public readonly chunkSize: number
	public readonly minFloatSize: (typeof FloatSize)[keyof typeof FloatSize]

	private readonly encoder = new TextEncoder()
	private readonly buffer: ArrayBuffer
	private readonly view: DataView
	private readonly array: Uint8Array
	private offset: number

	constructor(options: EncodeOptions = {}) {
		this.minFloatSize = options.minFloatSize ?? 16
		this.chunkRecycling = options.chunkRecycling ?? false
		this.chunkSize = options.chunkSize ?? Encoder.defaultChunkSize
		assert(this.chunkSize >= 8, "expected chunkSize >= 8")

		this.buffer = new ArrayBuffer(this.chunkSize)
		this.view = new DataView(this.buffer)
		this.array = new Uint8Array(this.buffer, 0, this.chunkSize)
		this.offset = 0
		this.#closed = false
	}

	public get closed() {
		return this.#closed
	}

	#flush(): Uint8Array {
		if (this.chunkRecycling) {
			const chunk = new Uint8Array(this.buffer, 0, this.offset)
			this.offset = 0
			return chunk
		} else {
			const chunk = new Uint8Array(this.offset)
			chunk.set(new Uint8Array(this.buffer, 0, this.offset))
			this.offset = 0
			return chunk
		}
	}

	private *allocate(size: number): Iterable<Uint8Array> {
		assert(size <= 8, "expected size <= 8")
		if (this.buffer.byteLength < this.offset + size) {
			yield this.#flush()
		}
	}

	private *float16(value: number) {
		yield* this.allocate(2)
		setFloat16(this.view, this.offset, value)
		this.offset += 2
	}

	private *float32(value: number) {
		yield* this.allocate(4)
		this.view.setFloat32(this.offset, value)
		this.offset += 4
	}

	private *float64(value: number) {
		yield* this.allocate(8)
		this.view.setFloat64(this.offset, value)
		this.offset += 8
	}

	private *uint8(value: number) {
		yield* this.allocate(1)
		this.view.setUint8(this.offset, value)
		this.offset += 1
	}

	private *uint16(value: number) {
		yield* this.allocate(2)
		this.view.setUint16(this.offset, value)
		this.offset += 2
	}

	private *uint32(value: number) {
		yield* this.allocate(4)
		this.view.setUint32(this.offset, value)
		this.offset += 4
	}

	private *uint64(value: number) {
		yield* this.allocate(8)
		this.view.setBigUint64(this.offset, BigInt(value))
		this.offset += 8
	}

	private *encodeTypeAndArgument(type: number, argument: number): Iterable<Uint8Array> {
		const additionalInformation = Encoder.getAdditionalInformation(argument)
		yield* this.uint8((type << 5) | additionalInformation)
		switch (additionalInformation) {
			case 24:
				return yield* this.uint8(argument)
			case 25:
				return yield* this.uint16(argument)
			case 26:
				return yield* this.uint32(argument)
			case 27:
				return yield* this.uint64(argument)
		}
	}

	private *encodeNumber(value: number): Iterable<Uint8Array> {
		if (Object.is(value, 0)) {
			yield* this.encodeInteger(value)
		} else if (Object.is(value, -0)) {
			yield* this.encodeFloat(value)
		} else if (Math.floor(value) === value && Number.MIN_SAFE_INTEGER <= value && value <= Number.MAX_SAFE_INTEGER) {
			yield* this.encodeInteger(value)
		} else {
			yield* this.encodeFloat(value)
		}
	}

	private *encodeInteger(value: number): Iterable<Uint8Array> {
		if (value < 0) {
			yield* this.encodeTypeAndArgument(1, -value - 1)
		} else {
			yield* this.encodeTypeAndArgument(0, value)
		}
	}

	private *encodeFloat(value: number): Iterable<Uint8Array> {
		if (this.minFloatSize === FloatSize.f16 && getFloat16Precision(value) === Precision.Exact) {
			yield* this.uint8(0xe0 | 25)
			yield* this.float16(value)
		} else if (this.minFloatSize <= FloatSize.f32 && getFloat32Precision(value) === Precision.Exact) {
			yield* this.uint8(0xe0 | 26)
			yield* this.float32(value)
		} else {
			yield* this.uint8(0xe0 | 27)
			yield* this.float64(value)
		}
	}

	private *encodeString(value: string): Iterable<Uint8Array> {
		const bytes = this.encoder.encode(value)
		yield* this.encodeTypeAndArgument(3, bytes.byteLength)
		yield* this.writeBytes(bytes)

		// const byteLength = getByteLength(value)

		// let start = 0
		// while (start < value.length) {
		// 	if (this.offset + 4 > this.buffer.byteLength) {
		// 		yield this.#flush()
		// 	}

		// 	const target = new Uint8Array(this.buffer, this.offset)
		// 	const result = this.encoder.encodeInto(value.slice(start), target)
		// 	start += result.read
		// 	this.offset += result.written
		// 	assert(this.offset <= this.buffer.byteLength, "expected this.offset <= this.buffer.byteLength")
		// }
	}

	private *encodeBytes(value: Uint8Array): Iterable<Uint8Array> {
		yield* this.encodeTypeAndArgument(2, value.byteLength)
		yield* this.writeBytes(value)
	}

	private *writeBytes(value: Uint8Array): Iterable<Uint8Array> {
		let start = 0
		while (start < value.byteLength) {
			if (this.offset >= this.buffer.byteLength) {
				yield this.#flush()
			}

			const capacity = this.buffer.byteLength - this.offset
			const remaining = value.byteLength - start
			const chunkLength = Math.min(capacity, remaining)
			this.array.set(value.subarray(start, start + chunkLength), this.offset)
			start += chunkLength
			this.offset += chunkLength
		}
	}

	public *encodeValue(value: CBORValue): Iterable<Uint8Array> {
		if (this.#closed) {
			return
		}

		if (value === false) {
			yield* this.uint8(0xf4)
		} else if (value === true) {
			yield* this.uint8(0xf5)
		} else if (value === null) {
			yield* this.uint8(0xf6)
		} else if (value === undefined) {
			yield* this.uint8(0xf7)
		} else if (typeof value === "number") {
			yield* this.encodeNumber(value)
		} else if (typeof value === "string") {
			yield* this.encodeString(value)
		} else if (value instanceof Uint8Array) {
			yield* this.encodeBytes(value)
		} else if (Array.isArray(value)) {
			yield* this.encodeTypeAndArgument(4, value.length)
			for (const element of value) {
				yield* this.encodeValue(element)
			}
		} else {
			const entries = Object.entries(value)
				.map<[Uint8Array, CBORValue]>(([key, value]) => [this.encoder.encode(key), value])
				.sort(Encoder.compareEntries)

			yield* this.encodeTypeAndArgument(5, entries.length)
			for (const [key, value] of entries) {
				yield* this.encodeTypeAndArgument(3, key.byteLength)
				yield* this.writeBytes(key)
				yield* this.encodeValue(value)
			}
		}
	}

	public *flush(): Iterable<Uint8Array> {
		if (this.#closed) {
			return
		}

		if (this.offset > 0) {
			yield this.#flush()
		}
	}

	// Per the deterministic CBOR spec, we're supposed to sort keys
	// the byte-wise lexicographic order of the key's CBOR encoding
	// - ie lower major types come before higher major types.
	// One thing we know for sure about strings is that a string with
	// a smaller length will sort byte-wise before a string
	// with a longer length, since strings are encoded with a length
	// prefix (either in the additionalInformation bits, if < 24, or
	// in the next serveral bytes, but in all cases the order holds).
	private static compareEntries([a]: [key: Uint8Array, value: CBORValue], [b]: [key: Uint8Array, value: CBORValue]) {
		if (a.byteLength < b.byteLength) return -1
		if (b.byteLength < a.byteLength) return 1

		for (let i = 0; i < a.byteLength; i++) {
			if (a[i] < b[i]) return -1
			if (b[i] < a[i]) return 1
		}

		return 0
	}

	private static getAdditionalInformation(argument: number): number {
		if (argument < 24) {
			return argument
		} else if (argument < 0x100) {
			return 24
		} else if (argument < 0x10000) {
			return 25
		} else if (argument < 0x100000000) {
			return 26
		} else {
			return 27
		}
	}
}

export function encode(value: CBORValue, options: EncodeOptions = {}): Uint8Array {
	const encoder = new Encoder(options)

	let byteLength = 0
	const chunks: Uint8Array[] = []
	for (const chunk of encoder.encodeValue(value)) {
		chunks.push(chunk)
		byteLength += chunk.byteLength
	}

	for (const chunk of encoder.flush()) {
		chunks.push(chunk)
		byteLength += chunk.byteLength
	}

	const data = new Uint8Array(byteLength)

	let offset = 0
	for (const chunk of chunks) {
		data.set(chunk, offset)
		offset += chunk.length
	}

	return data
}
