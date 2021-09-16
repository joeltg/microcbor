import cbor from "cbor"

import { encode, decode } from "../lib/index.js"

export const testEncode = (t, value, message) =>
	t.deepEqual(Buffer.from(encode(value)), cbor.encodeCanonical(value), message)

export const testDecode = (t, value, message) =>
	t.deepEqual(decode(cbor.encodeCanonical(value)), value, message)
