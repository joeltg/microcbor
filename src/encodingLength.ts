import { getFloat16Precision, getFloat32Precision, Precision } from "fp16"
import type { CBORValue } from "./types.js"

export function encodingLength(value: CBORValue): number {
	if (value === false) {
		return 1
	} else if (value === true) {
		return 1
	} else if (value === null) {
		return 1
	} else if (value === undefined) {
		return 1
	} else if (typeof value === "number") {
		return numberEncodingLength(value)
	} else if (typeof value === "string") {
		return stringEncodingLength(value)
	} else if (value instanceof Uint8Array) {
		return bytesEncodingLength(value)
	} else if (Array.isArray(value)) {
		let length = argumentEncodingLength(value.length)
		for (const element of value) {
			length += encodingLength(element)
		}
		return length
	} else if (typeof value === "object") {
		const keys = Object.keys(value)
		let length = argumentEncodingLength(keys.length)
		for (const key of keys) {
			if (typeof key === "string") {
				length += stringEncodingLength(key)
				length += encodingLength(value[key])
			} else {
				throw new Error("object keys must be strings")
			}
		}
		return length
	} else {
		throw new Error("invalid value")
	}
}

function argumentEncodingLength(argument: number): number {
	if (argument < 24) {
		return 1
	} else if (argument < 0x100) {
		return 1 + 1
	} else if (argument < 0x10000) {
		return 1 + 2
	} else if (argument < 0x100000000) {
		return 1 + 4
	} else {
		return 1 + 8
	}
}

function numberEncodingLength(value: number): number {
	if (Object.is(value, 0)) {
		return integerEncodingLength(value)
	} else if (Object.is(value, -0)) {
		return floatEncodingLength(value)
	} else if (
		Math.floor(value) === value &&
		Number.MIN_SAFE_INTEGER <= value &&
		value <= Number.MAX_SAFE_INTEGER
	) {
		return integerEncodingLength(value)
	} else {
		return floatEncodingLength(value)
	}
}

function integerEncodingLength(value: number): number {
	if (value < 0) {
		return argumentEncodingLength(-value - 1)
	} else {
		return argumentEncodingLength(value)
	}
}

function floatEncodingLength(value: number): number {
	if (getFloat16Precision(value) === Precision.Exact) {
		return 1 + 2
	} else if (getFloat32Precision(value) === Precision.Exact) {
		return 1 + 4
	} else {
		return 1 + 8
	}
}

function stringEncodingLength(value: string) {
	const length = byteLength(value)
	return argumentEncodingLength(length) + length
}

function bytesEncodingLength(value: Uint8Array) {
	const length = value.byteLength
	return argumentEncodingLength(length) + length
}

// https://github.com/feross/buffer/blob/57caad4450d241207066ca3832fb8e9095ad402f/index.js#L434
function byteLength(string: string): number {
	let codePoint

	const length = string.length
	let leadSurrogate = null

	let bytes = 0

	for (let i = 0; i < length; ++i) {
		codePoint = string.charCodeAt(i)

		// is surrogate component
		if (codePoint > 0xd7ff && codePoint < 0xe000) {
			// last char was a lead
			if (!leadSurrogate) {
				// no lead yet
				if (codePoint > 0xdbff) {
					// unexpected trail
					bytes += 3
					continue
				} else if (i + 1 === length) {
					// unpaired lead
					bytes += 3
					continue
				}

				// valid lead
				leadSurrogate = codePoint

				continue
			}

			// 2 leads in a row
			if (codePoint < 0xdc00) {
				bytes += 3
				leadSurrogate = codePoint
				continue
			}

			// valid surrogate pair
			codePoint =
				(((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000
		} else if (leadSurrogate) {
			// valid bmp char, but last char was a lead
			bytes += 3
		}

		leadSurrogate = null

		// encode utf8
		if (codePoint < 0x80) {
			bytes += 1
		} else if (codePoint < 0x800) {
			bytes += 2
		} else if (codePoint < 0x10000) {
			bytes += 3
		} else if (codePoint < 0x110000) {
			bytes += 4
		} else {
			throw new Error("Invalid code point")
		}
	}

	return bytes
}
