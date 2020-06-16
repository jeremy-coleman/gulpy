import File from "vinyl"
import through from "through2"

function wrapVinyl() {
  function wrapFile(globFile, enc, callback) {
    const file = new File(globFile)

    callback(null, file)
  }

  return through.obj(wrapFile)
}

export default wrapVinyl
