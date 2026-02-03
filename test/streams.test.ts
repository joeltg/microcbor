import test from "ava"
import { setTimeout } from "node:timers/promises"

import { CBORValue, CBOREncoderStream, CBORDecoderStream } from "microcbor"

test("CBOREncoderStream / CBORDecoderStream", async (t) => {
	const input: CBORValue[] = [
		{ hello: "world" },
		[1, 2, 3, { foo: NaN, bar: -Infinity, baz: Infinity }],
		"test string",
		42,
		"jfkdlsfj ksdljfkldsafjkdlsajfklds ajfklads jfkldas fjklasd",
		null,
		true,
		undefined,
		new Uint8Array([1, 2, 3]),
	]

	// Create source stream
	const reader = new ReadableStream<CBORValue>({
		start(controller) {
			input.forEach((value) => controller.enqueue(value))
			controller.close()
		},
	})

	// Create encoder and decoder
	const encoder = new CBOREncoderStream()
	const decoder = new CBORDecoderStream()

	// Create output writer
	const output: CBORValue[] = []
	const writer = new WritableStream<CBORValue>({
		write: (chunk) => void output.push(chunk),
	})

	await reader.pipeThrough(encoder).pipeThrough(decoder).pipeTo(writer)

	t.deepEqual(input, output)
})

test("CBORDecoderStream handles multi-chunk values without deadlock", async (t) => {
	// Create a long string that will span multiple small chunks
	const longString = "x".repeat(1000)

	// Create source stream with the long string
	const reader = new ReadableStream<CBORValue>({
		start(controller) {
			controller.enqueue(longString)
			controller.close()
		},
	})

	// Create encoder
	const encoder = new CBOREncoderStream()

	// Create a transform stream that splits the encoded data into small chunks (16 bytes each)
	const chunkSplitter = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			const chunkSize = 16
			for (let i = 0; i < chunk.byteLength; i += chunkSize) {
				controller.enqueue(chunk.slice(i, i + chunkSize))
			}
		},
	})

	// Create decoder
	const decoder = new CBORDecoderStream()

	// Create output writer
	const output: CBORValue[] = []
	const writer = new WritableStream<CBORValue>({
		write: (chunk) => void output.push(chunk),
	})

	// Add a timeout to detect deadlock
	const abortController = new AbortController()
	const timeoutPromise = setTimeout(5000, undefined, { signal: abortController.signal }).then(() => {
		throw new Error("Deadlock detected: operation timed out")
	})

	// Race the pipeline against the timeout
	await Promise.race([
		reader.pipeThrough(encoder).pipeThrough(chunkSplitter).pipeThrough(decoder).pipeTo(writer),
		timeoutPromise,
	]).finally(() => abortController.abort())

	t.is(output.length, 1)
	t.is(output[0], longString)
})
