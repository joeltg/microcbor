export const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)
export const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER)

export class UnsafeIntegerError extends RangeError {
	public constructor(
		message: string,
		readonly value: bigint,
	) {
		super(message)
	}
}

export class AssertError extends Error {
	public constructor(
		public readonly message: string,
		public readonly props?: any,
	) {
		super(message)
	}
}

export function assert(condition: unknown, message = "assertion failed", props?: any): asserts condition {
	if (!condition) {
		throw new AssertError(message, props)
	}
}

// https://github.com/feross/buffer/blob/57caad4450d241207066ca3832fb8e9095ad402f/index.js#L434
export function getByteLength(string: string): number {
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
			codePoint = (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000
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
