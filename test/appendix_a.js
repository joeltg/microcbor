// https://github.com/cbor/test-vectors

export default [
	{
		hex: "00",
		decoded: 0,
	},
	{
		hex: "01",
		decoded: 1,
	},
	{
		hex: "0a",
		decoded: 10,
	},
	{
		hex: "17",
		decoded: 23,
	},
	{
		hex: "1818",
		decoded: 24,
	},
	{
		hex: "1819",
		decoded: 25,
	},
	{
		hex: "1864",
		decoded: 100,
	},
	{
		hex: "1903e8",
		decoded: 1000,
	},
	{
		hex: "1a000f4240",
		decoded: 1000000,
	},
	{
		hex: "1b000000e8d4a51000",
		decoded: 1000000000000,
	},
	{
		hex: "20",
		decoded: -1,
	},
	{
		hex: "29",
		decoded: -10,
	},
	{
		hex: "3863",
		decoded: -100,
	},
	{
		hex: "3903e7",
		decoded: -1000,
	},
	{
		hex: "f90000",
		decoded: 0,
		lossy: true,
	},
	{
		hex: "f98000",
		decoded: -0,
	},
	{
		hex: "f93c00",
		decoded: 1,
		lossy: true,
	},
	{
		hex: "fb3ff199999999999a",
		decoded: 1.1,
	},
	{
		hex: "f93e00",
		decoded: 1.5,
	},
	{
		hex: "f97bff",
		decoded: 65504,
		lossy: true,
	},
	{
		hex: "fa47c35000",
		decoded: 100000,
		lossy: true,
	},
	{
		hex: "fa7f7fffff",
		decoded: 3.4028234663852886e38,
	},
	{
		hex: "fb7e37e43c8800759c",
		decoded: 1.0e300,
	},
	{
		hex: "f90001",
		decoded: 5.960464477539063e-8,
	},
	{
		hex: "f90400",
		decoded: 6.103515625e-5,
	},
	{
		hex: "f9c400",
		decoded: -4,
		lossy: true,
	},
	{
		hex: "fbc010666666666666",
		decoded: -4.1,
	},
	{
		hex: "f97c00",
		decoded: Infinity,
	},
	{
		hex: "f97e00",
		decoded: NaN,
	},
	{
		hex: "f9fc00",
		decoded: -Infinity,
		lossy: true,
	},
	{
		hex: "fa7f800000",
		decoded: Infinity,
		lossy: true,
	},
	{
		hex: "fa7fc00000",
		decoded: NaN,
		lossy: true,
	},
	{
		hex: "faff800000",
		decoded: -Infinity,
		lossy: true,
	},
	{
		hex: "fb7ff0000000000000",
		decoded: Infinity,
		lossy: true,
	},
	{
		hex: "fb7ff8000000000000",
		decoded: NaN,
		lossy: true,
	},
	{
		hex: "fbfff0000000000000",
		decoded: -Infinity,
		lossy: true,
	},
	{
		hex: "f4",
		decoded: false,
	},
	{
		hex: "f5",
		decoded: true,
	},
	{
		hex: "f6",
		decoded: null,
	},
	{
		hex: "f7",
		decoded: undefined,
	},
	{
		hex: "60",
		decoded: "",
	},
	{
		hex: "6161",
		decoded: "a",
	},
	{
		hex: "6449455446",
		decoded: "IETF",
	},
	{
		hex: "62225c",
		decoded: '"\\',
	},
	{
		hex: "62c3bc",
		decoded: "ü",
	},
	{
		hex: "63e6b0b4",
		decoded: "水",
	},
	{
		hex: "64f0908591",
		decoded: "𐅑",
	},
	{
		hex: "80",
		decoded: [],
	},
	{
		hex: "83010203",
		decoded: [1, 2, 3],
	},
	{
		hex: "8301820203820405",
		decoded: [1, [2, 3], [4, 5]],
	},
	{
		hex: "98190102030405060708090a0b0c0d0e0f101112131415161718181819",
		decoded: [
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
			22, 23, 24, 25,
		],
	},
	{
		hex: "a0",
		decoded: {},
	},
	{
		hex: "a26161016162820203",
		decoded: { a: 1, b: [2, 3] },
	},
	{
		hex: "826161a161626163",
		decoded: ["a", { b: "c" }],
	},
	{
		hex: "a56161614161626142616361436164614461656145",
		decoded: { a: "A", b: "B", c: "C", d: "D", e: "E" },
	},
]
