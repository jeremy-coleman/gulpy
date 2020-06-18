// Export Node.js internal encodings.

export default {
  // Encodings
  utf8: { type: "_internal", bomAware: true },
  cesu8: { type: "_internal", bomAware: true },
  unicode11utf8: "utf8",

  ucs2: { type: "_internal", bomAware: true },
  utf16le: "ucs2",

  binary: { type: "_internal" },
  base64: { type: "_internal" },
  hex: { type: "_internal" },

  // Codec.
  _internal: InternalCodec,
}

//------------------------------------------------------------------------------

function InternalCodec({ encodingName, bomAware }, { defaultCharUnicode }) {
  this.enc = encodingName
  this.bomAware = bomAware

  if (this.enc === "base64") this.encoder = InternalEncoderBase64
  else if (this.enc === "cesu8") {
    this.enc = "utf8" // Use utf8 for decoding.
    this.encoder = InternalEncoderCesu8

    // Add decoder for versions of Node not supporting CESU-8
    if (Buffer.from("eda0bdedb2a9", "hex").toString() !== "💩") {
      this.decoder = InternalDecoderCesu8
      this.defaultCharUnicode = defaultCharUnicode
    }
  }
}

InternalCodec.prototype.encoder = InternalEncoder
InternalCodec.prototype.decoder = InternalDecoder

//------------------------------------------------------------------------------

// We use node.js internal decoder. Its signature is the same as ours.
import { StringDecoder } from "string_decoder"

if (!StringDecoder.prototype.end)
  // Node v0.8 doesn't have this method.
  StringDecoder.prototype.end = () => {}

function InternalDecoder(options, { enc }) {
  StringDecoder.call(this, enc)
}

InternalDecoder.prototype = StringDecoder.prototype

//------------------------------------------------------------------------------
// Encoder is mostly trivial

class InternalEncoder {
  constructor(options, { enc }) {
    this.enc = enc
  }

  write(str) {
    return Buffer.from(str, this.enc)
  }

  end() {}
}

//------------------------------------------------------------------------------
// Except base64 encoder, which must keep its state.

class InternalEncoderBase64 {
  constructor(options, codec) {
    this.prevStr = ""
  }

  write(str) {
    str = this.prevStr + str
    const completeQuads = str.length - (str.length % 4)
    this.prevStr = str.slice(completeQuads)
    str = str.slice(0, completeQuads)

    return Buffer.from(str, "base64")
  }

  end() {
    return Buffer.from(this.prevStr, "base64")
  }
}

//------------------------------------------------------------------------------
// CESU-8 encoder is also special.

class InternalEncoderCesu8 {
  write(str) {
    const buf = Buffer.alloc(str.length * 3)
    let bufIdx = 0
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i)
      // Naive implementation, but it works because CESU-8 is especially easy
      // to convert from UTF-16 (which all JS strings are encoded in).
      if (charCode < 0x80) buf[bufIdx++] = charCode
      else if (charCode < 0x800) {
        buf[bufIdx++] = 0xc0 + (charCode >>> 6)
        buf[bufIdx++] = 0x80 + (charCode & 0x3f)
      } else {
        // charCode will always be < 0x10000 in javascript.
        buf[bufIdx++] = 0xe0 + (charCode >>> 12)
        buf[bufIdx++] = 0x80 + ((charCode >>> 6) & 0x3f)
        buf[bufIdx++] = 0x80 + (charCode & 0x3f)
      }
    }
    return buf.slice(0, bufIdx)
  }

  end() {}
}

//------------------------------------------------------------------------------
// CESU-8 decoder is not implemented in Node v4.0+

class InternalDecoderCesu8 {
  constructor(options, { defaultCharUnicode }) {
    this.acc = 0
    this.contBytes = 0
    this.accBytes = 0
    this.defaultCharUnicode = defaultCharUnicode
  }

  write(buf) {
    let acc = this.acc
    let contBytes = this.contBytes
    let accBytes = this.accBytes
    let res = ""
    for (let i = 0; i < buf.length; i++) {
      const curByte = buf[i]
      if ((curByte & 0xc0) !== 0x80) {
        // Leading byte
        if (contBytes > 0) {
          // Previous code is invalid
          res += this.defaultCharUnicode
          contBytes = 0
        }

        if (curByte < 0x80) {
          // Single-byte code
          res += String.fromCharCode(curByte)
        } else if (curByte < 0xe0) {
          // Two-byte code
          acc = curByte & 0x1f
          contBytes = 1
          accBytes = 1
        } else if (curByte < 0xf0) {
          // Three-byte code
          acc = curByte & 0x0f
          contBytes = 2
          accBytes = 1
        } else {
          // Four or more are not supported for CESU-8.
          res += this.defaultCharUnicode
        }
      } else {
        // Continuation byte
        if (contBytes > 0) {
          // We're waiting for it.
          acc = (acc << 6) | (curByte & 0x3f)
          contBytes--
          accBytes++
          if (contBytes === 0) {
            // Check for overlong encoding, but support Modified UTF-8 (encoding NULL as C0 80)
            if (accBytes === 2 && acc < 0x80 && acc > 0) res += this.defaultCharUnicode
            else if (accBytes === 3 && acc < 0x800) res += this.defaultCharUnicode
            // Actually add character.
            else res += String.fromCharCode(acc)
          }
        } else {
          // Unexpected continuation byte
          res += this.defaultCharUnicode
        }
      }
    }
    this.acc = acc
    this.contBytes = contBytes
    this.accBytes = accBytes
    return res
  }

  end() {
    let res = 0
    if (this.contBytes > 0) res += this.defaultCharUnicode
    return res
  }
}
