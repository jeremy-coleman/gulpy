import * as path from "path"
import isNegated from "@local/is-negated-glob"
import { isAbsolute } from "path"
import { last } from "lodash"

interface Options {
  cwd?: string
  root?: string
}

export default toAbsoluteGlob

export function toAbsoluteGlob(glob: string, opts?: Options): string {
  // ensure cwd is absolute
  let cwd = path.resolve(opts?.cwd ?? process.cwd())
  cwd = unix(cwd)

  let rootDir = opts?.root
  // if `options.root` is defined, ensure it's absolute
  if (rootDir) {
    rootDir = unix(rootDir)
    if (process.platform === "win32" || !isAbsolute(rootDir)) {
      rootDir = unix(path.resolve(rootDir))
    }
  }

  // trim starting ./ from glob patterns
  if (glob.slice(0, 2) === "./") {
    glob = glob.slice(2)
  }

  // when the glob pattern is only a . use an empty string
  if (glob.length === 1 && glob === ".") {
    glob = ""
  }

  // store last character before glob is modified
  const suffix = glob.slice(-1)

  // check to see if glob is negated (and not a leading negated-extglob)
  const ing = isNegated(glob)
  glob = ing.pattern

  // make glob absolute
  if (rootDir && glob.charAt(0) === "/") {
    glob = join(rootDir, glob)
  } else if (!isAbsolute(glob) || glob.slice(0, 1) === "\\") {
    glob = join(cwd, glob)
  }

  // if glob had a trailing `/`, re-add it now in case it was removed
  if (suffix === "/" && glob.slice(-1) !== "/") {
    glob += "/"
  }

  // re-add leading `!` if it was removed
  return ing.negated ? `!${glob}` : glob
}

function unix(filepath: string) {
  return filepath.replace(/\\/g, "/")
}

function join(dir: string, glob: string) {
  if (last(dir) === "/") {
    dir = dir.slice(0, -1)
  }
  if (glob[0] === "/") {
    glob = glob.slice(1)
  }
  if (!glob) return dir
  return `${dir}/${glob}`
}
