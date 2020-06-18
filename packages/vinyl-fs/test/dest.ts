import * as path from "path"
import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import statMode from "./utils/stat-mode"
import mockError from "./utils/mock-error"
import applyUmask from "./utils/apply-umask"
import testStreams from "./utils/test-streams"
import always from "./utils/always"
import testConstants from "./utils/test-constants"
import breakPrototype from "./utils/break-prototype"

import from from "from2"
import concat from "concat-stream"
import pipe from "@local/pump"
import through from "through2"

const count = testStreams.count
const rename = testStreams.rename
const includes = testStreams.includes
const slowCount = testStreams.slowCount
const string = testStreams.string

function noop() {}

const inputRelative = testConstants.inputRelative
const outputRelative = testConstants.outputRelative
const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const outputPath = testConstants.outputPath
const outputRenamePath = testConstants.outputRenamePath
const inputDirpath = testConstants.inputDirpath
const outputDirpath = testConstants.outputDirpath
const encodedInputPath = testConstants.encodedInputPath
const ranBomInputPath = testConstants.ranBomInputPath
const contents = testConstants.contents
const sourcemapContents = testConstants.sourcemapContents
const bomContents = testConstants.bomContents
const encodedContents = testConstants.encodedContents

function makeSourceMap() {
  return {
    version: 3,
    file: inputRelative,
    names: [],
    mappings: "",
    sources: [inputRelative],
    sourcesContent: [contents],
  }
}

const clean = cleanup(outputBase)

describe(".dest()", () => {
  beforeEach(clean)
  afterEach(clean)

  it("throws on no folder argument", done => {
    function noFolder() {
      vfs.dest()
    }

    expect(noFolder).to.throw(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
    done()
  })

  it("throws on empty string folder argument", done => {
    function emptyFolder() {
      vfs.dest("")
    }

    expect(emptyFolder).to.throw(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
    done()
  })

  it("accepts the sourcemap option as true", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      sourceMap: makeSourceMap(),
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { sourcemaps: true }), concat(assert)],
      done
    )
  })

  it("accepts the sourcemap option as a string", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      sourceMap: makeSourceMap(),
    })

    function assert(files) {
      expect(files.length).to.equal(2)
      expect(files).toInclude(file)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { sourcemaps: "." }), concat(assert)],
      done
    )
  })

  it("inlines sourcemaps when option is true", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      sourceMap: makeSourceMap(),
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].contents.toString()).toMatch(new RegExp(sourcemapContents))
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { sourcemaps: true }), concat(assert)],
      done
    )
  })

  it("generates an extra File when option is a string", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      sourceMap: makeSourceMap(),
    })

    function assert(files) {
      expect(files.length).to.equal(2)
      expect(files).toInclude(file)
      expect(files[0].contents.toString()).toMatch(
        new RegExp("//# sourceMappingURL=test.txt.map")
      )
      expect(files[1].contents).toEqual(JSON.stringify(makeSourceMap()))
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { sourcemaps: "." }), concat(assert)],
      done
    )
  })

  it("passes through writes with cwd", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].cwd).toEqual(__dirname, "cwd should have changed")
    }

    pipe(
      [from.obj([file]), vfs.dest(outputRelative, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("passes through writes with default cwd", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].cwd).toEqual(process.cwd(), "cwd should not have changed")
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("does not write null files", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      const exists = fs.existsSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(exists).to.be.false
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("writes buffer files to the right folder with relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert(files) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].cwd).toEqual(__dirname, "cwd should have changed")
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(outputContents).toEqual(contents)
    }

    pipe([from.obj([file]), vfs.dest(outputRelative, { cwd }), concat(assert)], done)
  })

  it("writes buffer files to the right folder with function and relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function outputFn(f) {
      expect(f).to.exist
      expect(f).toExist(file)
      return outputRelative
    }

    function assert(files) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].cwd).toEqual(__dirname, "cwd should have changed")
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(outputContents).toEqual(contents)
    }

    pipe([from.obj([file]), vfs.dest(outputFn, { cwd }), concat(assert)], done)
  })

  it("writes buffer files to the right folder", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert(files) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(outputContents).toEqual(contents)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("writes streaming files to the right folder", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
    })

    function assert(files) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(outputContents).toEqual(contents)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("writes large streaming files to the right folder", done => {
    const size = 40000

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: string(size),
    })

    function assert(files) {
      const stats = fs.lstatSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(stats.size).toEqual(size)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("writes directories to the right folder", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.lstatSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      // TODO: normalize this path
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(stats.isDirectory()).to.be.true
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("allows piping multiple dests in streaming mode", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert() {
      const outputContents1 = fs.readFileSync(outputPath, "utf8")
      const outputContents2 = fs.readFileSync(outputRenamePath, "utf8")
      expect(outputContents1).toEqual(contents)
      expect(outputContents2).toEqual(contents)
    }

    pipe(
      [
        from.obj([file]),
        includes({ path: inputPath }),
        vfs.dest(outputBase),
        rename(outputRenamePath),
        includes({ path: outputRenamePath }),
        vfs.dest(outputBase),
        concat(assert),
      ],
      done
    )
  })

  it("writes new files with the default user mode", done => {
    const expectedMode = applyUmask("666")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("reports i/o errors", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert(err) {
      expect(err).to.exist
      done()
    }

    fs.mkdirSync(outputBase)
    fs.closeSync(fs.openSync(outputPath, "w"))
    fs.chmodSync(outputPath, 0)

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("reports stat errors", done => {
    const expectedMode = applyUmask("722")

    const fstatSpy = expect.spyOn(fs, "fstat").andCall(mockError)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mode: expectedMode,
      },
    })

    function assert(err) {
      expect(err).to.exist
      expect(fstatSpy.calls.length).to.equal(1)
      done()
    }

    fs.mkdirSync(outputBase)
    fs.closeSync(fs.openSync(outputPath, "w"))

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("does not overwrite files with overwrite option set to false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents)
    }

    // Write expected file which should not be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { overwrite: false }), concat(assert)],
      done
    )
  })

  it("overwrites files with overwrite option set to true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { overwrite: true }), concat(assert)],
      done
    )
  })

  it("does not overwrite files with overwrite option set to a function that returns false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function overwrite(f) {
      expect(f).toEqual(file)
      return false
    }

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents)
    }

    // Write expected file which should not be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { overwrite }), concat(assert)], done)
  })

  it("overwrites files with overwrite option set to a function that returns true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function overwrite(f) {
      expect(f).toEqual(file)
      return true
    }

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { overwrite }), concat(assert)], done)
  })

  it("appends content with append option set to true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents + contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { append: true }), concat(assert)], done)
  })

  it("appends content with append option set to a function that returns true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function append(f) {
      expect(f).toEqual(file)
      return true
    }

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents + contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { append }), concat(assert)], done)
  })

  it("does not do any transcoding with encoding option set to false (buffer)", done => {
    const expectedContents = fs.readFileSync(ranBomInputPath)
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: expectedContents,
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath)

      expect(length).to.equal(1)
      expect(outputContents).toMatch(expectedContents)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: false }), concat(assert)],
      done
    )
  })

  it("does not do any transcoding with encoding option set to false (stream)", done => {
    const expectedContents = fs.readFileSync(ranBomInputPath)
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: fs.createReadStream(ranBomInputPath),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath)

      expect(length).to.equal(1)
      expect(outputContents).toMatch(expectedContents)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: false }), concat(assert)],
      done
    )
  })

  it("transcodes utf8 to gb2312 with encoding option (buffer)", done => {
    const expectedContents = fs.readFileSync(encodedInputPath)
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(encodedContents),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath)

      expect(length).to.equal(1)
      expect(outputContents).toMatch(expectedContents)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: "gb2312" }), concat(assert)],
      done
    )
  })

  it("transcodes utf8 to gb2312 with encoding option (stream)", done => {
    const expectedContents = fs.readFileSync(encodedInputPath)
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([encodedContents]),
    })

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath)

      expect(length).to.equal(1)
      expect(outputContents).toMatch(expectedContents)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: "gb2312" }), concat(assert)],
      done
    )
  })

  it("sends utf8 downstream despite encoding option, preserve BOM if any (buffer)", done => {
    const expectedString = `\ufeff${bomContents.replace("X", "16-BE")}`
    const expectedContents = new Buffer(expectedString)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: expectedContents,
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isBuffer()).to.be.true
      expect(files[0].contents).toMatch(expectedContents)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: "utf16be" }), concat(assert)],
      done
    )
  })

  it("sends utf8 downstream despite encoding option, preserve BOM if any (stream)", done => {
    const expectedString = `\ufeff${bomContents.replace("X", "16-BE")}`
    const expectedContents = new Buffer(expectedString)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([expectedString]),
    })

    function assertContent(contents) {
      expect(contents).toMatch(expectedContents)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }
    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { encoding: "utf16be" }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("reports unsupported encoding errors (buffer)", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert({ length }) {
      expect(length).to.equal(0)
    }

    function finish(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Unsupported encoding: fubar42")
      done()
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: "fubar42" }), concat(assert)],
      finish
    )
  })

  it("reports unsupported encoding errors (stream)", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
    })

    function assert({ length }) {
      expect(length).to.equal(0)
    }

    function finish(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Unsupported encoding: fubar42")
      done()
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { encoding: "fubar42" }), concat(assert)],
      finish
    )
  })

  it("emits a finish event", done => {
    const destStream = vfs.dest(outputBase)

    destStream.once("finish", done)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer("1234567890"),
    })

    pipe([from.obj([file]), destStream])
  })

  it("does not get clogged by highWaterMark", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: new Buffer(contents),
      })
      highwatermarkFiles.push(file)
    }

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        vfs.dest(outputBase),
      ],
      done
    )
  })

  it("allows backpressure when piped to another, slower stream", function (done) {
    this.timeout(20000)

    const expectedCount = 24
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: new Buffer(contents),
      })
      highwatermarkFiles.push(file)
    }

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        vfs.dest(outputBase),
        slowCount(expectedCount),
      ],
      done
    )
  })

  it("respects readable listeners on destination stream", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
    })

    const destStream = vfs.dest(outputBase)

    let readables = 0
    destStream.on("readable", () => {
      const data = destStream.read()

      if (data != null) {
        readables++
      }
    })

    function assert(err) {
      expect(readables).to.equal(1)
      done(err)
    }

    pipe([from.obj([file]), destStream], assert)
  })

  it("respects data listeners on destination stream", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
    })

    const destStream = vfs.dest(outputBase)

    let datas = 0
    destStream.on("data", () => {
      datas++
    })

    function assert(err) {
      expect(datas).to.equal(1)
      done(err)
    }

    pipe([from.obj([file]), destStream], assert)
  })

  it("sinks the stream if all the readable event handlers are removed", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: new Buffer(contents),
      })
      highwatermarkFiles.push(file)
    }

    const destStream = vfs.dest(outputBase)

    destStream.on("readable", noop)

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        destStream,
      ],
      done
    )

    process.nextTick(() => {
      destStream.removeListener("readable", noop)
    })
  })

  it("sinks the stream if all the data event handlers are removed", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: new Buffer(contents),
      })
      highwatermarkFiles.push(file)
    }

    const destStream = vfs.dest(outputBase)

    destStream.on("data", noop)

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        destStream,
      ],
      done
    )

    process.nextTick(() => {
      destStream.removeListener("data", noop)
    })
  })

  it("successfully processes files with streaming contents", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
    })

    pipe([from.obj([file]), vfs.dest(outputBase)], done)
  })

  it("errors when a non-Vinyl object is emitted", done => {
    const file = {}

    function assert(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Received a non-Vinyl object in `dest()`")
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("errors when a buffer-mode stream is piped to it", done => {
    const file = new Buffer("test")

    function assert(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Received a non-Vinyl object in `dest()`")
      done()
    }

    pipe([from([file]), vfs.dest(outputBase)], assert)
  })

  it("errors if we cannot mkdirp", done => {
    const mkdirSpy = expect.spyOn(fs, "mkdir").andCall(mockError)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(err) {
      expect(err).to.exist
      expect(mkdirSpy.calls.length).to.equal(1)
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("errors if vinyl object is a directory and we cannot mkdirp", done => {
    const ogMkdir = fs.mkdir

    const mkdirSpy = expect.spyOn(fs, "mkdir").andCall(function (...args) {
      if (mkdirSpy.calls.length > 1) {
        mockError.apply(this, args)
      } else {
        ogMkdir.apply(this, args)
      }
    })

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(err) {
      expect(err).to.exist
      expect(mkdirSpy.calls.length).to.equal(2)
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  // TODO: is this correct behavior? had to adjust it
  it("does not error if vinyl object is a directory and we cannot open it", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: applyUmask("000"),
      },
    })

    function assert() {
      const exists = fs.existsSync(outputDirpath)
      expect(exists).to.be.true
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("errors if vinyl object is a directory and open errors", done => {
    const openSpy = expect.spyOn(fs, "open").andCall(mockError)

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(err) {
      expect(err).to.exist
      expect(openSpy.calls.length).to.equal(1)
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("errors if content stream errors", done => {
    const contentStream = from((size, cb) => {
      cb(new Error("mocked error"))
    })

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: contentStream,
    })

    function assert(err) {
      expect(err).to.exist
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("does not pass options on to through2", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    // Reference: https://github.com/gulpjs/vinyl-fs/issues/153
    const read = expect.createSpy().andReturn(false)

    function assert() {
      // Called never because it's not a valid option
      expect(read.calls.length).to.equal(0)
    }

    pipe([from.obj([file]), vfs.dest(outputBase, { read }), concat(assert)], done)
  })

  it("does not marshall a Vinyl object with isSymbolic method", done => {
    const file = new File({
      base: outputBase,
      path: outputPath,
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      // Avoid comparing stats because they get reflected
      delete files[0].stat
      expect(files[0]).toMatch(file)
      expect(files[0]).toBe(file)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("marshalls a Vinyl object without isSymbolic to a newer Vinyl", done => {
    const file = new File({
      base: outputBase,
      path: outputPath,
    })

    breakPrototype(file)

    function assert(files) {
      expect(files.length).to.equal(1)
      // Avoid comparing stats because they get reflected
      delete files[0].stat
      expect(files[0]).toMatch(file)
      expect(files[0]).toNotBe(file)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })
})
