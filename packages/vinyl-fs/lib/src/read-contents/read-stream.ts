import * as fs from "fs"
import removeBomStream from "remove-bom-stream"
import lazystream from "lazystream"
import getCodec from "../../codecs"
import { DEFAULT_ENCODING } from "../../constants"

function streamFile(file, optResolver, onRead) {
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)
  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  const filePath = file.path

  file.contents = new lazystream.Readable(() => {
    let contents = fs.createReadStream(filePath)

    if (encoding) {
      const removeBOM = codec.bomAware && optResolver.resolve("removeBOM", file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = contents
          .pipe(codec.decodeStream())
          .pipe(getCodec(DEFAULT_ENCODING).encodeStream())
      }

      if (removeBOM) {
        contents = contents.pipe(removeBomStream())
      }
    }

    return contents
  })

  onRead()
}

export default streamFile
