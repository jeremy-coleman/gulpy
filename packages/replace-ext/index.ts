import * as path from "path"
import { isString } from "lodash"

export default replaceExt

function replaceExt(nPath: string, ext: string) {
  if (!isString(nPath)) {
    return nPath
  }

  if (nPath.length === 0) {
    return nPath
  }

  const nFileName = path.basename(nPath, path.extname(nPath)) + ext
  const nFilepath = path.join(path.dirname(nPath), nFileName)

  // Because `path.join` removes the head './' from the given path.
  // This removal can cause a problem when passing the result to `require` or
  // `import`.
  if (startsWithSingleDot(nPath)) {
    return "." + path.sep + nFilepath
  }

  return nFilepath
}

function startsWithSingleDot(fPath: string) {
  const first2chars = fPath.slice(0, 2)
  return first2chars === "." + path.sep || first2chars === "./"
}
