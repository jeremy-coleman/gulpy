import * as fs from "fs"
import removeBomBuffer from "remove-bom-buffer"
import getCodec from "../../codecs"
import { DEFAULT_ENCODING } from "../../constants"

function bufferFile(file, optResolver, onRead) {
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)
  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  fs.readFile(file.path, onReadFile)

  function onReadFile(readErr, contents) {
    if (readErr) {
      return onRead(readErr)
    }

    if (encoding) {
      let removeBOM = codec.bomAware && optResolver.resolve("removeBOM", file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = codec.decode(contents)
        removeBOM = removeBOM && contents[0] === "\ufeff"
        contents = getCodec(DEFAULT_ENCODING).encode(contents)
      }

      if (removeBOM) {
        contents = removeBomBuffer(contents)
      }
    }

    file.contents = contents

    onRead()
  }
}

export default bufferFile
