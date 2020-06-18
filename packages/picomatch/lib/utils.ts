import * as path from "path"
const win32 = process.platform === "win32"

import {
  REGEX_BACKSLASH,
  REGEX_REMOVE_BACKSLASH,
  REGEX_SPECIAL_CHARS,
  REGEX_SPECIAL_CHARS_GLOBAL,
} from "./constants"

export function isObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val)
}

export function hasRegexChars(str) {
  return REGEX_SPECIAL_CHARS.test(str)
}

export function isRegexChar(str) {
  return str.length === 1 && exports.hasRegexChars(str)
}

export function escapeRegex(str) {
  return str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1")
}

export function toPosixSlashes(str) {
  return str.replace(REGEX_BACKSLASH, "/")
}

export function removeBackslashes(str) {
  return str.replace(REGEX_REMOVE_BACKSLASH, match => (match === "\\" ? "" : match))
}

export function supportsLookbehinds() {
  const segs = process.version.slice(1).split(".").map(Number)
  if ((segs.length === 3 && segs[0] >= 9) || (segs[0] === 8 && segs[1] >= 10)) {
    return true
  }
  return false
}

export function isWindows(options) {
  if (options && typeof options.windows === "boolean") {
    return options.windows
  }
  return win32 === true || path.sep === "\\"
}

export function escapeLast(input, char, lastIdx) {
  const idx = input.lastIndexOf(char, lastIdx)
  if (idx === -1) return input
  if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1)
  return `${input.slice(0, idx)}\\${input.slice(idx)}`
}

export function removePrefix(input, state = {}) {
  let output = input
  if (output.startsWith("./")) {
    output = output.slice(2)
    state.prefix = "./"
  }
  return output
}

export function wrapOutput(input, state = {}, options = {}) {
  const prepend = options.contains ? "" : "^"
  const append = options.contains ? "" : "$"

  let output = `${prepend}(?:${input})${append}`
  if (state.negated === true) {
    output = `(?:^(?!${output}).*$)`
  }
  return output
}
