import through from "through2"
import sourcemap from "@local/vinyl-sourcemap"

function sourcemapStream(optResolver) {
  function addSourcemap(file, enc, callback) {
    const srcMap = optResolver.resolve("sourcemaps", file)

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
