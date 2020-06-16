/* eslint-disable new-cap */

import iconv from "iconv-lite"

import through from "through2"
import { DEFAULT_ENCODING } from "./constants"

class Codec {
  codec
  enc
  bomAware
  constructor(codec, encoding) {
    this.codec = codec
    this.enc = codec.enc || encoding
    this.bomAware = codec.bomAware || false
  }

  encode(str) {
    const encoder = getEncoder(this.codec)
    const buf = encoder.write(str)
    const end = encoder.end()
    return end && end.length > 0 ? Buffer.concat(buf, end) : buf
  }

  encodeStream() {
    const encoder = getEncoder(this.codec)
    return through(
      { decodeStrings: false },
      function (str, enc, cb) {
        const buf = encoder.write(str)
        if (buf && buf.length) {
          this.push(buf)
        }
        cb()
      },
      function (cb) {
        const buf = encoder.end()
        if (buf && buf.length) {
          this.push(buf)
        }
        cb()
      }
    )
  }

  decode(buf) {
    const decoder = getDecoder(this.codec)
    const str = decoder.write(buf)
    const end = decoder.end()
    return end ? str + end : str
  }

  decodeStream() {
    const decoder = getDecoder(this.codec)
    return through(
      { encoding: DEFAULT_ENCODING },
      function (buf, enc, cb) {
        const str = decoder.write(buf)
        if (str && str.length) {
          this.push(str, DEFAULT_ENCODING)
        }
        cb()
      },
      function (cb) {
        const str = decoder.end()
        if (str && str.length) {
          this.push(str, DEFAULT_ENCODING)
        }
        cb()
      }
    )
  }
}

function getEncoder(codec) {
  return new codec.encoder(null, codec)
}

function getDecoder(codec) {
  return new codec.decoder(null, codec)
}

const cache = {}

function getCodec(encoding) {
  let codec = cache[encoding]
  if (!!codec || !encoding || cache.hasOwnProperty(encoding)) {
    return codec
  }

  try {
    codec = new Codec(iconv.getCodec(encoding), encoding)
  } catch (err) {
    // Unsupported codec
  }

  cache[encoding] = codec
  return codec
}

// Pre-load default encoding
getCodec(DEFAULT_ENCODING)

export default getCodec
