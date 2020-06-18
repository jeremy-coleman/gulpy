import { Buffer } from "safer-buffer"

// == UTF32-LE/BE codec. ==========================================================

export { Utf32Codec as _utf32 }

function Utf32Codec({ isLE }, iconv) {
  this.iconv = iconv
  this.bomAware = true
  this.isLE = isLE
}

export var utf32le = { type: "_utf32", isLE: true }
export var utf32be = { type: "_utf32", isLE: false }

// Aliases
export var ucs4le = "utf32le"

export var ucs4be = "utf32be"

Utf32Codec.prototype.encoder = Utf32Encoder
Utf32Codec.prototype.decoder = Utf32Decoder

// -- Encoding

class Utf32Encoder {
  constructor(options, { isLE }) {
    this.isLE = isLE
    this.highSurrogate = 0
  }

  write(str) {
    const src = Buffer.from(str, "ucs2")
    let dst = Buffer.alloc(src.length * 2)
    const write32 = this.isLE ? dst.writeUInt32LE : dst.writeUInt32BE
    let offset = 0

    for (let i = 0; i < src.length; i += 2) {
      const code = src.readUInt16LE(i)
      const isHighSurrogate = 0xd800 <= code && code < 0xdc00
      const isLowSurrogate = 0xdc00 <= code && code < 0xe000

      if (this.highSurrogate) {
        if (isHighSurrogate || !isLowSurrogate) {
          // There shouldn't be two high surrogates in a row, nor a high surrogate which isn't followed by a low
          // surrogate. If this happens, keep the pending high surrogate as a stand-alone semi-invalid character
          // (technically wrong, but expected by some applications, like Windows file names).
          write32.call(dst, this.highSurrogate, offset)
          offset += 4
        } else {
          // Create 32-bit value from high and low surrogates;
          const codepoint =
            (((this.highSurrogate - 0xd800) << 10) | (code - 0xdc00)) + 0x10000

          write32.call(dst, codepoint, offset)
          offset += 4
          this.highSurrogate = 0

          continue
        }
      }

      if (isHighSurrogate) this.highSurrogate = code
      else {
        // Even if the current character is a low surrogate, with no previous high surrogate, we'll
        // encode it as a semi-invalid stand-alone character for the same reasons expressed above for
        // unpaired high surrogates.
        write32.call(dst, code, offset)
        offset += 4
        this.highSurrogate = 0
      }
    }

    if (offset < dst.length) dst = dst.slice(0, offset)

    return dst
  }

  end() {
    // Treat any leftover high surrogate as a semi-valid independent character.
    if (!this.highSurrogate) return

    const buf = Buffer.alloc(4)

    if (this.isLE) buf.writeUInt32LE(this.highSurrogate, 0)
    else buf.writeUInt32BE(this.highSurrogate, 0)

    this.highSurrogate = 0

    return buf
  }
}

// -- Decoding

class Utf32Decoder {
  constructor(options, { isLE, iconv }) {
    this.isLE = isLE
    this.badChar = iconv.defaultCharUnicode.charCodeAt(0)
    this.overflow = null
  }

  write(src) {
    if (src.length === 0) return ""

    if (this.overflow) src = Buffer.concat([this.overflow, src])

    const goodLength = src.length - (src.length % 4)

    if (src.length !== goodLength) {
      this.overflow = src.slice(goodLength)
      src = src.slice(0, goodLength)
    } else this.overflow = null

    const dst = Buffer.alloc(goodLength)
    let offset = 0

    for (let i = 0; i < goodLength; i += 4) {
      let codepoint = this.isLE ? src.readUInt32LE(i) : src.readUInt32BE(i)

      if (codepoint < 0x10000) {
        // Simple 16-bit character
        dst.writeUInt16LE(codepoint, offset)
        offset += 2
      } else {
        if (codepoint > 0x10ffff) {
          // Not a valid Unicode codepoint
          dst.writeUInt16LE(this.badChar, offset)
          offset += 2
        } else {
          // Create high and low surrogates.
          codepoint -= 0x10000
          const high = 0xd800 | (codepoint >> 10)
          const low = 0xdc00 + (codepoint & 0x3ff)
          dst.writeUInt16LE(high, offset)
          offset += 2
          dst.writeUInt16LE(low, offset)
          offset += 2
        }
      }
    }

    return dst.slice(0, offset).toString("ucs2")
  }

  end() {
    this.overflow = null
  }
}

// == UTF-32 Auto codec =============================================================
// Decoder chooses automatically from UTF-32LE and UTF-32BE using BOM and space-based heuristic.
// Defaults to UTF-32LE. http://en.wikipedia.org/wiki/UTF-32
// Encoder/decoder default can be changed: iconv.decode(buf, 'utf32', {defaultEncoding: 'utf-32be'});

// Encoder prepends BOM (which can be overridden with (addBOM: false}).

export { Utf32AutoCodec as utf32 }

export { Utf32AutoCodec as ucs4 }

function Utf32AutoCodec(options, iconv) {
  this.iconv = iconv
}

Utf32AutoCodec.prototype.encoder = Utf32AutoEncoder
Utf32AutoCodec.prototype.decoder = Utf32AutoDecoder

// -- Encoding

class Utf32AutoEncoder {
  constructor(options = {}, { iconv }) {
    if (options.addBOM === undefined) options.addBOM = true

    this.encoder = iconv.getEncoder(options.defaultEncoding || "utf-32le", options)
  }

  write(str) {
    return this.encoder.write(str)
  }

  end() {
    return this.encoder.end()
  }
}

// -- Decoding

class Utf32AutoDecoder {
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

      if (this.initialBytesLen < 32)
        // We need more bytes to use space heuristic (see below)
        return ""

      // We have enough bytes -> detect endianness.
      const buf2 = Buffer.concat(this.initialBytes)

      const encoding = detectEncoding(buf2, this.options.defaultEncoding)
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
  let enc = defaultEncoding || "utf-32le"

  if (buf.length >= 4) {
    // Check BOM.
    if (buf.readUInt32BE(0) === 0xfeff)
      // UTF-32LE BOM
      enc = "utf-32be"
    else if (buf.readUInt32LE(0) === 0xfeff)
      // UTF-32LE BOM
      enc = "utf-32le"
    else {
      // No BOM found. Try to deduce encoding from initial content.
      // Using the wrong endian-ism for UTF-32 will very often result in codepoints that are beyond
      // the valid Unicode limit of 0x10FFFF. That will be used as the primary determinant.
      //
      // Further, we can suppose the content is mostly plain ASCII chars (U+00**).
      // So, we count ASCII as if it was LE or BE, and decide from that.
      let invalidLE = 0

      let invalidBE = 0
      let asciiCharsLE = 0 // Len is always even.

      let // Counts of chars in both positions
        asciiCharsBE = 0

      const _len = Math.min(buf.length - (buf.length % 4), 128)

      for (let i = 0; i < _len; i += 4) {
        const b0 = buf[i]
        const b1 = buf[i + 1]
        const b2 = buf[i + 2]
        const b3 = buf[i + 3]

        if (b0 !== 0 || b1 > 0x10) ++invalidBE
        if (b3 !== 0 || b2 > 0x10) ++invalidLE

        if (b0 === 0 && b1 === 0 && b2 === 0 && b3 !== 0) asciiCharsBE++
        if (b0 !== 0 && b1 === 0 && b2 === 0 && b3 === 0) asciiCharsLE++
      }

      if (invalidBE < invalidLE) enc = "utf-32be"
      else if (invalidLE < invalidBE) enc = "utf-32le"
      if (asciiCharsBE > asciiCharsLE) enc = "utf-32be"
      else if (asciiCharsBE < asciiCharsLE) enc = "utf-32le"
    }
  }

  return enc
}
