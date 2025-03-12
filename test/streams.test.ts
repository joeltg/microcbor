import test from "ava"

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
