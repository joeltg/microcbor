export type CBORValue =
	| undefined
	| null
	| boolean
	| number
	| string
	| Uint8Array
	| CBORArray
	| CBORMap

export interface CBORArray extends Array<CBORValue> {}
export interface CBORMap {
	[key: string]: CBORValue
}
