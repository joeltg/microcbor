import test from "ava"
import cbor from "cbor"

import { encode, decode, encodingLength } from "microcbor"
import assert from "node:assert"

const strings = [
	"hello world",
	"",
	`
	Beautiful is better than ugly.
	Explicit is better than implicit.
	Simple is better than complex.
	Complex is better than complicated.
	Flat is better than nested.
	Sparse is better than dense.
	Readability counts.
	Special cases aren't special enough to break the rules.
	Although practicality beats purity.
	Errors should never pass silently.
	Unless explicitly silenced.
	In the face of ambiguity, refuse the temptation to guess.
	There should be one-- and preferably only one --obvious way to do it.
	Although that way may not be obvious at first unless you're Dutch.
	Now is better than never.
	Although never is often better than *right* now.
	If the implementation is hard to explain, it's a bad idea.
	If the implementation is easy to explain, it may be a good idea.
	Namespaces are one honking great idea -- let's do more of those!
	`.trim(),
	"a string 👀 with emojis 😡 that makes 👨‍👧‍👦 the string length 👍🏿 different than the byte length 🤯",
	"👨‍👧‍👦".repeat(1000),
	Buffer.from([1, 2, 3, 4, 5]),
	`Lorem ipsum dolor sit amet, consectetur adipiscing elit,
	sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
	Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
	Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
	Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
	Buffer.from(
		`Lorem ipsum dolor sit amet, consectetur adipiscing elit,
	sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
	Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
	Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
	Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
	),
]

test("strings", (t) => {
	for (const [i, value] of strings.entries()) {
		// use a tiny chunk irregular size for tests
		const data = encode(value, { chunkSize: 17 })
		t.is(data.length, encodingLength(value))
		t.deepEqual(Buffer.from(data), cbor.encodeCanonical(value), `encode string ${i}`)

		const result = decode(cbor.encodeCanonical(value))
		if (Buffer.isBuffer(value)) {
			assert(result instanceof Uint8Array)
			t.deepEqual(Buffer.from(result), value, `decode buffer ${i}`)
		} else {
			t.deepEqual(result, value, `decode string ${i}`)
		}
	}
})
