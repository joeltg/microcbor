import { getFloat16 } from "fp16"

export interface DecodeOptions {
	strict?: boolean
}

type DecodeState = { offset: number; view: DataView; options: DecodeOptions }

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)

function validateFloat(state: DecodeState, value: number) {
	if (state.options.strict) {
		if (isNaN(value)) {
			throw new Error("cannot decode NaN when strict mode is enabled")
		} else if (value === Infinity || value === -Infinity) {
			throw new Error("cannot decode +/- Infinity when strict mode is enabled")
		}
	}
}

const constants = {
	float16(state: DecodeState): number {
		const value = getFloat16(state.view, state.offset)
		validateFloat(state, value)
		state.offset += 2
		return value
	},
	float32(state: DecodeState): number {
		const value = state.view.getFloat32(state.offset)
		validateFloat(state, value)
		state.offset += 4
		return value
	},
	float64(state: DecodeState): number {
		const value = state.view.getFloat64(state.offset)
		validateFloat(state, value)
		state.offset += 8
		return value
	},
	uint8(state: DecodeState): number {
		const value = state.view.getUint8(state.offset)
		state.offset += 1
		return value
	},
	uint16(state: DecodeState): number {
		const value = state.view.getUint16(state.offset)
		state.offset += 2
		return value
	},
	uint32(state: DecodeState): number {
		const value = state.view.getUint32(state.offset)
		state.offset += 4
		return value
	},
	uint64(state: DecodeState): number {
		const value = state.view.getBigUint64(state.offset)
		state.offset += 1
		if (maxSafeInteger < value) {
			return Infinity
		} else {
			return Number(value)
		}
	},
}

function decodeString(state: DecodeState, length: number): string {
	const view = new DataView(
		state.view.buffer,
		state.view.byteOffset + state.offset,
		length
	)
	state.offset += length
	return new TextDecoder().decode(view)
}

function getArgument(
	state: DecodeState,
	additionalInformation: number
): number {
	if (additionalInformation < 24) {
		return additionalInformation
	} else if (additionalInformation === 24) {
		return constants.uint8(state)
	} else if (additionalInformation === 25) {
		return constants.uint16(state)
	} else if (additionalInformation === 26) {
		return constants.uint32(state)
	} else if (additionalInformation === 27) {
		return constants.uint64(state)
	} else if (additionalInformation === 31) {
		throw new Error(
			"microcbor does not support decoding indefinite-length items"
		)
	} else {
		throw new Error("invalid argument encoding")
	}
}

function decodeValue(state: DecodeState): any {
	const initialByte = constants.uint8(state)
	const majorType = initialByte >> 5
	const additionalInformation = initialByte & 0x1f
	if (majorType === 0) {
		const value = getArgument(state, additionalInformation)
		if (value === Infinity) {
			throw new RangeError("cannot decode integers greater than 2^53-1")
		} else {
			return value
		}
	} else if (majorType === 1) {
		const value = getArgument(state, additionalInformation)
		if (value === Infinity) {
			throw new RangeError("cannot decode integers greater than -2^53+1")
		} else {
			return -1 - value
		}
	} else if (majorType === 2) {
		throw new Error("microcbor does not support byte strings")
	} else if (majorType === 3) {
		const length = getArgument(state, additionalInformation)
		return decodeString(state, length)
	} else if (majorType === 4) {
		const length = getArgument(state, additionalInformation)
		const value = new Array(length)
		for (let i = 0; i < length; i++) {
			value[i] = decodeValue(state)
		}
		return value
	} else if (majorType === 5) {
		const length = getArgument(state, additionalInformation)
		const value: Record<string, any> = {}
		for (let i = 0; i < length; i++) {
			const key = decodeValue(state)
			if (typeof key !== "string") {
				throw new Error("microcbor only supports string keys in objects")
			}
			value[key] = decodeValue(state)
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
				throw new Error("microcbor does not support the undefined value")
			case 24:
				throw new Error(
					"microcbor does not support decoding unassigned simple values"
				)
			case 25:
				return constants.float16(state)
			case 26:
				return constants.float32(state)
			case 27:
				return constants.float64(state)
			case 31:
				throw new Error(
					"microcbor does not support decoding indefinite-length items"
				)
			default:
				throw new Error("invalid simple value")
		}
	} else {
		throw new Error("invalid major type")
	}
}

export function decode<T = any>(
	data: Uint8Array,
	options: DecodeOptions = {}
): T {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
	const state: DecodeState = { options, offset: 0, view }
	return decodeValue(state) as T
}
