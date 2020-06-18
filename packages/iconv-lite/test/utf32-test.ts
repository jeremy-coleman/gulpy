import assert from "assert"
import exports from "../"
import { Iconv } from "iconv"
const testStr = "1aя中文☃💩"
const testStr2 = "❝Stray high \uD977😱 and low\uDDDD☔ surrogate values.❞"

const utf32leBuf = Buffer.from([
  0x31,
  0x00,
  0x00,
  0x00,
  0x61,
  0x00,
  0x00,
  0x00,
  0x4f,
  0x04,
  0x00,
  0x00,
  0x2d,
  0x4e,
  0x00,
  0x00,
  0x87,
  0x65,
  0x00,
  0x00,
  0x03,
  0x26,
  0x00,
  0x00,
  0xa9,
  0xf4,
  0x01,
  0x00,
])

const utf32beBuf = Buffer.from([
  0x00,
  0x00,
  0x00,
  0x31,
  0x00,
  0x00,
  0x00,
  0x61,
  0x00,
  0x00,
  0x04,
  0x4f,
  0x00,
  0x00,
  0x4e,
  0x2d,
  0x00,
  0x00,
  0x65,
  0x87,
  0x00,
  0x00,
  0x26,
  0x03,
  0x00,
  0x01,
  0xf4,
  0xa9,
])

const utf32leBOM = Buffer.from([0xff, 0xfe, 0x00, 0x00])
const utf32beBOM = Buffer.from([0x00, 0x00, 0xfe, 0xff])
const utf32leBufWithBOM = Buffer.concat([utf32leBOM, utf32leBuf])
const utf32beBufWithBOM = Buffer.concat([utf32beBOM, utf32beBuf])

const utf32leBufWithInvalidChar = Buffer.concat([
  utf32leBuf,
  Buffer.from([0x12, 0x34, 0x56, 0x78]),
])

const utf32beBufWithInvalidChar = Buffer.concat([
  utf32beBuf,
  Buffer.from([0x12, 0x34, 0x56, 0x78]),
])

const sampleStr = '<?xml version="1.0" encoding="UTF-8"?>\n<俄语>данные</俄语>'

let fromCodePoint = String.fromCodePoint

if (!fromCodePoint) {
  fromCodePoint = cp => {
    if (cp < 0x10000) return String.fromCharCode(cp)

    cp -= 0x10000

    return (
      String.fromCharCode(0xd800 | (cp >> 10)) +
      String.fromCharCode(0xdc00 + (cp & 0x3ff))
    )
  }
}

let allCharsStr = ""
const allCharsLEBuf = Buffer.alloc(0x10f800 * 4)
const allCharsBEBuf = Buffer.alloc(0x10f800 * 4)
let skip = 0

for (let i = 0; i <= 0x10f7ff; ++i) {
  if (i === 0xd800) skip = 0x800

  const cp = i + skip
  allCharsStr += fromCodePoint(cp)
  allCharsLEBuf.writeUInt32LE(cp, i * 4)
  allCharsBEBuf.writeUInt32BE(cp, i * 4)
}

describe("UTF-32LE codec", () => {
  it("encodes basic strings correctly", () => {
    assert.equal(
      exports.encode(testStr, "UTF32-LE").toString("hex"),
      utf32leBuf.toString("hex")
    )
  })

  it("decodes basic buffers correctly", () => {
    assert.equal(exports.decode(utf32leBuf, "ucs4le"), testStr)
  })

  it("decodes uneven length buffers with no error", () => {
    assert.equal(exports.decode(Buffer.from([0x61, 0, 0, 0, 0]), "UTF32-LE"), "a")
  })

  it("handles invalid surrogates gracefully", () => {
    const encoded = exports.encode(testStr2, "UTF32-LE")
    assert.equal(escape(exports.decode(encoded, "UTF32-LE")), escape(testStr2))
  })

  it("handles invalid Unicode codepoints gracefully", () => {
    assert.equal(exports.decode(utf32leBufWithInvalidChar, "utf-32le"), `${testStr}�`)
  })

  it("handles encoding all valid codepoints", () => {
    assert.deepEqual(exports.encode(allCharsStr, "utf-32le"), allCharsLEBuf)
    const nodeIconv = new Iconv("UTF-8", "UTF-32LE")
    const nodeBuf = nodeIconv.convert(allCharsStr)
    assert.deepEqual(nodeBuf, allCharsLEBuf)
  })

  it("handles decoding all valid codepoints", () => {
    assert.equal(exports.decode(allCharsLEBuf, "utf-32le"), allCharsStr)
    const nodeIconv = new Iconv("UTF-32LE", "UTF-8")
    const nodeStr = nodeIconv.convert(allCharsLEBuf).toString("utf8")
    assert.equal(nodeStr, allCharsStr)
  })
})

describe("UTF-32BE codec", () => {
  it("encodes basic strings correctly", () => {
    assert.equal(
      exports.encode(testStr, "UTF32-BE").toString("hex"),
      utf32beBuf.toString("hex")
    )
  })

  it("decodes basic buffers correctly", () => {
    assert.equal(exports.decode(utf32beBuf, "ucs4be"), testStr)
  })

  it("decodes uneven length buffers with no error", () => {
    assert.equal(exports.decode(Buffer.from([0, 0, 0, 0x61, 0]), "UTF32-BE"), "a")
  })

  it("handles invalid surrogates gracefully", () => {
    const encoded = exports.encode(testStr2, "UTF32-BE")
    assert.equal(escape(exports.decode(encoded, "UTF32-BE")), escape(testStr2))
  })

  it("handles invalid Unicode codepoints gracefully", () => {
    assert.equal(exports.decode(utf32beBufWithInvalidChar, "utf-32be"), `${testStr}�`)
  })

  it("handles encoding all valid codepoints", () => {
    assert.deepEqual(exports.encode(allCharsStr, "utf-32be"), allCharsBEBuf)
    const nodeIconv = new Iconv("UTF-8", "UTF-32BE")
    const nodeBuf = nodeIconv.convert(allCharsStr)
    assert.deepEqual(nodeBuf, allCharsBEBuf)
  })

  it("handles decoding all valid codepoints", () => {
    assert.equal(exports.decode(allCharsBEBuf, "utf-32be"), allCharsStr)
    const nodeIconv = new Iconv("UTF-32BE", "UTF-8")
    const nodeStr = nodeIconv.convert(allCharsBEBuf).toString("utf8")
    assert.equal(nodeStr, allCharsStr)
  })
})

describe("UTF-32 general codec", () => {
  it("adds BOM when encoding, defaults to UTF-32LE", () => {
    assert.equal(
      exports.encode(testStr, "utf-32").toString("hex"),
      utf32leBOM.toString("hex") + utf32leBuf.toString("hex")
    )
  })

  it("doesn't add BOM and uses UTF-32BE when specified", () => {
    assert.equal(
      exports
        .encode(testStr, "ucs4", { addBOM: false, defaultEncoding: "ucs4be" })
        .toString("hex"),
      utf32beBuf.toString("hex")
    )
  })

  it("correctly decodes UTF-32LE using BOM", () => {
    assert.equal(exports.decode(utf32leBufWithBOM, "utf-32"), testStr)
  })

  it("correctly decodes UTF-32LE without BOM", () => {
    assert.equal(
      exports.decode(exports.encode(sampleStr, "utf-32-le"), "utf-32"),
      sampleStr
    )
  })

  it("correctly decodes UTF-32BE using BOM", () => {
    assert.equal(
      exports.decode(utf32beBufWithBOM, "utf-32", { stripBOM: false }),
      `\uFEFF${testStr}`
    )
  })

  it("correctly decodes UTF-32BE without BOM", () => {
    assert.equal(
      exports.decode(exports.encode(sampleStr, "utf-32-be"), "utf-32"),
      sampleStr
    )
  })
})

// Utility function to make bad matches easier to visualize.
function escape(s) {
  const sb = []

  for (let i = 0; i < s.length; ++i) {
    const cc = s.charCodeAt(i)

    if (32 <= cc && cc < 127 && cc !== 0x5c) sb.push(s.charAt(i))
    else {
      let h = s.charCodeAt(i).toString(16).toUpperCase()
      while (
        h.length < 4 // No String.repeat in old versions of Node!
      )
        h = `0${h}`

      sb.push(`\\u${h}`)
    }
  }

  return sb.join("")
}
