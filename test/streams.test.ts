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

	// Create a readable stream of our input values
	const source = new ReadableStream<CBORValue>({
		start(controller) {
			for (const value of input) {
				controller.enqueue(value)
			}
			controller.close()
		},
	})

	// Create our encode -> decode pipeline
	const encoded = source.pipeThrough(new CBOREncoderStream())
	const decoded = encoded.pipeThrough(new CBORDecoderStream())

	// Collect results
	const output: CBORValue[] = []
	for await (const value of decoded) {
		output.push(value)
	}

	t.deepEqual(input, output)
})
