import test from "ava"
import cbor from "cbor"
import { encode, decode, encodeAsyncIterable, decodeAsyncIterable, encodingLength } from "microcbor"

import values from "./JSONDataSetSample.js"

test("complex nested objects", (t) => {
	for (const [i, value] of values.entries()) {
		const reference = cbor.encodeCanonical(value)

		const data = encode(value)

		t.deepEqual(Buffer.from(data), reference, `encode complex nested object ${i}`)

		t.is(data.length, encodingLength(value))

		t.deepEqual(decode(reference), value, `decode complex nested object ${i}`)
	}
})

test("encode value stream", async (t) => {
	const reference = Buffer.concat(values.map((value) => cbor.encodeCanonical(value)))

	async function* streamValues() {
		for (const value of values) yield value
	}

	const chunks = []
	for await (const chunk of encodeAsyncIterable(streamValues())) {
		chunks.push(chunk)
	}

	t.deepEqual(Buffer.concat(chunks), reference)
})

test("decode value stream in chunks of 10 bytes", async (t) => {
	const reference = Buffer.concat(values.map((value) => cbor.encodeCanonical(value)))

	const chunkSize = 10
	async function* streamChunks() {
		let offset = 0
		while (offset < reference.byteLength) {
			yield reference.subarray(offset, offset + chunkSize)
			offset += chunkSize
		}
	}

	const decodedValues = []
	for await (const value of decodeAsyncIterable(streamChunks())) {
		decodedValues.push(value)
	}

	t.deepEqual(decodedValues, values)
})

test("compose encodeStream(decodeStream()) | chunkSize = 16", async (t) => {
	const reference = Buffer.concat(values.map((value) => cbor.encodeCanonical(value)))

	const chunkSize = 16
	async function* streamChunks() {
		let offset = 0
		while (offset < reference.byteLength) {
			yield reference.subarray(offset, offset + chunkSize)
			offset += chunkSize
		}
	}

	const chunks = []
	for await (const chunk of encodeAsyncIterable(decodeAsyncIterable(streamChunks()))) {
		chunks.push(chunk)
	}

	t.deepEqual(Buffer.concat(chunks), reference)
})

test("compose decodeStream(encodeStream()) | chunkSize = 64", async (t) => {
	async function* streamValues() {
		for (const value of values) yield value
	}

	const decodedValues = []
	for await (const value of decodeAsyncIterable(encodeAsyncIterable(streamValues(), { chunkSize: 64 }))) {
		decodedValues.push(value)
	}

	t.deepEqual(decodedValues, values)
})

test("encode objects with adversarial unicode keys", (t) => {
	const keyA = "ﬁa"
	const keyB = "👍"
	const value = { [keyA]: 1, [keyB]: 2 }
	t.deepEqual(Buffer.from(encode(value)), cbor.encodeCanonical(value))
})
