# microcbor

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme) [![license](https://img.shields.io/github/license/joeltg/microcbor)](https://opensource.org/licenses/MIT) [![NPM version](https://img.shields.io/npm/v/microcbor)](https://www.npmjs.com/package/microcbor) ![TypeScript types](https://img.shields.io/npm/types/microcbor) ![lines of code](https://img.shields.io/tokei/lines/github/joeltg/microcbor)

Encode JavaScript values as canonical CBOR.

microcbor is a minimal JavaScript [CBOR](https://cbor.io/) implementation featuring

- small footprint
- fast performance
- `Iterable` and `AsyncIterable` streaming APIs with "chunk recycling" encoding option
- [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)-compatible [TransformStream](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream) classes

microcbor follows the [deterministic CBOR encoding requirements](https://www.rfc-editor.org/rfc/rfc8949.html#core-det) - all floating-point numbers are serialized in the smallest possible size without losing precision, and object entries are always sorted by key in byte-wise utf-8 lexicographic order. `NaN` is always serialized as `0xf97e00`. **microcbor doesn't support tags, bigints, typed arrays, non-string keys, or indefinite-length collections.**

This library is TypeScript-native, ESM-only, and has just **one dependency** [joeltg/fp16](https://github.com/joeltg/fp16) for half-precision floats.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [CBOR Values](#cbor-values)
  - [Encoding](#encoding)
    - [`EncodeOptions`](#encodeoptions)
    - [`encodingLength`](#encodinglength)
    - [`encode`](#encode)
    - [`encodeIterable`](#encodeiterable)
    - [`encodeAsyncIterable`](#encodeasynciterable)
    - [`CBOREncoderStream`](#cborencoderstream)
  - [Decoding](#decoding)
    - [`decode`](#decode)
    - [`decodeIterable`](#decodeiterable)
    - [`decodeAsyncIterable`](#decodeasynciterable)
    - [`CBORDecoderStream`](#cbordecoderstream)
- [Value mapping](#value-mapping)
- [Testing](#testing)
- [Benchmarks](#benchmarks)
- [Contributing](#contributing)
- [License](#license)

## Install

```
npm i microcbor
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

### CBOR Values

```ts
declare type CBORValue = undefined | null | boolean | number | string | Uint8Array | CBORArray | CBORMap

interface CBORArray extends Array<CBORValue> {}
interface CBORMap {
  [key: string]: CBORValue
}
```

### Encoding

#### `EncodeOptions`

```ts
export interface EncodeOptions {
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
   * Maximum chunk size.
   * @default 4096
   */
  chunkSize?: number

  /**
   * Minimum bitsize for floating-point numbers: 16, 32, or 64.
   * @default 16
   */
  minFloatSize?: (typeof FloatSize)[keyof typeof FloatSize]
}
```

#### `encodingLength`

```ts
/**
 * Calculate the byte length that a value will encode into
 * without actually allocating anything.
 */
declare function encodingLength(value: CBORValue): number
```

#### `encode`

```ts
/**
 * Encode a single CBOR value.
 * options.chunkRecycling has no effect here.
 */
export function encode(value: CBORValue, options: EncodeOptions = {}): Uint8Array
```

#### `encodeIterable`

```ts
/** Encode an iterable of CBOR values into an iterable of Uint8Array chunks */
export function* encodeIterable(
	source: Iterable<CBORValue>,
	options: EncodeOptions = {},
): IterableIterator<Uint8Array>

```

#### `encodeAsyncIterable`

```ts
/** Encode an async iterable of CBOR values into an async iterable of Uint8Array chunks */
export async function* encodeAsyncIterable(
	source: AsyncIterable<CBORValue>,
	options: EncodeOptions = {},
): AsyncIterableIterator<Uint8Array>

```

#### `CBOREncoderStream`

```ts
/**
 * Encode a Web Streams API ReadableStream.
 * options.chunkRecycling has no effect here.
 */
export class CBOREncoderStream extends TransformStream<CBORValue, Uint8Array> {
  public constructor(options: EncodeOptions = {})
}
```

### Decoding

#### `decode`

```ts
/** Decode a single CBOR value. */
export function decode(data: Uint8Array): CBORValue
```

#### `decodeIterable`

```ts
/** Decode an iterable of Uint8Array chunks into an iterable of CBOR values */
export function* decodeIterable(source: Iterable<Uint8Array>): IterableIterator<CBORValue>

```

#### `decodeAsyncIterable`

```ts
/** Decode an async iterable of Uint8Array chunks into an async iterable of CBOR values */
export async function* decodeAsyncIterable(source: AsyncIterable<Uint8Array>): AsyncIterable<CBORValue>
```

#### `CBORDecoderStream`

```ts
/** Decode a Web Streams API ReadableStream. */
export class CBORDecoderStream extends TransformStream<Uint8Array, CBORValue> {
  public constructor()
}
```

## Unsafe integer handling

- JavaScript integers below `Number.MIN_SAFE_INTEGER` or greater than `Number.MAX_SAFE_INTEGER` will encode as CBOR floating-point numbers, as per the [suggestion in the CBOR spec](https://www.rfc-editor.org/rfc/rfc8949.html#name-converting-from-json-to-cbo).
- decoding **CBOR integers** less than `Number.MIN_SAFE_INTEGER` (major type 1 with uint64 argument greater than `2^53-2`) or greater than `Number.MAX_SAFE_INTEGER` (major type 0 with uint64 argument greater than `2^53-1`) **will throw an error**. The error will be an instance of `UnsafeIntegerError` and will have the out-of-range value as a readonly `.value: bigint` property.

```typescript
declare class UnsafeIntegerError extends RangeError {
  readonly value: bigint
}
```

## Value mapping

| CBOR major type              | JavaScript      | notes                                                    |
| ---------------------------- | --------------- | -------------------------------------------------------- |
| `0` (non-negative integer)   | `number`        | decoding throws an `UnsafeIntegerError` on unsafe values |
| `1` (negative integer)       | `number`        | decoding throws an `UnsafeIntegerError` on unsafe values |
| `2` (byte string)            | `Uint8Array`    |                                                          |
| `3` (UTF-8 string)           | `string`        |                                                          |
| `4` (array)                  | `Array`         |                                                          |
| `5` (map)                    | `Object`        | decoding throws an error on non-string keys              |
| `6` (tagged item)            | **Unsupported** |                                                          |
| `7` (floating-point numbers) | `number`        |                                                          |
| `7` (booleans)               | `boolean`       |                                                          |
| `7` (null)                   | `null`          |                                                          |
| `7` (undefined)              | `undefined`     |                                                          |

## Testing

Tests use [AVA](https://github.com/avajs/ava) and live in the [test](./test/) directory. Tests use [node-cbor](https://github.com/hildjj/node-cbor/) to validate encoding results. More tests are always welcome!

```
npm run test
```

## Comparison to node-cbor

- microcbor runs isomorphically on the web, in Node, and in Deno. node-cbor ships a separate cbor-web package.
- microcbor encodes `Uint8Array` values as CBOR byte strings (major type 2). node-cbor encodes `Uint8Array` values as tagged type arrays (major type 6 / RFC 8746), and encodes NodeJS `Buffer` values as CBOR byte strings (major type 2).
- microcbor uses async iterables for its streaming API. node-cbor uses NodeJS streams.
- microcbor is about **4x faster** than node-cbor at canonical encoding, ~2x faster than node-cbor's default non-canonical encoding, and ~1.5x faster than node-cbor at decoding.

```
microcbor % npm run test -- test/benchmarks.test.ts

> microcbor@0.4.0 test
> ava test/benchmarks.test.ts


  ✔ time encode() (237ms)
    ℹ microcbor: {
        avg: 0.2836770999999993,
        std: 0.1553461595001637,
      } (ms)
    ℹ node-cbor: {
        avg: 0.47247252999999945,
        std: 0.6099837601508338,
      } (ms)
    ℹ node-cbor (canonical): {
        avg: 0.9973837600000031,
        std: 1.203792591464195,
      } (ms)
    ℹ JSON.stringify: {
        avg: 0.009709539999999493,
        std: 0.0014329558361671918,
      } (ms)
  ✔ time decode()
    ℹ microcbor: {
        avg: 0.19635871000000235,
        std: 0.35634472331099276,
      } (ms)
    ℹ node-cbor: {
        avg: 0.35364794999999843,
        std: 0.31256985912702206,
      } (ms)
    ℹ JSON.parse: {
        avg: 0.018565019999997504,
        std: 0.004339636959421219,
      } (ms)
  ─

  2 tests passed
```

## Contributing

I don't expect to add any additional features to this library. But if you have suggestions for better interfaces, find a bug, or would like to add more tests, please open an issue to discuss it!

## License

MIT © 2021 Joel Gustafson
