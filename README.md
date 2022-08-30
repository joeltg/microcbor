# microcbor

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme) [![license](https://img.shields.io/github/license/joeltg/microcbor)](https://opensource.org/licenses/MIT) [![NPM version](https://img.shields.io/npm/v/microcbor)](https://www.npmjs.com/package/microcbor) ![TypeScript types](https://img.shields.io/npm/types/microcbor) ![lines of code](https://img.shields.io/tokei/lines/github/joeltg/microcbor)

Encode JavaScript values as canonical CBOR.

microcbor is a minimal JavaScript [CBOR](https://cbor.io/) implementation. You can use microcbor to serialize JavaScript values to CBOR, and to deserialize them back into JavaScript values again. **microcbor doesn't support tags, bigints, typed arrays, non-string keys, or indefinite-length collections.**

microcbor follows the [deterministic CBOR encoding requirements](https://www.rfc-editor.org/rfc/rfc8949.html#core-det) - all floating-point numbers are serialized in the smallest possible size without losing precision, and object entries are always sorted by key in byte-wise lexicographic order. `NaN` is always serialized as `0xf97e00`.

This library is TypeScript-native, ESM-only, and has just one dependency ([joeltg/fp16](https://github.com/joeltg/fp16) for half-precision floats). It works in Node, the browser, and Deno.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [Value types](#value-types)
  - [Encoding](#encoding)
  - [Decoding](#decoding)
  - [Encoding length](#encoding-length)
- [Support](#support)
- [Testing](#testing)
- [Benchmarks](#benchmarks)
- [Contributing](#contributing)
- [License](#license)

## Install

```
npm i microcbor
```

Or in Deno:

```typescript
import {
	encode,
	decode,
	encodeStream,
	decodeStream,
	encodingLength,
	CBORValue,
	UnsafeIntegerError,
} from "https://cdn.skypack.dev/microcbor"
```

## Usage

```typescript
import { encode, decode } from "microcbor"

const data = encode({ a: 5, b: "hello world" })

console.log(data)
// Uint8Array(18) [
//   162,  97,  97,   5,  97,  98,
//   107, 104, 101, 108, 108, 111,
//    32, 119, 111, 114, 108, 100
// ]

console.log(decode(data))
// { a: 5, b: 'hello world' }
```

## API

### Value types

```ts
declare type CBORValue =
	| undefined
	| null
	| boolean
	| number
	| string
	| Uint8Array
	| CBORArray
	| CBORMap

interface CBORArray extends Array<CBORValue> {}
interface CBORMap {
	[key: string]: CBORValue
}
```

### Encoding

```typescript
declare function encode(
	value: CBORValue,
	options: { chunkSize?: number } = {}
): Uint8Array

declare function encodeStream(
	source: AsyncIterable<CBORValue>,
	options?: { chunkSize?: number }
): AsyncIterable<Uint8Array>
```

If not provided, `chunkSize` defaults to 512 bytes. It's only a guideline; `encodeStream` won't break up individual CBOR values like strings or byte arrays that are larger than the provided chunk size.

### Decoding

```typescript
declare function decode(data: Uint8Array): CBORValue

declare function decodeStream(
	source: AsyncIterable<Uint8Array>
): AsyncIterable<CBORValue>
```

### Encoding length

You can measure the byte length that a given value will serialize to without actually allocating anything.

```ts
declare function encodingLength(value: CBORValue): number
```

## Unsafe integer handling

- JavaScript integers below `Number.MIN_SAFE_INTEGER` or greater than `Number.MAX_SAFE_INTEGER` will encode as CBOR floating-point numbers, as per the [suggestion in the CBOR spec](https://www.rfc-editor.org/rfc/rfc8949.html#name-converting-from-json-to-cbo).
- decoding **CBOR integers** less than `Number.MIN_SAFE_INTEGER` (major type 1 with uint64 argument greater than `2^53-2`) or greater than `Number.MAX_SAFE_INTEGER` (major type 0 with uint64 argument greater than `2^53-1`) **will throw an error**. The error will be an instance of `UnsafeIntegerError` and will have the out-of-range value as a readonly `.value: bigint` property.

```typescript
declare class UnsafeIntegerError extends RangeError {
	readonly value: bigint
	constructor(message: string, value: bigint)
}
```

## Value mapping

| CBOR major type              | JavaScript     | notes                                                    |
| ---------------------------- | -------------- | -------------------------------------------------------- |
| `0` (non-negative integer)   | `number`       | decoding throws an `UnsafeIntegerError` on unsafe values |
| `1` (negative integer)       | `number`       | decoding throws an `UnsafeIntegerError` on unsafe values |
| `2` (byte string)            | `Uint8Array`   |                                                          |
| `3` (UTF-8 string)           | `string`       |                                                          |
| `4` (array)                  | `Array`        |                                                          |
| `5` (map)                    | `Object`       | decoding throws an error on non-string keys              |
| `6` (tagged item)            | Unsupported ❌ |                                                          |
| `7` (floating-point numbers) | `number`       |                                                          |
| `7` (booleans)               | `boolean`      |                                                          |
| `7` (null)                   | `null`         |                                                          |
| `7` (undefined)              | `undefined`    |                                                          |

## Testing

Tests use [AVA](https://github.com/avajs/ava) and live in the [test](./test/) directory. Tests use [node-cbor](https://github.com/hildjj/node-cbor/) to validate encoding results. More tests are always welcome!

```
npm run test
```

## Benchmarks

Basic testing in [src/benchmarks.test.js](src/benchmarks.test.js) indicate that microcbor is about **2x as fast** as node-cbor at encoding and about **1.5x as fast** as node-cbor at decoding.

```
microcbor % npm run test -- test/benchmarks.test.js

> microcbor@0.2.0 test
> ava


  ✔ time encode() (382ms)
    ℹ microcbor: 63.44141721725464 (ms)
    ℹ node-cbor: 152.31466674804688 (ms)
  ✔ time decode() (164ms)
    ℹ microcbor: 72.13012504577637 (ms)
    ℹ node-cbor: 87.16287469863892 (ms)
  ─

  2 tests passed
```

## Contributing

I don't expect to add any additional features to this library. But if you have suggestions for better interfaces, find a bug, or would like to add more tests, please open an issue to discuss it!

## License

MIT © 2021 Joel Gustafson
