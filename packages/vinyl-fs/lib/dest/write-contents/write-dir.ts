import * as fs from "fs-extra"
import * as fo from "../../file-operations"

function writeDir(file, onWritten) {
  ;(fs as any).mkdirp(file.path, file.stat.mode).then(onMkdirp)

  function onMkdirp(mkdirpErr) {
    if (mkdirpErr) {
      return onWritten(mkdirpErr)
    }

    fs.open(file.path, "r", onOpen)
  }

  function onOpen(openErr, fd) {
    // If we don't have access, just move along
    if (isInaccessible(openErr)) {
      return fo.closeFd(null, fd, onWritten)
    }

    if (openErr) {
      return fo.closeFd(openErr, fd, onWritten)
    }

    fo.updateMetadata(fd, file, onUpdate)

    function onUpdate(updateErr) {
      fo.closeFd(updateErr, fd, onWritten)
    }
  }
}

function isInaccessible(err) {
  if (!err) {
    return false
  }

  if (err.code === "EACCES") {
    return true
  }

  return false
}

export default writeDir
