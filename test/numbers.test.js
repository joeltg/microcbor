import test from "ava"

import { testEncode, testDecode } from "./utils.js"

const numbers = [
	0,
	-0,
	NaN,
	Infinity,
	-Infinity,
	Math.PI,
	1,
	-1,
	255,
	-127,
	256,
	-128,
	1.3921089,
	838219738219,
	832901839120328190,
	Number.MAX_SAFE_INTEGER,
	Number.MIN_SAFE_INTEGER,
	Number.MIN_VALUE,
	Number.MAX_VALUE,
	Number.MAX_SAFE_INTEGER + 1,

	// there's a bug in node-cbor affecting this number
	// https://github.com/hildjj/node-cbor/issues/155
	// Number.MIN_SAFE_INTEGER - 1,
	Number.MIN_SAFE_INTEGER - 3,
]

test("numbers", (t) => {
	for (const value of numbers) {
		testEncode(t, value, `encode number ${value}`)
		testDecode(t, value, `decode number ${value}`)
	}
})
