import through from "through2"

function prepareRead(optResolver) {
  function normalize(file, enc, callback) {
    const since = optResolver.resolve("since", file)

    // Skip this file if since option is set and current file is too old
    if (file.stat && file.stat.mtime <= since) {
      return callback()
    }

    return callback(null, file)
  }

  return through.obj(normalize)
}

export default prepareRead
