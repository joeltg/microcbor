import type { CBORValue } from "./types.js"

import { Encoder } from "./Encoder.js"
import { EncodeOptions } from "./options.js"

/** Encode an async iterable of CBOR values into an async iterable of Uint8Array chunks */
export async function* encodeAsyncIterable(
	source: AsyncIterable<CBORValue>,
	options: EncodeOptions = {},
): AsyncIterableIterator<Uint8Array> {
	const encoder = new Encoder(options)
	for await (const value of source) {
		yield* encoder.encodeValue(value)
	}

	yield* encoder.flush()
}
