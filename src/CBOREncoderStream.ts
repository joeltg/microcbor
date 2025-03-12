import { CBORValue } from "./types.js"
import { Encoder, EncodeOptions } from "./Encoder.js"

/**
 * Encode a Web Streams API ReadableStream.
 * options.chunkRecycling has no effect here.
 */
export class CBOREncoderStream extends TransformStream<CBORValue, Uint8Array> {
	constructor(options: EncodeOptions = {}) {
		const encoder = new Encoder({ ...options, chunkRecycling: false })

		super({
			transform(value: CBORValue, controller: TransformStreamDefaultController<Uint8Array>) {
				// Encode the incoming value and push all resulting chunks
				for (const chunk of encoder.encodeValue(value)) {
					controller.enqueue(chunk)
				}
			},

			flush(controller: TransformStreamDefaultController<Uint8Array>) {
				// Push any remaining chunks when the stream is closing
				for (const chunk of encoder.flush()) {
					controller.enqueue(chunk)
				}

				console.log("done encoding")
			},
		})
	}
}
