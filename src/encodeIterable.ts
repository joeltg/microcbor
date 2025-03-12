import type { CBORValue } from "./types.js"

import { EncodeOptions, Encoder } from "./Encoder.js"

/** Encode an iterable of CBOR values into an iterable of Uint8Array chunks */
export function* encodeIterable(
	source: Iterable<CBORValue>,
	options: EncodeOptions = {},
): IterableIterator<Uint8Array> {
	const encoder = new Encoder(options)
	for (const value of source) {
		yield* encoder.encodeValue(value)
	}

	yield* encoder.flush()
}
