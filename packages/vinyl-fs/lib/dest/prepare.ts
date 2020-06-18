import * as path from "path"
import * as fs from "fs"
import Vinyl from "vinyl"
import * as through from "through2"
import { isFunction } from "lodash"
import { resolveOption } from "../resolve-option"
import { Config } from "./options"
import type { File } from "vinyl"

function prepareWrite(
  { outFolder }: { outFolder: string | ((file: File) => string) },
  options: Config
) {
  if (!outFolder) {
    throw Error("Invalid output folder")
  }

  function normalize(file, _enc, cb) {
    if (!Vinyl.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `dest()`"))
    }

    // TODO: Remove this after people upgrade vinyl/transition from gulp-util
    if (!isFunction(file.isSymbolic)) {
      file = new Vinyl(file)
    }

    const outFolderPath = resolveOption(outFolder, file)
    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }
    const cwd = path.resolve(resolveOption(options.cwd, file))
    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)

    // Wire up new properties
    file.cwd = cwd
    file.base = basePath
    file.path = writePath
    if (!file.isSymbolic()) {
      const mode = resolveOption(options.mode, file)
      file.stat = file.stat || new fs.Stats()
      file.stat.mode = mode
    }

    cb(null, file)
  }

  return through.obj(normalize)
}

export default prepareWrite
