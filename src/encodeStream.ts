import type { CBORValue } from "./types.js"

import { EncodeOptions, Encoder } from "./encode.js"

export async function* encodeStream(
	source: AsyncIterable<CBORValue>,
	options: EncodeOptions = {},
): AsyncIterable<Uint8Array> {
	const encoder = new Encoder(options)
	for await (const value of source) {
		yield* encoder.encodeValue(value)
	}

	yield* encoder.flush()
}
