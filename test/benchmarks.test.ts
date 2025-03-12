import test from "ava"

import cbor from "cbor"
import { encode, decode } from "microcbor"

import appendixTests from "./appendix_a.js"
import jsonDataSetSample from "./JSONDataSetSample.js"

// may as well use the entire test object lmao
const values = [...appendixTests, ...jsonDataSetSample]

function timeRounds<I, O>(values: I[], rounds: number, f: (value: I) => O): { avg: number; std: number } {
	const results = new Array<O>(values.length)
	const times = new Array<number>(rounds)
	for (let i = 0; i < rounds; i++) {
		const start = performance.now()
		for (const [j, value] of values.entries()) {
			results[j] = f(value)
		}
		const end = performance.now()
		times[i] = end - start
	}

	const sum = times.reduce((sum, t) => sum + t, 0)
	const avg = sum / rounds
	const delta2 = times.map((t) => Math.pow(t - avg, 2))
	const std = Math.sqrt(delta2.reduce((sum, d) => sum + d, 0) / rounds)
	return { avg, std }
}

test("time encode()", (t) => {
	t.log("microcbor:", timeRounds(values, 100, encode), "(ms)")
	t.log("node-cbor:", timeRounds(values, 100, cbor.encode), "(ms)")
	t.log("node-cbor (canonical):", timeRounds(values, 100, cbor.encodeCanonical), "(ms)")
	t.log("JSON.stringify:", timeRounds(values, 100, JSON.stringify), "(ms)")
	t.pass()
})

test("time decode()", (t) => {
	const encodedValues = values.map((value) => encode(value))
	const stringifiedValues = values.map((value) => JSON.stringify(value))
	t.log(`microcbor:`, timeRounds(encodedValues, 100, decode), "(ms)")
	t.log("node-cbor:", timeRounds(encodedValues, 100, cbor.decode), "(ms)")
	t.log("JSON.parse:", timeRounds(stringifiedValues, 100, JSON.parse), "(ms)")
	t.pass()
})
