import {
	getFloat16Precision,
	getFloat32Precision,
	setFloat16,
	Precision,
} from "fp16"

import type { CBORValue } from "./types.js"

export class Encoder {
	public static defaultChunkSize = 512

	public closed: boolean

	private buffer: ArrayBuffer
	private view: DataView
	private offset: number
	private readonly encoder = new TextEncoder()
	private readonly chunkSize: number

	constructor(options: { chunkSize?: number; noCopy?: boolean } = {}) {
		this.chunkSize = options.chunkSize || Encoder.defaultChunkSize
		this.buffer = new ArrayBuffer(this.chunkSize)
		this.view = new DataView(this.buffer)
		this.offset = 0
		this.closed = false
	}

	private *allocate(size: number): Iterable<Uint8Array> {
		if (this.buffer.byteLength < this.offset + size) {
			yield new Uint8Array(this.buffer, 0, this.offset)
			const byteLength = Math.max(size, this.chunkSize)
			this.buffer = new ArrayBuffer(byteLength)
			this.view = new DataView(this.buffer)
			this.offset = 0
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

	private *encodeTypeAndArgument(
		type: number,
		argument: number
	): Iterable<Uint8Array> {
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
		} else if (
			Math.floor(value) === value &&
			Number.MIN_SAFE_INTEGER <= value &&
			value <= Number.MAX_SAFE_INTEGER
		) {
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
		if (getFloat16Precision(value) === Precision.Exact) {
			yield* this.uint8(0xe0 | 25)
			yield* this.float16(value)
		} else if (getFloat32Precision(value) === Precision.Exact) {
			yield* this.uint8(0xe0 | 26)
			yield* this.float32(value)
		} else {
			yield* this.uint8(0xe0 | 27)
			yield* this.float64(value)
		}
	}

	private *encodeString(value: string): Iterable<Uint8Array> {
		const data = this.encoder.encode(value)
		yield* this.encodeTypeAndArgument(3, data.byteLength)
		yield* this.allocate(data.byteLength)
		new Uint8Array(this.buffer, this.offset).set(data)
		this.offset += data.byteLength
	}

	private *encodeBytes(value: Uint8Array): Iterable<Uint8Array> {
		yield* this.encodeTypeAndArgument(2, value.byteLength)
		yield* this.allocate(value.byteLength)
		new Uint8Array(this.buffer, this.offset, value.byteLength).set(value)
		this.offset += value.byteLength
	}

	public *encodeValue(value: CBORValue): Iterable<Uint8Array> {
		if (this.closed) {
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
			const keys = Object.keys(value).sort(Encoder.compareKeys)
			yield* this.encodeTypeAndArgument(5, keys.length)
			for (const key of keys) {
				yield* this.encodeString(key)
				yield* this.encodeValue(value[key])
			}
		}
	}

	public *flush(): Iterable<Uint8Array> {
		if (this.closed) {
			return
		}

		this.closed = true
		if (this.offset > 0) {
			yield new Uint8Array(this.buffer, 0, this.offset)
		}
	}

	// Per the deterministic CBOR spec, we're supposed to sort keys
	// the byte-wise lexicographic order of the key's CBOR encoding
	// - ie lower major types come before higher major types!
	// However, microcbor only supports string keys, which means we
	// can get away with sorting them without actually encoding them
	// first. One thing we know for sure about strings is that a
	// string with a smaller length will sort byte-wise before a string
	// with a longer length, since strings are encoded with a length
	// prefix (either in the additionalInformation bits, if < 24, or
	// in the next serveral bytes, but in all cases the order holds).
	private static compareKeys(a: string, b: string) {
		if (a.length < b.length) {
			return -1
		} else if (b.length < a.length) {
			return 1
		} else {
			return a < b ? -1 : 1
		}
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

export function encode(
	value: CBORValue,
	options: { chunkSize?: number } = {}
): Uint8Array {
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
