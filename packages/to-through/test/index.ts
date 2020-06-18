import { expect } from "chai"
import miss from "mississippi"
import toThrough from "../"

const from = miss.from
const pipe = miss.pipe
const concat = miss.concat

describe("toThrough (buffer mode)", () => {
  // These tests ensure it automatically detects buffer mode

  const preContents = ["from", " ", "upstream", " "]
  const contents = ["hello", " ", "world", " ", "123"]

  it("can wrap a Readable and be used as a Readable", done => {
    const readable = from(contents)

    function assert(result) {
      expect(result).toEqual(contents.join(""))
    }

    pipe([toThrough(readable), concat(assert)], done)
  })

  it("can wrap a Readable and be used as a Transform", done => {
    const readable = from(contents)

    function assert(result) {
      expect(result).toEqual(contents.join(""))
    }

    pipe([from([]), toThrough(readable), concat(assert)], done)
  })

  it("passes through all upstream before readable", done => {
    const readable = from(contents)

    function assert(result) {
      expect(result).toEqual(preContents.concat(contents).join(""))
    }

    pipe([from(preContents), toThrough(readable), concat(assert)], done)
  })

  it("re-emits errors from readable", done => {
    const readable = from([new Error("boom")])

    function assert(err) {
      expect(err).toExist()
      expect(err.message).to.equal("boom")
      done()
    }

    pipe([from(preContents), toThrough(readable), concat()], assert)
  })

  it("does not flush the stream if not piped before nextTick", done => {
    const readable = from(contents)

    const wrapped = toThrough(readable)

    function assert(result) {
      expect(result).toEqual(preContents.concat(contents).join(""))
    }

    process.nextTick(() => {
      pipe([from(preContents), wrapped, concat(assert)], done)
    })
  })
})

describe("toThrough (object mode)", () => {
  // These tests ensure it automatically detects objectMode

  const preContents = [{ value: -2 }, { value: -1 }, { value: 0 }]
  const contents = [
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
    { value: 6 },
    { value: 7 },
    { value: 8 },
    { value: 9 },
    { value: 10 },
    { value: 11 },
    { value: 12 },
    { value: 13 },
    { value: 14 },
    { value: 15 },
    { value: 16 },
    { value: 17 },
    { value: 18 },
    { value: 19 },
    { value: 20 },
  ]

  it("can wrap a Readable and be used as a Readable", done => {
    const readable = from.obj(contents)

    function assert(result) {
      expect(result).toEqual(contents)
    }

    pipe([toThrough(readable), concat(assert)], done)
  })

  it("can wrap a Readable and be used as a Transform", done => {
    const readable = from.obj(contents)

    function assert(result) {
      expect(result).toEqual(contents)
    }

    pipe([from.obj([]), toThrough(readable), concat(assert)], done)
  })

  it("passes through all upstream before readable", done => {
    const readable = from.obj(contents)

    function assert(result) {
      expect(result).toEqual(preContents.concat(contents))
    }

    pipe([from.obj(preContents), toThrough(readable), concat(assert)], done)
  })

  it("does not flush the stream if not piped before nextTick", done => {
    const readable = from.obj(contents)

    const wrapped = toThrough(readable)

    function assert(result) {
      expect(result).toEqual(preContents.concat(contents))
    }

    process.nextTick(() => {
      pipe([from.obj(preContents), wrapped, concat(assert)], done)
    })
  })
})
