import gs from "glob-stream"
import pumpify from "pumpify"
import toThrough from "to-through"
import isValidGlob from "is-valid-glob"
import createResolver from "resolve-options"
import config from "./options"
import prepare from "./prepare"
import wrapVinyl from "./wrap-vinyl"
import sourcemap from "./sourcemap"
import readContents from "./read-contents"
import resolveSymlinks from "./resolve-symlinks"

export function src(glob, opt) {
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
