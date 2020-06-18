import * as through from "through2"
import { resolveOption } from "../resolve-option"
import { Config } from "./options"

function prepareRead(options: Config) {
  function normalize(file, _enc, callback) {
    const since = resolveOption(options.since, file)

    // Skip this file if since option is set and current file is too old
    if (file.stat && file.stat.mtime <= since) {
      return callback()
    }

    return callback(null, file)
  }

  return through.obj(normalize)
}

export default prepareRead
