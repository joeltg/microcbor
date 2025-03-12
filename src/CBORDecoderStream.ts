import { Decoder } from "./decodeAsyncIterable.js"
import { CBORValue } from "./types.js"

/** Decode a Web Streams API ReadableStream */
export class CBORDecoderStream extends TransformStream<Uint8Array, CBORValue> {
	constructor() {
		let readableController: ReadableStreamDefaultController<Uint8Array>

		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				readableController = controller
			},
		})

		const chunks = new WeakMap<Uint8Array, { resolve: () => void; reject: (err: any) => void }>()

		async function pipe(controller: TransformStreamDefaultController<CBORValue>) {
			const decoder = new Decoder(readable.values(), {
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
				return new Promise<void>((resolve, reject) => {
					chunks.set(chunk, { resolve, reject })
					readableController.enqueue(chunk)
				})
			},

			flush() {
				readableController.close()
			},
		})
	}
}
