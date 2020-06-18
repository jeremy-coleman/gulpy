import * as fs from "fs"
import removeBomStream from "@local/remove-bom-stream"
import * as lazystream from "@local/lazystream"
import getCodec from "../../codecs"
import { DEFAULT_ENCODING } from "../../constants"
import { Config } from "../options"
import { resolveOption } from "../../resolve-option"

function streamFile(file, options: Pick<Config, "encoding" | "removeBOM">, onRead) {
  const encoding = resolveOption(options.encoding, file)
  const codec = getCodec(encoding)
  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  const filePath = file.path

  file.contents = new lazystream.Readable(() => {
    let contents = fs.createReadStream(filePath)

    if (encoding) {
      const removeBOM = codec.bomAware && resolveOption(options.removeBOM, file)

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
