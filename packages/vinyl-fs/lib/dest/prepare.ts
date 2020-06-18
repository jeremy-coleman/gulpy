import * as path from "path"
import * as fs from "fs"
import Vinyl from "vinyl"
import through from "through2"
import { isFunction } from "lodash"

function prepareWrite(folderResolver, optResolver) {
  if (!folderResolver) {
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

    const outFolderPath = folderResolver.resolve("outFolder", file)
    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }
    const cwd = path.resolve(optResolver.resolve("cwd", file))
    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)

    // Wire up new properties
    file.cwd = cwd
    file.base = basePath
    file.path = writePath
    if (!file.isSymbolic()) {
      const mode = optResolver.resolve("mode", file)
      file.stat = file.stat || new fs.Stats()
      file.stat.mode = mode
    }

    cb(null, file)
  }

  return through.obj(normalize)
}

export default prepareWrite
