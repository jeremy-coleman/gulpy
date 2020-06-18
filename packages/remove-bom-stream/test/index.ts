import * as fs from "fs"
import * as path from "path"
import { expect } from "chai"
import miss from "mississippi"
import chunker from "stream-chunker"
import removeBomStream from "../"

const pipe = miss.pipe
const concat = miss.concat

describe("removeBomStream", () => {
  it("ignores UTF8 buffer without a BOM", done => {
    const filepath = path.join(__dirname, "./fixtures/test.txt")

    const expected = fs.readFileSync(filepath)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })

  it("removes the BOM from a UTF8 buffer", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf8.txt")

    const expected = fs.readFileSync(filepath).slice(3)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })

  it("handles small chunks", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf8.txt")

    const expected = fs.readFileSync(filepath).slice(3)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe(
      [fs.createReadStream(filepath), chunker(1), removeBomStream(), concat(assert)],
      done
    )
  })

  it("removes the BOM from a UTF8 buffer that is shorter than 7 chars", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf8-short.txt")

    const expected = fs.readFileSync(filepath).slice(3)

    function assert(data) {
      expect(data.length < 7).to.be.true
      expect(expected.length < 7).to.be.true
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })

  it("does not remove the BOM from a UTF16BE buffer", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf16be.txt")

    const expected = fs.readFileSync(filepath)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })

  it("does not remove the BOM from a UTF16BE buffer that is shorter than 7 chars", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf16be-short.txt")

    const expected = fs.readFileSync(filepath)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })

  it("does not remove the BOM from a UTF16LE buffer", done => {
    const filepath = path.join(__dirname, "./fixtures/bom-utf16le.txt")

    const expected = fs.readFileSync(filepath)

    function assert(data) {
      expect(data.equals(expected)).to.be.true
    }

    pipe([fs.createReadStream(filepath), removeBomStream(), concat(assert)], done)
  })
})
