import * as through from "through2"
import writeDir from "./write-dir"
import writeStream from "./write-stream"
import writeBuffer from "./write-buffer"
import writeSymbolicLink from "./write-symbolic-link"
import * as fo from "../../file-operations"
import type { Config } from "../options"
import { resolveOption } from "../../resolve-option"

function writeContents(options: Config) {
  function writeFile(file, enc, callback) {
    // Write it as a symlink
    if (file.isSymbolic()) {
      return writeSymbolicLink(file, options, onWritten)
    }

    // If directory then mkdirp it
    if (file.isDirectory()) {
      return writeDir(file, onWritten)
    }

    // Stream it to disk yo
    if (file.isStream()) {
      return writeStream(file, options, onWritten)
    }

    // Write it like normal
    if (file.isBuffer()) {
      return writeBuffer(file, options, onWritten)
    }

    // If no contents then do nothing
    if (file.isNull()) {
      return onWritten(null)
    }

    // This is invoked by the various writeXxx modules when they've finished
    // writing the contents.
    function onWritten(writeErr) {
      const flags = fo.getFlags({
        overwrite: resolveOption(options.overwrite, file),
        append: resolveOption(options.append, file),
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
