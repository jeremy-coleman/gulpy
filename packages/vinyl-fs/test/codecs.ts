import * as fs from "fs"
import { expect } from "chai"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump2"

import getCodec from "../lib/codecs"
import { DEFAULT_ENCODING } from "../lib/constants"
import testCodec from "./utils/codecs"
import testConstants from "./utils/test-constants"

const beNotBomInputPath = testConstants.beNotBomInputPath
const leNotBomInputPath = testConstants.leNotBomInputPath
const notBomContents = testConstants.notBomContents
const encodedInputPath = testConstants.encodedInputPath
const encodedContents = testConstants.encodedContents

describe("codecs", () => {
  it("exports a function", done => {
    expect(getCodec).to.be.a("function")
    done()
  })

  it("returns undefined for unsupported encoding", done => {
    const codec = getCodec("fubar42")
    expect(codec).to.be.undefined
    done()
  })

  it(`returns a proper codec for default encoding ${DEFAULT_ENCODING}`, done => {
    const codec = getCodec(DEFAULT_ENCODING)
    testCodec(codec)
    expect(codec.enc).toEqual(DEFAULT_ENCODING)
    expect(codec.bomAware).to.be.true
    done()
  })

  it("returns a proper codec for utf16be", done => {
    const codec = getCodec("utf16be")
    testCodec(codec)
    expect(codec.bomAware).to.be.true
    done()
  })

  it("can decode bytes from utf16be encoding to a string (buffer)", done => {
    const codec = getCodec("utf16be")
    const expected = notBomContents.replace("X", "BE")

    const result = codec.decode(fs.readFileSync(beNotBomInputPath))
    expect(result).to.exist
    expect(result).to.be.a("string")
    expect(result.slice(2)).toEqual(expected) // Ignore leading garbage
    done()
  })

  it("can decode bytes from utf16be encoding to a string (stream)", done => {
    const codec = getCodec("utf16be")
    const expected = notBomContents.replace("X", "BE")

    function assert(result) {
      expect(result).to.exist
      expect(result).to.be.a("string")
      expect(result.slice(2)).toEqual(expected) // Ignore leading garbage
    }

    pipe(
      [fs.createReadStream(beNotBomInputPath), codec.decodeStream(), concat(assert)],
      done
    )
  })

  it("can encode a string to bytes in utf16be encoding (buffer)", done => {
    const codec = getCodec("utf16be")
    const expected = fs.readFileSync(beNotBomInputPath)

    const result = codec.encode(notBomContents.replace("X", "BE"))
    expect(result).to.exist
    expect(result).to.be.a("object")
    expect(Buffer.isBuffer(result)).to.be.true
    expect(result).toMatch(expected.slice(4)) // Ignore leading garbage
    done()
  })

  it("can encode a string to bytes in utf16be encoding (stream)", done => {
    const codec = getCodec("utf16be")
    const expected = fs.readFileSync(beNotBomInputPath)

    function assert(result) {
      expect(result).to.exist
      expect(result).to.be.a("object")
      expect(Buffer.isBuffer(result)).to.be.true
      expect(result).toMatch(expected.slice(4)) // Ignore leading garbage
    }

    pipe(
      [
        from.obj([notBomContents.replace("X", "BE")]),
        codec.encodeStream(),
        concat(assert),
      ],
      done
    )
  })

  it("returns a proper codec for utf16le", done => {
    const codec = getCodec("utf16le")
    testCodec(codec)
    expect(codec.bomAware).to.be.true
    done()
  })

  it("can decode bytes from utf16le encoding to a string (buffer)", done => {
    const codec = getCodec("utf16le")
    const expected = notBomContents.replace("X", "LE")

    const result = codec.decode(fs.readFileSync(leNotBomInputPath))
    expect(result).to.exist
    expect(result).to.be.a("string")
    expect(result.slice(2)).toEqual(expected) // Ignore leading garbage
    done()
  })

  it("can decode bytes from utf16le encoding to a string (stream)", done => {
    const codec = getCodec("utf16le")
    const expected = notBomContents.replace("X", "LE")

    function assert(result) {
      expect(result).to.exist
      expect(result).to.be.a("string")
      expect(result.slice(2)).toEqual(expected) // Ignore leading garbage
    }

    pipe(
      [fs.createReadStream(leNotBomInputPath), codec.decodeStream(), concat(assert)],
      done
    )
  })

  it("can encode a string to bytes in utf16le encoding (buffer)", done => {
    const codec = getCodec("utf16le")
    const expected = fs.readFileSync(leNotBomInputPath)

    const result = codec.encode(notBomContents.replace("X", "LE"))
    expect(result).to.exist
    expect(result).to.be.a("object")
    expect(Buffer.isBuffer(result)).to.be.true
    expect(result).toMatch(expected.slice(4)) // Ignore leading garbage
    done()
  })

  it("can encode a string to bytes in utf16le encoding (stream)", done => {
    const codec = getCodec("utf16le")
    const expected = fs.readFileSync(leNotBomInputPath)

    function assert(result) {
      expect(result).to.exist
      expect(result).to.be.a("object")
      expect(Buffer.isBuffer(result)).to.be.true
      expect(result).toMatch(expected.slice(4)) // Ignore leading garbage
    }

    pipe(
      [
        from.obj([notBomContents.replace("X", "LE")]),
        codec.encodeStream(),
        concat(assert),
      ],
      done
    )
  })

  it("returns a proper codec for gb2312", done => {
    const codec = getCodec("gb2312")
    testCodec(codec)
    done()
  })

  it("can decode bytes from gb2312 encoding to a string (buffer)", done => {
    const codec = getCodec("gb2312")
    const expected = encodedContents

    const result = codec.decode(fs.readFileSync(encodedInputPath))
    expect(result).toEqual(expected)
    done()
  })

  it("can decode bytes from gb2312 encoding to a string (stream)", done => {
    const codec = getCodec("gb2312")
    const expected = encodedContents

    function assert(result) {
      expect(result).toEqual(expected)
    }

    pipe(
      [fs.createReadStream(encodedInputPath), codec.decodeStream(), concat(assert)],
      done
    )
  })

  it("can encode a string to bytes in gb2312 encoding (buffer)", done => {
    const codec = getCodec("gb2312")
    const expected = fs.readFileSync(encodedInputPath)

    const result = codec.encode(encodedContents)
    expect(result).toMatch(expected)
    done()
  })

  it("can encode a string to bytes in gb2312 encoding (stream)", done => {
    const codec = getCodec("gb2312")
    const expected = fs.readFileSync(encodedInputPath)

    function assert(result) {
      expect(result).toMatch(expected)
    }

    pipe([from.obj([encodedContents]), codec.encodeStream(), concat(assert)], done)
  })
})
