const path = require("path");

module.exports = {
	entry: "./index.ts",
	target: "node",
	mode: "production",
	devtool: false, // Disable source maps to save memory
	externals: [
		// Exclude all node_modules from bundle
		function (context, request, callback) {
			if (/^[a-z][a-z/.\-0-9]*$/i.test(request)) {
				return callback(null, "commonjs " + request);
			}
			callback();
		},
	],
	output: {
		filename: "server.js",
		path: path.join(__dirname, "dist"),
		libraryTarget: "commonjs",
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".json"],
		modules: ["./node_modules", "node_modules"],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: [
					{
						loader: "ts-loader",
						options: {
							transpileOnly: true, // Skip type checking during build
							experimentalWatchApi: true,
						},
					},
				],
				exclude: /node_modules/,
			},
		],
	},
	optimization: {
		minimize: true,
		nodeEnv: false,
	},
	performance: {
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000,
	},
};
