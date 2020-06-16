import * as os from "os"
import * as path from "path"
import through from "through2"
import * as fo from "../file-operations"

const isWindows = os.platform() === "win32"

function linkStream(optResolver) {
  function linkFile(file, _enc, callback) {
    const isRelative = optResolver.resolve("relativeSymlinks", file)
    const flags = fo.getFlags({
      overwrite: optResolver.resolve("overwrite", file),
      append: false,
    })

    if (!isWindows) {
      // On non-Windows, just use 'file'
      return createLinkWithType("file")
    }

    fo.reflectStat(file.symlink, file, onReflectTarget)

    function onReflectTarget(statErr) {
      if (statErr && statErr.code !== "ENOENT") {
        return callback(statErr)
      }
      // If target doesn't exist, the vinyl will still carry the target stats.
      // Let's use those to determine which kind of dangling link to create.

      // This option provides a way to create a Junction instead of a
      // Directory symlink on Windows. This comes with the following caveats:
      // * NTFS Junctions cannot be relative.
      // * NTFS Junctions MUST be directories.
      // * NTFS Junctions must be on the same file system.
      // * Most products CANNOT detect a directory is a Junction:
      //    This has the side effect of possibly having a whole directory
      //    deleted when a product is deleting the Junction directory.
      //    For example, JetBrains product lines will delete the entire contents
      //    of the TARGET directory because the product does not realize it's
      //    a symlink as the JVM and Node return false for isSymlink.

      // This function is Windows only, so we don't need to check again
      const useJunctions = optResolver.resolve("useJunctions", file)

      const dirType = useJunctions ? "junction" : "dir"
      const type = !statErr && file.isDirectory() ? dirType : "file"

      createLinkWithType(type)
    }

    function createLinkWithType(type) {
      // This is done after prepare() to use the adjusted file.base property
      if (isRelative && type !== "junction") {
        file.symlink = path.relative(file.base, file.symlink)
      }

      const opts = {
        flags,
        type,
      }
      fo.symlink(file.symlink, file.path, opts, onSymlink)
    }

    function onSymlink(symlinkErr) {
      if (symlinkErr) {
        return callback(symlinkErr)
      }

      fo.reflectLinkStat(file.path, file, onReflectLink)
    }

    function onReflectLink(reflectErr) {
      if (reflectErr) {
        return callback(reflectErr)
      }

      callback(null, file)
    }
  }

  return through.obj(linkFile)
}

export default linkStream
