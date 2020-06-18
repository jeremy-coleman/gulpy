import { isGlob } from "@local/is-glob"
import { posix } from "path"

const pathPosixDirname = posix.dirname
const isWin32 = process.platform === "win32"

const slash = "/"
const backslash = /\\/g
const enclosure = /[\{\[].*[\/]*.*[\}\]]$/
const globby = /(^|[^\\])([\{\[]|\([^\)]+$)/
const escaped = /\\([\!\*\?\|\[\]\(\)\{\}])/g

interface Options {
  flipBackslashes?: boolean
}

export default globParent

export function globParent(str: string, opts: Options = {}) {
  const flipBackslashes = opts.flipBackslashes ?? true

  // flip windows path separators
  if (flipBackslashes && isWin32 && !str.includes(slash)) {
    str = str.replace(backslash, slash)
  }

  // special case for strings ending in enclosure containing path separator
  if (enclosure.test(str)) {
    str += slash
  }

  // preserves full path in case of trailing path separator
  str += "a"

  // remove path parts that are globby
  do {
    str = pathPosixDirname(str)
  } while (isGlob(str) || globby.test(str))

  // remove escape chars and return result
  return str.replace(escaped, "$1")
}
