import * as fo from "../../file-operations"
import getCodec from "../../codecs"
import { DEFAULT_ENCODING } from "../../constants"
import readStream from "../../src/read-contents/read-stream"
import { isNumber } from "lodash"

function writeStream(file, optResolver, onWritten) {
  const flags = fo.getFlags({
    overwrite: optResolver.resolve("overwrite", file),
    append: optResolver.resolve("append", file),
  })

  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)
  if (encoding && !codec) {
    return onWritten(new Error(`Unsupported encoding: ${encoding}`))
  }

  const opt = {
    mode: file.stat.mode,
    // TODO: need to test this
    flags,
  }

  // TODO: is this the best API?
  const outStream = fo.createWriteStream(file.path, opt, onFlush)

  let contents = file.contents

  if (encoding && encoding.enc !== DEFAULT_ENCODING) {
    contents = contents
      .pipe(getCodec(DEFAULT_ENCODING).decodeStream())
      .pipe(codec.encodeStream())
  }

  file.contents.once("error", onComplete)
  outStream.once("error", onComplete)
  outStream.once("finish", onComplete)

  // TODO: should this use a clone?
  contents.pipe(outStream)

  function onComplete(streamErr) {
    // Cleanup event handlers before closing
    file.contents.removeListener("error", onComplete)
    outStream.removeListener("error", onComplete)
    outStream.removeListener("finish", onComplete)

    // Need to guarantee the fd is closed before forwarding the error
    outStream.once("close", onClose)
    outStream.end()

    function onClose(closeErr) {
      onWritten(streamErr || closeErr)
    }
  }

  // Cleanup
  function onFlush(fd, callback) {
    // TODO: removing this before readStream because it replaces the stream
    file.contents.removeListener("error", onComplete)

    // TODO: this is doing sync stuff & the callback seems unnecessary
    readStream(file, { resolve }, complete)

    function resolve(key) {
      if (key === "encoding") {
        return encoding
      }
      if (key === "removeBOM") {
        return false
      }
      throw new Error(`Eek! stub resolver doesn't have ${key}`)
    }

    function complete() {
      if (!isNumber(fd)) {
        return callback()
      }

      fo.updateMetadata(fd, file, callback)
    }
  }
}

export default writeStream
