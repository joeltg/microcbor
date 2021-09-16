# microcbor

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme) [![license](https://img.shields.io/github/license/joeltg/microcbor)](https://opensource.org/licenses/MIT) [![NPM version](https://img.shields.io/npm/v/microcbor)](https://www.npmjs.com/package/microcbor) ![TypeScript types](https://img.shields.io/npm/types/microcbor) ![lines of code](https://img.shields.io/tokei/lines/github/joeltg/microcbor)

Encode JSON values as canonical CBOR.

microcbor is a [CBOR](https://cbor.io/) implementation that only supports the subset of CBOR that corresponds to JSON. This includes `null`, `true`, `false`, numbers, strings, objects (string keys only), and arrays. You can use microcbor to serialize JSON values to CBOR, and to deserialize them back into JSON values again. microcbor doesn't support decoding items that don't correspond to JSON values: no tags, byte strings, typed arrays, `undefined`, or indefinite length collections.

microcbor also follows the [deterministic CBOR encoding requirements](https://www.rfc-editor.org/rfc/rfc8949.html#core-det) - all floating-point numbers are serialized in the smallest possible size without losing precision, and object entries are always sorted by key in byte-wise lexicographic order. `NaN` is always serialized as `0xf97e00`.

This library is TypeScript-native, ESM-only, and has just one dependency ([joeltg/fp16](https://github.com/joeltg/fp16) for half-precision floats). It works in Node, the browser, and Deno.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [Encoding](#encoding)
  - [Decoding](#decoding)
  - [Strict mode](#strict-mode)
- [Limitations](#limitations)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Install

```
npm i microcbor
```

Or in Deno:

```typescript
import { encode, decode } from "https://cdn.skypack.dev/microcbor"
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

### Encoding

```typescript
interface EncodeOptions {
	strict?: true
	chunkSize?: number
}

declare function encode(value: any, options: EncodeOptions = {}): Uint8Array
```

`encode` accepts an `options` object that can have these properties:

| property     | type    | default |
| ------------ | ------- | ------- |
| `strictJSON` | boolean | false   |
| `chunkSize`  | number  | 512     |

### Decoding

```typescript
interface DecodeOptions {
	strict?: boolean
}

declare function decode<T = any>(
	data: Uint8Array,
	decode: DecodeOptions = {}
): T
```

`decode` accepts an `options` object that can have these properties:

| property     | type    | default |
| ------------ | ------- | ------- |
| `strictJSON` | boolean | false   |

### Strict mode

Technically, neither `NaN` nor `+/- Infinity` are valid JSON numbers. But microcbor functions as a direct interface between JavaScript and CBOR, so by default, you can encode them...

```javascript
import { encode } from "microcbor"

encode(NaN) // Uint8Array(3) [ 249, 126, 0 ]
encode(Infinity) // Uint8Array(3) [ 249, 124, 0 ]
encode(-Infinity) // Uint8Array(3) [ 249, 252, 0 ]
```

... and decode them...

```javascript
import { decode } from "microcbor"

decode(new Uint8Array([249, 126, 0])) // NaN
decode(new Uint8Array([249, 124, 0])) // Infinity
decode(new Uint8Array([249, 252, 0])) // -Infinity
```

If you don't want this behavior - for example, if it's important to validate that all of the values you decode are JSON-serializable - you can set `options.strict` to `true`, and microcbor will throw an error if it encounters `NaN` or `+/- Infinity`.

```javascript
import { encode } from "microcbor"

encode(NaN, { strictJSON: true })
// Uncaught Error: cannot encode NaN when strict mode is enabled
```

```javascript
import { decode } from "microcbor"

decode(new Uint8Array([249, 126, 0]), { strictJSON: true })
// Uncaught Error: cannot decode NaN when strict mode is enabled
```

For reference, `JSON.stringify` returns `"null"` when called with `NaN` or `+/- Infinity`.

## Limitations

JSON numbers can be arbitrarly large and have unlimited decimal precision. CBOR has explicit types for the standard fixed-size integer and float formats, and separate tags for [arbitrarily large integers](https://www.rfc-editor.org/rfc/rfc8949.html#name-bignums) and [unlimited-precision decimal values](https://www.rfc-editor.org/rfc/rfc8949.html#name-decimal-fractions-and-bigfl). Meanwhile, JavaScript can only represent numbers as 64-bit floats or BigInts. This means there are always tradeoffs in interfacing between JSON, CBOR, and JavaScript.

microcbor takes an opinionated, minimal stance:

- JavaScript integers below `Number.MIN_SAFE_INTEGER` or greater than `Number.MAX_SAFE_INTEGER` will encode as CBOR floating-point numbers, as per the [suggestion in the CBOR spec](https://www.rfc-editor.org/rfc/rfc8949.html#name-converting-from-json-to-cbo).
- decoding CBOR integers less than `Number.MIN_SAFE_INTEGER` (major type 1 with uint64 argument greater than `2^53-2`) or greater than `Number.MAX_SAFE_INTEGER` (major type 0 with uint64 argument greater than `2^53-1`) **will throw an error**. The error will be an instance of `UnsafeIntegerError` and will have the out-of-range value as a readonly `.value: bigint` property.

```typescript
declare class UnsafeIntegerError extends RangeError {
	readonly value: bigint
	constructor(message: string, value: bigint)
}
```

## Testing

Tests use [AVA 4](https://github.com/avajs/ava) (currently in alpha) and live in the [test](./test/) directory. Tests use [node-cbor](https://github.com/hildjj/node-cbor/) to validate encoding results. More tests are always welcome!

```
npm run test
```

## Contributing

I don't expect to add any additional features to this library. But if you have suggestions for better interfaces, find a bug, or would like to add more tests, please open an issue to discuss it!

## License

MIT © 2021 Joel Gustafson
