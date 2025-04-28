export const FloatSize = {
	f16: 16,
	f32: 32,
	f64: 64,
}

export interface EncodeOptions {
	/**
	 * Allow `undefined`
	 * @default true
	 */
	allowUndefined?: boolean

	/**
	 * Re-use the same underlying ArrayBuffer for all yielded chunks.
	 * If this is enabled, the consumer must copy each chunk content
	 * themselves to a new buffer if they wish to keep it.
	 * This mode is useful for efficiently hashing objects without
	 * ever allocating memory for the entire encoded result.
	 * @default false
	 */
	chunkRecycling?: boolean

	/**
	 * Maximum chunk size
	 * @default 4096
	 */
	chunkSize?: number

	/**
	 * Minimum bitsize for floating-point numbers: 16, 32, or 64
	 * @default 16
	 */
	minFloatSize?: (typeof FloatSize)[keyof typeof FloatSize]
}

export interface DecodeOptions {
	/**
	 * Allow `undefined`
	 * @default true
	 */
	allowUndefined?: boolean

	/**
	 * Minimum bitsize for floating-point numbers: 16, 32, or 64
	 * @default 16
	 */
	minFloatSize?: (typeof FloatSize)[keyof typeof FloatSize]
}
