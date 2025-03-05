import cbor from "cbor"

import { CBORValue, encode, decode, encodingLength } from "microcbor"
import { ExecutionContext } from "ava"

export const testEncode = (t: ExecutionContext, value: CBORValue, message?: string) => {
	const data = encode(value)
	t.is(data.length, encodingLength(value))
	t.deepEqual(Buffer.from(data), cbor.encodeCanonical(value), message)
}

export const testDecode = (t: ExecutionContext, value: CBORValue, message?: string) =>
	t.deepEqual(decode(cbor.encodeCanonical(value)), value, message)
