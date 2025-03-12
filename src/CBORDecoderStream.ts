import { decodeAsyncIterable } from "./decodeAsyncIterable.js"
import { CBORValue } from "./types.js"

/** Decode a Web Streams API ReadableStream */
export class CBORDecoderStream extends TransformStream<Uint8Array, CBORValue> {
	constructor() {
		let readableController: ReadableStreamDefaultController<Uint8Array>

		// Create a simple ReadableStream to queue our chunks
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				readableController = controller
			},
		})

		super({
			async start(controller) {
				try {
					console.log("start decoding")
					for await (const value of decodeAsyncIterable(readable)) {
						controller.enqueue(value)
					}

					console.log("done decoding")
				} catch (error) {
					controller.error(error)
				}
			},

			transform(chunk) {
				readableController.enqueue(chunk)
			},

			flush() {
				readableController.close()
			},
		})
	}
}
