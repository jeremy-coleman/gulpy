import * as fs from "fs"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import babel from "@rollup/plugin-babel"
import alias from "@rollup/plugin-alias"
import prettier from "rollup-plugin-prettier"

const internal = fs.readdirSync("packages").concat("lodash-es")
const extensions = [".js", ".ts"]

export default {
  input: "packages/gulp/index.ts",
  external: module => !internal.includes(module) && !module.startsWith("."),
  output: {
    file: "packages/gulpy/index.js",
    format: "cjs",
  },
  plugins: [
    alias({
      entries: {
        "lodash-es": "lodash",
        "readable-stream": "stream",
      },
    }),
    resolve({ extensions }),
    commonjs(),
    babel({
      extensions,
      comments: false,
      babelHelpers: "bundled",
      plugins: [
        ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
        ["@babel/plugin-proposal-nullish-coalescing-operator", { loose: true }],
        "@babel/plugin-proposal-optional-catch-binding",
        "@babel/plugin-proposal-optional-chaining",
        ["@babel/plugin-proposal-class-properties", { loose: true }],
        "babel-plugin-minify-constant-folding",
      ],
    }),
    prettier({
      parser: "babel",
    }),
  ],
}
