import through from "through2"
import * as fo from "../file-operations"

function resolveSymlinks(optResolver) {
  // A stat property is exposed on file objects as a (wanted) side effect
  function resolveFile(file, _enc, callback) {
    fo.reflectLinkStat(file.path, file, onReflect)

    function onReflect(statErr) {
      if (statErr) {
        return callback(statErr)
      }

      if (!file.stat.isSymbolicLink()) {
        return callback(null, file)
      }

      const resolveSymlinks = optResolver.resolve("resolveSymlinks", file)

      if (!resolveSymlinks) {
        return callback(null, file)
      }

      // Get target's stats
      fo.reflectStat(file.path, file, onReflect)
    }
  }

  return through.obj(resolveFile)
}

export default resolveSymlinks
