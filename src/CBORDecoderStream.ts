import { Decoder } from "./decodeAsyncIterable.js"
import { CBORValue } from "./types.js"

/** Decode a Web Streams API ReadableStream */
export class CBORDecoderStream<T extends CBORValue = CBORValue> extends TransformStream<Uint8Array, T> {
	constructor() {
		let readableController: ReadableStreamDefaultController<Uint8Array>

		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				readableController = controller
			},
		})

		// We need to track whick chunks have been "processed" and only resolve each
		// .transform() promise once all data from each chunk has been enqueued.
		const chunks = new WeakMap<Uint8Array, { resolve: () => void }>()

		async function pipe(controller: TransformStreamDefaultController<T>) {
			const decoder = new Decoder<T>(readable.values(), {
				onFree: (chunk) => chunks.get(chunk)?.resolve(),
			})

			for await (const value of decoder) {
				controller.enqueue(value)
			}
		}

		super({
			start(controller) {
				pipe(controller).catch((err) => controller.error(err))
			},

			transform(chunk) {
				return new Promise<void>((resolve) => {
					chunks.set(chunk, { resolve })
					readableController.enqueue(chunk)
				})
			},

			flush() {
				readableController.close()
			},
		})
	}
}
