import * as fo from "../../file-operations"
import getCodec from "../../codecs"
import { DEFAULT_ENCODING } from "../../constants"

function writeBuffer(file, optResolver, onWritten) {
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
    flags,
  }

  let contents = file.contents

  if (encoding && codec.enc !== DEFAULT_ENCODING) {
    contents = getCodec(DEFAULT_ENCODING).decode(contents)
    contents = codec.encode(contents)
  }

  fo.writeFile(file.path, contents, opt, onWriteFile)

  function onWriteFile(writeErr, fd) {
    if (writeErr) {
      return fo.closeFd(writeErr, fd, onWritten)
    }

    fo.updateMetadata(fd, file, onUpdate)

    function onUpdate(updateErr) {
      fo.closeFd(updateErr, fd, onWritten)
    }
  }
}

export default writeBuffer
