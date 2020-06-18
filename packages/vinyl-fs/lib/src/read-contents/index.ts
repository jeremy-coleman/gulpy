import * as through from "through2"
import readStream from "./read-stream"
import readBuffer from "./read-buffer"
import readSymbolicLink from "./read-symbolic-link"
import { Config } from "../options"
import { resolveOption } from "../../resolve-option"

function readContents(options: Config) {
  function readFile(file, enc, callback) {
    // Skip reading contents if read option says so
    const read = resolveOption(options.read, file)
    if (!read) {
      return callback(null, file)
    }

    // Don't fail to read a directory
    if (file.isDirectory()) {
      return onRead(null)
    }

    // Process symbolic links included with `resolveSymlinks` option
    if (file.stat && file.stat.isSymbolicLink()) {
      return readSymbolicLink(file, onRead)
    }

    // Read and pass full contents
    const buffer = resolveOption(options.buffer, file)
    if (buffer) {
      return readBuffer(file, options, onRead)
    }

    // Don't buffer anything - just pass streams
    return readStream(file, options, onRead)

    // This is invoked by the various readXxx modules when they've finished
    // reading the contents.
    function onRead(readErr) {
      if (readErr) {
        return callback(readErr)
      }
      callback(null, file)
    }
  }

  return through.obj(readFile)
}

export default readContents
