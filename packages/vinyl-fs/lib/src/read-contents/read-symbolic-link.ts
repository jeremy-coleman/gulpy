import * as fs from "fs"

function readLink(file, onRead) {
  fs.readlink(file.path, onReadlink)

  function onReadlink(readErr, target) {
    if (readErr) {
      return onRead(readErr)
    }

    // Store the link target path
    file.symlink = target

    onRead()
  }
}

export default readLink
