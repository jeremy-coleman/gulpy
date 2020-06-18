import * as through from "through2"
import sourcemap from "@local/vinyl-sourcemap"
import { resolveOption } from "../resolve-option"
import { Config } from "./options"

function sourcemapStream(options: Config) {
  function addSourcemap(file, enc, callback) {
    const srcMap = resolveOption(options.sourcemaps, file)

    if (!srcMap) {
      return callback(null, file)
    }

    sourcemap.add(file, onAdd)

    function onAdd(sourcemapErr, updatedFile) {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      callback(null, updatedFile)
    }
  }

  return through.obj(addSourcemap)
}

export default sourcemapStream
