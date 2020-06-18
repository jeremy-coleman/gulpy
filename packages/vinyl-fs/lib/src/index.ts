import gs from "glob-stream"
import pumpify from "pumpify"
import toThrough from "@local/to-through"
import createResolver from "@local/resolve-options"
import config from "./options"
import prepare from "./prepare"
import wrapVinyl from "./wrap-vinyl"
import sourcemap from "./sourcemap"
import readContents from "./read-contents"
import resolveSymlinks from "./resolve-symlinks"
import { isString } from "lodash"

function isValidGlob(glob: string | any[]) {
  return Array.isArray(glob) ? glob.every(isValidGlob) : isString(glob)
}

export function src(glob: string, opt) {
  const optResolver = createResolver(config, opt)

  if (!isValidGlob(glob)) {
    throw new Error(`Invalid glob argument: ${glob}`)
  }

  const streams = [
    gs(glob, opt),
    wrapVinyl(optResolver),
    resolveSymlinks(optResolver),
    prepare(optResolver),
    readContents(optResolver),
    sourcemap(optResolver),
  ]

  const outputStream = pumpify.obj(streams)

  return toThrough(outputStream)
}
