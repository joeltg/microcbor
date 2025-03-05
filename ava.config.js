export default {
	files: ["./test/*.test.ts"],
	typescript: {
		compile: false,
		rewritePaths: {
			"test/": "test/lib/",
		},
	},
}
