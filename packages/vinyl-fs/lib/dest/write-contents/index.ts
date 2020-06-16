import through from "through2"
import writeDir from "./write-dir"
import writeStream from "./write-stream"
import writeBuffer from "./write-buffer"
import writeSymbolicLink from "./write-symbolic-link"
import * as fo from "../../file-operations"

function writeContents(optResolver) {
  function writeFile(file, enc, callback) {
    // Write it as a symlink
    if (file.isSymbolic()) {
      return writeSymbolicLink(file, optResolver, onWritten)
    }

    // If directory then mkdirp it
    if (file.isDirectory()) {
      return writeDir(file, optResolver, onWritten)
    }

    // Stream it to disk yo
    if (file.isStream()) {
      return writeStream(file, optResolver, onWritten)
    }

    // Write it like normal
    if (file.isBuffer()) {
      return writeBuffer(file, optResolver, onWritten)
    }

    // If no contents then do nothing
    if (file.isNull()) {
      return onWritten()
    }

    // This is invoked by the various writeXxx modules when they've finished
    // writing the contents.
    function onWritten(writeErr) {
      const flags = fo.getFlags({
        overwrite: optResolver.resolve("overwrite", file),
        append: optResolver.resolve("append", file),
      })
      if (fo.isFatalOverwriteError(writeErr, flags)) {
        return callback(writeErr)
      }

      callback(null, file)
    }
  }

  return through.obj(writeFile)
}

export default writeContents
