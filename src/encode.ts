import { getFloat16Precision, getFloat32Precision, setFloat16 } from "fp16"

export interface EncodeOptions {
	strictJSON?: boolean
	chunkSize?: number
}

const defaultChunkSize = 512

type EncodeState = {
	options: EncodeOptions
	buffer: ArrayBuffer
	view: DataView
	offset: number
}

function* allocate(state: EncodeState, size: number): Iterable<Uint8Array> {
	if (state.buffer.byteLength < state.offset + size) {
		yield new Uint8Array(state.buffer, 0, state.offset)
		const byteLength = Math.max(
			size,
			state.options.chunkSize || defaultChunkSize
		)
		state.buffer = new ArrayBuffer(byteLength)
		state.view = new DataView(state.buffer)
		state.offset = 0
	}
}

const c = (size: number, f: (state: EncodeState, value: number) => void) =>
	function* (state: EncodeState, value: number): Iterable<Uint8Array> {
		yield* allocate(state, size)
		f(state, value)
		state.offset += size
	}

const constants = {
	float16: c(2, (state, value) => setFloat16(state.view, state.offset, value)),
	float32: c(4, (state, value) => state.view.setFloat32(state.offset, value)),
	float64: c(8, (state, value) => state.view.setFloat64(state.offset, value)),
	uint8: c(1, (state, value) => state.view.setUint8(state.offset, value)),
	uint16: c(2, (state, value) => state.view.setUint16(state.offset, value)),
	uint32: c(4, (state, value) => state.view.setUint32(state.offset, value)),
	uint64: c(8, (state, value) =>
		state.view.setBigUint64(state.offset, BigInt(value))
	),
}

function* encodeTypeAndArgument(
	state: EncodeState,
	type: number,
	argument: number
): Iterable<Uint8Array> {
	const additionalInformation = getAdditionalInformation(argument)
	yield* constants.uint8(state, (type << 5) | additionalInformation)
	switch (additionalInformation) {
		case 24:
			return yield* constants.uint8(state, argument)
		case 25:
			return yield* constants.uint16(state, argument)
		case 26:
			return yield* constants.uint32(state, argument)
		case 27:
			return yield* constants.uint64(state, argument)
	}
}

function* encodeNumber(
	state: EncodeState,
	value: number
): Iterable<Uint8Array> {
	if (Object.is(value, 0)) {
		yield* encodeInteger(state, value)
	} else if (Object.is(value, -0)) {
		yield* encodeFloat(state, value)
	} else if (
		Math.floor(value) === value &&
		Number.MIN_SAFE_INTEGER <= value &&
		value <= Number.MAX_SAFE_INTEGER
	) {
		yield* encodeInteger(state, value)
	} else {
		if (state.options.strictJSON === true) {
			if (isNaN(value)) {
				throw new Error("cannot encode NaN when strict mode is enabled")
			} else if (value === Infinity || value === -Infinity) {
				throw new Error(
					"cannot encode +/- Infinity when strict mode is enabled"
				)
			}
		}
		yield* encodeFloat(state, value)
	}
}

function* encodeInteger(
	state: EncodeState,
	value: number
): Iterable<Uint8Array> {
	if (value < 0) {
		yield* encodeTypeAndArgument(state, 1, -value - 1)
	} else {
		yield* encodeTypeAndArgument(state, 0, value)
	}
}

function* encodeFloat(state: EncodeState, value: number): Iterable<Uint8Array> {
	if (getFloat16Precision(value) === "exact") {
		yield* constants.uint8(state, 0xe0 | 25)
		return yield* constants.float16(state, value)
	} else if (getFloat32Precision(value) === "exact") {
		yield* constants.uint8(state, 0xe0 | 26)
		return yield* constants.float32(state, value)
	} else {
		yield* constants.uint8(state, 0xe0 | 27)
		return yield* constants.float64(state, value)
	}
}

function* encodeString(
	state: EncodeState,
	value: string
): Iterable<Uint8Array> {
	const data = new TextEncoder().encode(value)
	yield* encodeTypeAndArgument(state, 3, data.byteLength)
	yield* allocate(state, data.byteLength)
	new Uint8Array(state.buffer, state.offset).set(data)
	state.offset += data.byteLength
}

function getAdditionalInformation(argument: number): number {
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

function* encodeValue(state: EncodeState, value: any): Iterable<Uint8Array> {
	if (value === false) {
		return yield* constants.uint8(state, 0xf4)
	} else if (value === true) {
		return yield* constants.uint8(state, 0xf5)
	} else if (value === null) {
		return yield* constants.uint8(state, 0xf6)
	} else if (value === undefined) {
		throw new Error("microcbor does not support encoding the undefined value")
	} else if (typeof value === "number") {
		return yield* encodeNumber(state, value)
	} else if (typeof value === "string") {
		return yield* encodeString(state, value)
	} else if (Array.isArray(value)) {
		yield* encodeTypeAndArgument(state, 4, value.length)
		for (const element of value) {
			yield* encodeValue(state, element)
		}
		return
	} else if (typeof value !== "object") {
		throw new Error("invalid value")
	} else {
		// Note: this can't be a normal sort, because 'b' needs to sort before
		// 'aa'

		// Per the deterministic CBOR spec, we're supposed to sort keys
		// the byte-wise lexicographic order of the key's CBOR encoding
		// - ie lower major types come before higher major types!
		// However, microcbor only supports string keys, which means we
		// can get away with sorting them without actually encoding them
		// first. One thing we know for sure about strings is that a
		// string with a smaller length will sort byte-wise before a string
		// with a longer length, since strings are encoded with a lengt
		// prefix (either in the additionalInformation bits, if < 24, or
		// in the next serveral bytes, but in all cases the order holds).
		const keys = Object.keys(value).sort((a, b) => {
			if (a.length < b.length) {
				return -1
			} else if (b.length < a.length) {
				return 1
			} else {
				return a < b ? -1 : 1
			}
		})

		yield* encodeTypeAndArgument(state, 5, keys.length)

		for (const key of keys) {
			if (typeof key === "string") {
				yield* encodeString(state, key)
				yield* encodeValue(state, value[key])
			} else {
				throw new Error("object keys must be strings")
			}
		}
		return
	}
}

export function encode(value: any, options: EncodeOptions = {}): Uint8Array {
	const buffer = new ArrayBuffer(options.chunkSize || defaultChunkSize)
	const state: EncodeState = {
		options: options,
		buffer: buffer,
		view: new DataView(buffer),
		offset: 0,
	}

	const chunks = Array.from(encodeValue(state, value))
	if (state.offset > 0) {
		chunks.push(new Uint8Array(state.buffer, 0, state.offset))
	}

	let byteLength = 0
	for (const chunk of chunks) {
		byteLength += chunk.length
	}

	const data = new Uint8Array(byteLength)

	let offset = 0
	for (const chunk of chunks) {
		data.set(chunk, offset)
		offset += chunk.length
	}

	return data
}
