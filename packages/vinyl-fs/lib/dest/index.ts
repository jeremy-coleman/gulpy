import lead from "lead"
import * as pumpify from "pumpify"
import * as mkdirpStream from "fs-mkdirp-stream"
import { resolve } from "./options"
import prepare from "./prepare"
import sourcemap from "./sourcemap"
import writeContents from "./write-contents"
import type { File } from "vinyl"
import type { DestOptions } from "../../../gulp"
import { resolveOption } from "../resolve-option"

export function dest(outFolder: string | ((file: File) => string), opt: DestOptions) {
  if (!outFolder) {
    throw Error(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
  }

  const options = resolve(opt)

  function dirpath(file, callback) {
    const dirMode = resolveOption(options.dirMode, file)
    callback(null, file.dirname, dirMode)
  }

  const saveStream = pumpify.obj(
    prepare({ outFolder }, options),
    sourcemap(options),
    mkdirpStream.obj(dirpath),
    writeContents(options)
  )

  // Sink the output stream to start flowing
  return lead(saveStream)
}
