import gs from "glob-stream"
import pumpify from "pumpify"
import toThrough from "@local/to-through"
import { resolve } from "./options"
import prepare from "./prepare"
import wrapVinyl from "./wrap-vinyl"
import sourcemap from "./sourcemap"
import readContents from "./read-contents"
import resolveSymlinks from "./resolve-symlinks"
import { isString } from "lodash"
import type { SourceOptions } from "../../../gulp"

function isValidGlob(glob: string | any[]) {
  return Array.isArray(glob) ? glob.every(isValidGlob) : isString(glob)
}

export function src(glob: string | string[], opt: Partial<SourceOptions>) {
  const options = resolve(opt)

  if (!isValidGlob(glob)) {
    throw Error(`Invalid glob argument: ${glob}`)
  }

  const streams = [
    gs(glob, options),
    wrapVinyl(),
    resolveSymlinks(options),
    prepare(options),
    readContents(options),
    sourcemap(options),
  ]

  const outputStream = pumpify.obj(streams)

  return toThrough(outputStream)
}
