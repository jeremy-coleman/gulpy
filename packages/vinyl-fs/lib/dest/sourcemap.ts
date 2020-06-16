import through from "through2"
import sourcemap from "vinyl-sourcemap"

function sourcemapStream(optResolver) {
  function saveSourcemap(file, enc, callback) {
    const self = this

    const srcMap = optResolver.resolve("sourcemaps", file)

    if (!srcMap) {
      return callback(null, file)
    }

    const srcMapLocation = typeof srcMap === "string" ? srcMap : undefined

    sourcemap.write(file, srcMapLocation, onWrite)

    function onWrite(sourcemapErr, updatedFile, sourcemapFile) {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      self.push(updatedFile)
      if (sourcemapFile) {
        self.push(sourcemapFile)
      }

      callback()
    }
  }

  return through.obj(saveSourcemap)
}

export default sourcemapStream