// Single-byte codec. Needs a 'chars' string parameter that contains 256 or 128 chars that
// correspond to encoded bytes (if 128 - then lower half is ASCII).

export { SBCSCodec as _sbcs }

function SBCSCodec(codecOptions, { defaultCharSingleByte }) {
  if (!codecOptions) throw Error("SBCS codec is called without the data.")

  // Prepare char buffer for decoding.
  if (
    !codecOptions.chars ||
    (codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256)
  )
    throw Error(
      `Encoding '${codecOptions.type}' has incorrect 'chars' (must be of len 128 or 256)`
    )

  if (codecOptions.chars.length === 128) {
    let asciiString = ""
    for (var i = 0; i < 128; i++) asciiString += String.fromCharCode(i)
    codecOptions.chars = asciiString + codecOptions.chars
  }

  this.decodeBuf = Buffer.from(codecOptions.chars, "ucs2")

  // Encoding buffer.
  const encodeBuf = Buffer.alloc(65536, defaultCharSingleByte.charCodeAt(0))

  for (var i = 0; i < codecOptions.chars.length; i++)
    encodeBuf[codecOptions.chars.charCodeAt(i)] = i

  this.encodeBuf = encodeBuf
}

SBCSCodec.prototype.encoder = SBCSEncoder
SBCSCodec.prototype.decoder = SBCSDecoder

class SBCSEncoder {
  constructor(options, { encodeBuf }) {
    this.encodeBuf = encodeBuf
  }

  write(str) {
    const buf = Buffer.alloc(str.length)
    for (let i = 0; i < str.length; i++) buf[i] = this.encodeBuf[str.charCodeAt(i)]

    return buf
  }

  end() {}
}

class SBCSDecoder {
  constructor(options, { decodeBuf }) {
    this.decodeBuf = decodeBuf
  }

  write(buf) {
    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
    const decodeBuf = this.decodeBuf
    const newBuf = Buffer.alloc(buf.length * 2)
    let idx1 = 0
    let idx2 = 0
    for (let i = 0; i < buf.length; i++) {
      idx1 = buf[i] * 2
      idx2 = i * 2
      newBuf[idx2] = decodeBuf[idx1]
      newBuf[idx2 + 1] = decodeBuf[idx1 + 1]
    }
    return newBuf.toString("ucs2")
  }

  end() {}
}
