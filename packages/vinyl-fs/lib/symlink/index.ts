import * as pumpify from "pumpify"
import lead from "lead"
import * as mkdirpStream from "fs-mkdirp-stream"
import { resolve } from "./options"
import prepare from "./prepare"
import linkFile from "./link-file"
import { resolveOption } from "../resolve-option"
import type { SymlinkOptions } from "../../../gulp"

export function symlink(
  outFolder: string | ((file: File) => string),
  opt: SymlinkOptions
) {
  if (!outFolder) {
    throw Error(
      "Invalid symlink() folder argument.\n Please specify a non-empty string or a function."
    )
  }

  const optResolver = resolve(opt)

  function dirpath(file, callback) {
    const dirMode = resolveOption(optResolver.dirMode, file)
    callback(null, file.dirname, dirMode)
  }

  const stream = pumpify.obj(
    prepare(outFolder, optResolver),
    mkdirpStream.obj(dirpath),
    linkFile(optResolver)
  )

  // Sink the stream to start flowing
  return lead(stream)
}
