export const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)
export const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER)

export class UnsafeIntegerError extends RangeError {
	constructor(message: string, readonly value: bigint) {
		super(message)
	}
}
