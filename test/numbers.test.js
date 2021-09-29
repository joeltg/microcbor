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

	838219738219, // uint64 < Number.MAX_SAFE_INTEGER
	832901839120328190, // uint64 > Number.MAX_SAFE_INTEGER

	Number.MAX_SAFE_INTEGER,
	Number.MIN_SAFE_INTEGER,

	Number.MAX_SAFE_INTEGER + 1,
	Number.MIN_SAFE_INTEGER - 1,
	Number.MIN_SAFE_INTEGER - 3,

	Number.MIN_VALUE,
	Number.MAX_VALUE,
]

test("numbers", (t) => {
	for (const value of numbers) {
		testEncode(t, value, `encode number ${value}`)
		testDecode(t, value, `decode number ${value}`)
	}
})
