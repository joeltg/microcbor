import test from "ava"

import cbor from "cbor"
import { encode, decode } from "../lib/index.js"

import appendixTests from "./appendix_a.js"
import jsonDataSetSample from "./JSONDataSetSample.js"

// may as well use the entire test object lmao
const values = [...appendixTests, ...jsonDataSetSample]

function timeRounds(values, rounds, f) {
	const results = []
	const start = performance.now()
	for (let i = 0; i < rounds; i++) {
		for (const value of values) {
			results.push(f(value))
		}
	}
	const end = performance.now()
	return end - start
}

test("time encode()", (t) => {
	t.log(`microcbor:`, timeRounds(values, 100, encode), "(ms)")
	t.log("node-cbor:", timeRounds(values, 100, cbor.encodeCanonical), "(ms)")
	t.pass()
})

test("time decode()", (t) => {
	const encodedValues = values.map(encode)
	t.log(`microcbor:`, timeRounds(encodedValues, 100, decode), "(ms)")
	t.log("node-cbor:", timeRounds(encodedValues, 100, cbor.decode), "(ms)")
	t.pass()
})
