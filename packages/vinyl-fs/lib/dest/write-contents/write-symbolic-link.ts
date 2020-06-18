import * as os from "os"
import * as path from "path"
import * as fo from "../../file-operations"

const isWindows = process.platform === "win32"

function writeSymbolicLink(file, optResolver, onWritten) {
  if (!file.symlink) {
    return onWritten(new Error("Missing symlink property on symbolic vinyl"))
  }

  const isRelative = optResolver.resolve("relativeSymlinks", file)
  const flags = fo.getFlags({
    overwrite: optResolver.resolve("overwrite", file),
    append: optResolver.resolve("append", file),
  })

  if (!isWindows) {
    // On non-Windows, just use 'file'
    return createLinkWithType("file")
  }

  fo.reflectStat(file.symlink, file, onReflect)

  function onReflect(statErr) {
    if (statErr && statErr.code !== "ENOENT") {
      return onWritten(statErr)
    }

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
    // Dangling links are always 'file'
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

    function onSymlink(symlinkErr) {
      if (symlinkErr) {
        return onWritten(symlinkErr)
      }

      fo.reflectLinkStat(file.path, file, onWritten)
    }
  }
}

export default writeSymbolicLink
