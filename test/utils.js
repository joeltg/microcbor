import cbor from "cbor"

import { encode, decode, encodingLength } from "../lib/index.js"

export const testEncode = (t, value, message) => {
	const data = encode(value)
	t.is(data.length, encodingLength(value))
	t.deepEqual(Buffer.from(data), cbor.encodeCanonical(value), message)
}

export const testDecode = (t, value, message) =>
	t.deepEqual(decode(cbor.encodeCanonical(value)), value, message)
