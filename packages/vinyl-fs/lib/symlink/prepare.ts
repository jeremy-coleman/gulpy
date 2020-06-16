import * as path from "path"
import * as fs from "fs"
import Vinyl from "vinyl"
import through from "through2"

function prepareSymlink(folderResolver, optResolver) {
  if (!folderResolver) {
    throw new Error("Invalid output folder")
  }

  function normalize(file, enc, cb) {
    if (!Vinyl.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `symlink()`"))
    }

    // TODO: Remove this after people upgrade vinyl/transition from gulp-util
    if (typeof file.isSymbolic !== "function") {
      file = new Vinyl(file)
    }

    const cwd = path.resolve(optResolver.resolve("cwd", file))

    const outFolderPath = folderResolver.resolve("outFolder", file)
    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }
    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)

    // Wire up new properties
    // Note: keep the target stats for now, we may need them in link-file
    file.stat = file.stat || new fs.Stats()
    file.cwd = cwd
    file.base = basePath
    // This is the path we are linking *TO*
    file.symlink = file.path
    file.path = writePath
    // We have to set contents to null for a link
    // Otherwise `isSymbolic()` returns false
    file.contents = null

    cb(null, file)
  }

  return through.obj(normalize)
}

export default prepareSymlink
