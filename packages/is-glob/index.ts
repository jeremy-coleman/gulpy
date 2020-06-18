/*!
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import { isExtGlob } from "./is-extglob"
import { isString } from "lodash"

const chars = { "{": "}", "(": ")", "[": "]" }
const strictRegex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/
const relaxedRegex = /\\(.)|(^!|[*?{}()[\]]|\(\?)/

export default isGlob

export function isGlob(str: string, options = { strict: true }) {
  if (!isString(str) || str === "") {
    return false
  }

  if (isExtGlob(str)) {
    return true
  }

  let regex = strictRegex
  let match: RegExpExecArray | null

  // optionally relax regex
  if (options?.strict === false) {
    regex = relaxedRegex
  }

  while ((match = regex.exec(str))) {
    if (match[2]) return true
    let idx = match.index + match[0].length

    // if an open bracket/brace/paren is escaped,
    // set the index to the next closing character
    const open = match[1]
    const close = open ? chars[open] : null
    if (open && close) {
      const n = str.indexOf(close, idx)
      if (n !== -1) {
        idx = n + 1
      }
    }

    str = str.slice(idx)
  }
  return false
}
