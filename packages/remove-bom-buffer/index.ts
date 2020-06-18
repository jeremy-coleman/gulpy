/**
 * remove-bom-buffer <https://github.com/jonschlinkert/remove-bom-buffer>
 *
 * Copyright (c) 2015-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import isUTF8 from "@local/is-utf8"

function matchBOM(buf: Buffer) {
  return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
}

function maybeUTF8(buf: Buffer) {
  // Only "maybe" because we aren't sniffing the whole buffer
  return isUTF8(buf.slice(3, 7))
}

export default removeBOM

export function removeBOM(buf: Buffer) {
  if (matchBOM(buf) && maybeUTF8(buf)) {
    return buf.slice(3)
  }
  return buf
}
