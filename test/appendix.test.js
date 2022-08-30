import test from "ava"
import { encode, decode } from "../lib/index.js"

import values from "./appendix_a.js"

test("appenix_a.json", (t) => {
	for (const [i, value] of values.entries()) {
		const bytes = Buffer.from(value.hex, "hex")
		t.notThrows(() => {
			const decoded = decode(bytes)
			t.deepEqual(decoded, value.decoded, `index ${i}: ${value.hex}`)
			const encoded = encode(decoded)
			if (value.lossy) {
				t.deepEqual(decode(encoded), value.decoded, `index ${i}: ${value.hex}`)
			} else {
				t.deepEqual(Buffer.from(encoded), bytes, `index ${i}: ${value.hex}`)
			}
		}, `index ${i}: ${value.hex}`)
	}
})
