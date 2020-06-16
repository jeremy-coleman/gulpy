import { Transform } from "stream"
import mkdirp from "./mkdirp"
import { isString } from "lodash-es"

function toFunction(dirpath) {
  function stringResolver(chunk, callback) {
    callback(null, dirpath)
  }

  return stringResolver
}

function mkdirpStream(resolver) {
  // Handle resolver that's just a dirpath
  if (isString(resolver)) {
    resolver = toFunction(resolver)
  }

  return new Transform({
    transform(chunk, callback) {
      const onDirpath = (dirpathErr, dirpath, mode) => {
        if (dirpathErr) {
          return this.destroy(dirpathErr)
        }

        mkdirp(dirpath, mode, onMkdirp)
      }

      const onMkdirp = mkdirpErr => {
        if (mkdirpErr) {
          return this.destroy(mkdirpErr)
        }

        this.push(chunk)
      }
      resolver(chunk, onDirpath)
    },
  })
}

export default mkdirpStream
