import { Buffer } from "safer-buffer"

// Note: UTF16-LE (or UCS2) codec is Node.js native. See encodings/internal.js

// == UTF16-BE codec. ==========================================================

export { Utf16BECodec as utf16be }

function Utf16BECodec() {}

Utf16BECodec.prototype.encoder = Utf16BEEncoder
Utf16BECodec.prototype.decoder = Utf16BEDecoder
Utf16BECodec.prototype.bomAware = true

// -- Encoding

class Utf16BEEncoder {
  write(str) {
    const buf = Buffer.from(str, "ucs2")
    for (let i = 0; i < buf.length; i += 2) {
      const tmp = buf[i]
      buf[i] = buf[i + 1]
      buf[i + 1] = tmp
    }
    return buf
  }

  end() {}
}

// -- Decoding

class Utf16BEDecoder {
  constructor() {
    this.overflowByte = -1
  }

  write(buf) {
    if (buf.length == 0) return ""

    const buf2 = Buffer.alloc(buf.length + 1)
    let i = 0
    let j = 0

    if (this.overflowByte !== -1) {
      buf2[0] = buf[0]
      buf2[1] = this.overflowByte
      i = 1
      j = 2
    }

    for (; i < buf.length - 1; i += 2, j += 2) {
      buf2[j] = buf[i + 1]
      buf2[j + 1] = buf[i]
    }

    this.overflowByte = i == buf.length - 1 ? buf[buf.length - 1] : -1

    return buf2.slice(0, j).toString("ucs2")
  }

  end() {}
}

// == UTF-16 codec =============================================================
// Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.
// Defaults to UTF-16LE, as it's prevalent and default in Node.
// http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le
// Decoder default can be changed: iconv.decode(buf, 'utf16', {defaultEncoding: 'utf-16be'});

// Encoder uses UTF-16LE and prepends BOM (which can be overridden with addBOM: false).

export { Utf16Codec as utf16 }

function Utf16Codec(codecOptions, iconv) {
  this.iconv = iconv
}

Utf16Codec.prototype.encoder = Utf16Encoder
Utf16Codec.prototype.decoder = Utf16Decoder

// -- Encoding (pass-through)

class Utf16Encoder {
  constructor(options = {}, { iconv }) {
    if (options.addBOM === undefined) options.addBOM = true
    this.encoder = iconv.getEncoder("utf-16le", options)
  }

  write(str) {
    return this.encoder.write(str)
  }

  end() {
    return this.encoder.end()
  }
}

// -- Decoding

class Utf16Decoder {
  constructor(options, { iconv }) {
    this.decoder = null
    this.initialBytes = []
    this.initialBytesLen = 0

    this.options = options || {}
    this.iconv = iconv
  }

  write(buf) {
    if (!this.decoder) {
      // Codec is not chosen yet. Accumulate initial bytes.
      this.initialBytes.push(buf)
      this.initialBytesLen += buf.length

      if (this.initialBytesLen < 16)
        // We need more bytes to use space heuristic (see below)
        return ""

      // We have enough bytes -> detect endianness.
      var buf = Buffer.concat(this.initialBytes)

      const encoding = detectEncoding(buf, this.options.defaultEncoding)
      this.decoder = this.iconv.getDecoder(encoding, this.options)
      this.initialBytes.length = this.initialBytesLen = 0
    }

    return this.decoder.write(buf)
  }

  end() {
    if (!this.decoder) {
      const buf = Buffer.concat(this.initialBytes)
      const encoding = detectEncoding(buf, this.options.defaultEncoding)
      this.decoder = this.iconv.getDecoder(encoding, this.options)

      const res = this.decoder.write(buf)
      const trail = this.decoder.end()

      return trail ? res + trail : res
    }
    return this.decoder.end()
  }
}

function detectEncoding(buf, defaultEncoding) {
  let enc = defaultEncoding || "utf-16le"

  if (buf.length >= 2) {
    // Check BOM.
    if (buf[0] == 0xfe && buf[1] == 0xff)
      // UTF-16BE BOM
      enc = "utf-16be"
    else if (buf[0] == 0xff && buf[1] == 0xfe)
      // UTF-16LE BOM
      enc = "utf-16le"
    else {
      // No BOM found. Try to deduce encoding from initial content.
      // Most of the time, the content has ASCII chars (U+00**), but the opposite (U+**00) is uncommon.
      // So, we count ASCII as if it was LE or BE, and decide from that.
      let asciiCharsLE = 0 // Len is always even.

      let // Counts of chars in both positions
        asciiCharsBE = 0

      const _len = Math.min(buf.length - (buf.length % 2), 64)

      for (let i = 0; i < _len; i += 2) {
        if (buf[i] === 0 && buf[i + 1] !== 0) asciiCharsBE++
        if (buf[i] !== 0 && buf[i + 1] === 0) asciiCharsLE++
      }

      if (asciiCharsBE > asciiCharsLE) enc = "utf-16be"
      else if (asciiCharsBE < asciiCharsLE) enc = "utf-16le"
    }
  }

  return enc
}
