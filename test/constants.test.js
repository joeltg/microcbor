import test from "ava"

import { testEncode, testDecode } from "./utils.js"

test("booleans", (t) => {
	testEncode(t, false, "encode false")
	testDecode(t, false, "decode false")
	testEncode(t, true, "encode true")
	testDecode(t, true, "decode true")
})

test("null", (t) => {
	testEncode(t, null, "encode null")
	testDecode(t, null, "decode null")
})
