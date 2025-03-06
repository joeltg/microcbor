export const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)
export const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER)

export class UnsafeIntegerError extends RangeError {
	public constructor(
		message: string,
		readonly value: bigint,
	) {
		super(message)
	}
}

export class AssertError extends Error {
	public constructor(
		public readonly message: string,
		public readonly props?: any,
	) {
		super(message)
	}
}

export function assert(condition: unknown, message = "assertion failed", props?: any): asserts condition {
	if (!condition) {
		throw new AssertError(message, props)
	}
}
