import * as through from "through2"
import sourcemap from "@local/vinyl-sourcemap"
import { isString } from "lodash"
import { Config } from "./options"
import { resolveOption } from "../resolve-option"

export function sourcemapStream(options: Config) {
  function saveSourcemap(file, enc, callback) {
    const srcMap = resolveOption(options.sourcemaps, file)

    if (!srcMap) {
      return callback(null, file)
    }

    const srcMapLocation = isString(srcMap) ? srcMap : undefined

    const onWrite = (sourcemapErr, updatedFile, sourcemapFile) => {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      this.push(updatedFile)
      if (sourcemapFile) {
        this.push(sourcemapFile)
      }

      callback()
    }
    sourcemap.write(file, srcMapLocation, onWrite)
  }

  return through.obj(saveSourcemap)
}

export default sourcemapStream
