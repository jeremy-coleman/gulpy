import * as os from "os"
import * as path from "path"
import { pipeline } from "stream"
import * as fs from "fs"
import mock from "jest-mock"
import expect from "expect"
import rimraf from "rimraf"
import streamx from "stream"
const Readable = streamx.Readable
const Writable = streamx.Writable

import mkdirpStream from "../"

describe("mkdirpStream", () => {
  const MASK_MODE = parseInt("7777", 8)
  const isWindows = os.platform() === "win32"

  const outputBase = path.join(__dirname, "./out-fixtures")
  const outputDirpath = path.join(outputBase, "./foo")

  function cleanup(done) {
    this.timeout(20000)

    mock.restoreAllMocks()

    // Async del to get sort-of-fix for https://github.com/isaacs/rimraf/issues/72
    rimraf(outputBase, done)
  }

  function masked(mode) {
    return mode & MASK_MODE
  }

  function statMode(outputPath) {
    return masked(fs.lstatSync(outputPath).mode)
  }

  function applyUmask(mode) {
    if (typeof mode !== "number") {
      mode = parseInt(mode, 8)
    }

    // Set to use to "get" it
    const current = process.umask(0)
    // Then set it back for the next test
    process.umask(current)

    return mode & ~current
  }

  beforeEach(cleanup)
  afterEach(cleanup)

  beforeEach(done => {
    fs.mkdir(outputBase, err => {
      if (err) {
        return done(err)
      }

      // Linux inherits the setgid of the directory and it messes up our assertions
      // So we explixitly set the mode to 777 before each test
      fs.chmod(outputBase, "777", done)
    })
  })

  it("exports a main function", done => {
    expect(typeof mkdirpStream).toEqual("function")
    done()
  })

  it("takes a string to create", done => {
    function assert(err) {
      expect(statMode(outputDirpath)).toBeDefined()
      done(err)
    }

    pipeline(Readable.from(["test"]), mkdirpStream(outputDirpath), new Writable(), assert)
  })

  it("takes a resolver function that receives chunk", done => {
    const expected = "test"

    function resolver(chunk, cb) {
      expect(chunk).toEqual(expected)
      cb(null, outputDirpath)
    }

    function assert(err) {
      expect(statMode(outputDirpath)).toBeDefined()
      done(err)
    }

    pipeline(Readable.from(["test"]), mkdirpStream(resolver), new Writable(), assert)
  })

  it("can pass a mode as the 3rd argument to the resolver callback", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = applyUmask("700")

    const expected = "test"

    function resolver(chunk, cb) {
      expect(chunk).toEqual(expected)
      cb(null, outputDirpath, mode)
    }

    function assert(err) {
      expect(statMode(outputDirpath)).toEqual(mode)
      done(err)
    }

    pipeline(Readable.from(["test"]), mkdirpStream(resolver), new Writable(), assert)
  })

  it("can pass an error as the 1st argument to the resolver callback to error", done => {
    function resolver(chunk, cb) {
      cb(new Error("boom"))
    }

    function notExists() {
      statMode(outputDirpath)
    }

    function assert(err) {
      expect(err).toBeDefined()
      expect(notExists).toThrow()
      done()
    }

    pipeline(Readable.from(["test"]), mkdirpStream(resolver), new Writable(), assert)
  })

  it("works with objectMode", done => {
    function resolver(chunk, cb) {
      expect(typeof chunk).toEqual("object")
      expect(chunk.dirname).toBeDefined()
      cb(null, chunk.dirname)
    }

    function assert(err) {
      expect(statMode(outputDirpath)).toBeDefined()
      done(err)
    }

    pipeline(
      Readable.from([{ dirname: outputDirpath }]),
      mkdirpStream(resolver),
      new Writable(),
      assert
    )
  })

  it("bubbles mkdir errors", done => {
    mock.spyOn(fs, "mkdir").mockImplementation((dirpath, mode, cb) => {
      cb(new Error("boom"))
    })

    function notExists() {
      statMode(outputDirpath)
    }

    function assert(err) {
      expect(err).toBeDefined()
      expect(notExists).toThrow()
      done()
    }

    pipeline(Readable.from(["test"]), mkdirpStream(outputDirpath), new Writable(), assert)
  })
})
