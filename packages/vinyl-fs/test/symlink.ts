import * as path from "path"
import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import isWindows from "./utils/is-windows"
import testStreams from "./utils/test-streams"
import always from "./utils/always"
import testConstants from "./utils/test-constants"
import breakPrototype from "./utils/break-prototype"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump2"

const count = testStreams.count
const slowCount = testStreams.slowCount

function noop() {}

const outputRelative = testConstants.outputRelative
const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const outputPath = testConstants.outputPath
const inputDirpath = testConstants.inputDirpath
const outputDirpath = testConstants.outputDirpath
const contents = testConstants.contents

const clean = cleanup(outputBase)

describe("symlink stream", () => {
  beforeEach(clean)
  afterEach(clean)

  it("throws on no folder argument", done => {
    function noFolder() {
      vfs.symlink()
    }

    expect(noFolder).to.throw(
      "Invalid symlink() folder argument. Please specify a non-empty string or a function."
    )
    done()
  })

  it("throws on empty string folder argument", done => {
    function emptyFolder() {
      vfs.symlink("")
    }

    expect(emptyFolder).to.throw(
      "Invalid symlink() folder argument. Please specify a non-empty string or a function."
    )
    done()
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
      [from.obj([file]), vfs.symlink(outputRelative, { cwd: __dirname }), concat(assert)],
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

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("creates a link to the right folder with relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(files[0].isSymbolic()).toBe(true, "file should be symbolic")
      expect(outputLink).toEqual(inputPath)
    }

    pipe([from.obj([file]), vfs.symlink(outputRelative, { cwd }), concat(assert)], done)
  })

  it("creates a link to the right folder with function and relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function outputFn(f) {
      expect(f).to.exist
      expect(f).toEqual(file)
      return outputRelative
    }

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(files[0].isSymbolic()).toBe(true, "file should be symbolic")
      expect(outputLink).toEqual(inputPath)
    }

    pipe([from.obj([file]), vfs.symlink(outputFn, { cwd }), concat(assert)], done)
  })

  it("creates a link for a file with buffered contents", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(files[0].isSymbolic()).toBe(true, "file should be symbolic")
      expect(outputLink).toEqual(inputPath)
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("can create relative links", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(files[0].isSymbolic()).toBe(true, "file should be symbolic")
      expect(outputLink).toEqual(path.normalize("../fixtures/test.txt"))
    }

    pipe(
      [
        from.obj([file]),
        vfs.symlink(outputBase, { relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("creates a link for a file with streaming contents", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
    })

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(files[0].isSymbolic()).toBe(true, "file should be symbolic")
      expect(outputLink).toEqual(inputPath)
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("emits Vinyl objects that are symbolic", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isSymbolic()).to.be.true
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("(*nix) creates a link for a directory", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("(windows) creates a junction for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      // When creating a junction, it seems Windows appends a separator
      expect(files[0].symlink + path.sep).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(inputDirpath + path.sep)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("(windows) options can disable junctions for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.symlink(outputBase, { useJunctions: false }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) options can disable junctions for a directory (as a function)", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function useJunctions(f) {
      expect(f).to.exist
      expect(f).toBe(file)
      return false
    }

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [from.obj([file]), vfs.symlink(outputBase, { useJunctions }), concat(assert)],
      done
    )
  })

  it("(*nix) can create relative links for directories", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(path.normalize("../fixtures/foo"))
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.symlink(outputBase, { relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) relativeSymlinks option is ignored when junctions are used", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      // When creating a junction, it seems Windows appends a separator
      expect(files[0].symlink + path.sep).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(inputDirpath + path.sep)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.symlink(outputBase, { useJunctions: true, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) supports relativeSymlinks option when link is not for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputPath, "path should have changed")
      expect(outputLink).toEqual(path.normalize("../fixtures/test.txt"))
    }

    pipe(
      [
        from.obj([file]),
        // The useJunctions option is ignored when file is not a directory
        vfs.symlink(outputBase, { useJunctions: true, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) can create relative links for directories when junctions are disabled", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    })

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(files[0].symlink).toEqual(outputLink, "symlink should be set")
      expect(outputLink).toEqual(path.normalize("../fixtures/foo"))
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.symlink(outputBase, { useJunctions: false, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("reports IO errors", function (done) {
    // Changing the mode of a file is not supported by node.js in Windows.
    // This test is skipped on Windows because we have to chmod the file to 0.
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    fs.mkdirSync(outputBase)
    fs.chmodSync(outputBase, 0)

    function assert({ code }) {
      expect(code).to.equal("EACCES")
      done()
    }

    pipe([from.obj([file]), vfs.symlink(outputDirpath)], assert)
  })

  it("does not overwrite links with overwrite option set to false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
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
      [from.obj([file]), vfs.symlink(outputBase, { overwrite: false }), concat(assert)],
      done
    )
  })

  it("overwrites links with overwrite option set to true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
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
      [from.obj([file]), vfs.symlink(outputBase, { overwrite: true }), concat(assert)],
      done
    )
  })

  it("does not overwrite links with overwrite option set to a function that returns false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
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

    pipe([from.obj([file]), vfs.symlink(outputBase, { overwrite }), concat(assert)], done)
  })

  it("overwrites links with overwrite option set to a function that returns true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
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

    pipe([from.obj([file]), vfs.symlink(outputBase, { overwrite }), concat(assert)], done)
  })

  it("emits an end event", done => {
    const symlinkStream = vfs.symlink(outputBase)

    symlinkStream.on("end", done)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    pipe([from.obj([file]), symlinkStream])
  })

  it("emits a finish event", done => {
    const symlinkStream = vfs.symlink(outputBase)

    symlinkStream.on("finish", done)

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
    })

    pipe([from.obj([file]), symlinkStream])
  })

  it("errors when a non-Vinyl object is emitted", done => {
    const file = {}

    function assert(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Received a non-Vinyl object in `symlink()`")
      done()
    }

    pipe([from.obj([file]), vfs.symlink(outputBase)], assert)
  })

  it("errors when a buffer-mode stream is piped to it", done => {
    const file = new Buffer("test")

    function assert(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Received a non-Vinyl object in `symlink()`")
      done()
    }

    pipe([from([file]), vfs.symlink(outputBase)], assert)
  })

  it("does not get clogged by highWaterMark", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: null,
      })
      highwatermarkFiles.push(file)
    }

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        vfs.symlink(outputBase),
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
        contents: null,
      })
      highwatermarkFiles.push(file)
    }

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        vfs.symlink(outputBase),
        slowCount(expectedCount),
      ],
      done
    )
  })

  it("respects readable listeners on symlink stream", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
    })

    const symlinkStream = vfs.symlink(outputBase)

    let readables = 0
    symlinkStream.on("readable", () => {
      const data = symlinkStream.read()

      if (data != null) {
        readables++
      }
    })

    function assert(err) {
      expect(readables).to.equal(1)
      done(err)
    }

    pipe([from.obj([file]), symlinkStream], assert)
  })

  it("respects data listeners on symlink stream", done => {
    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
    })

    const symlinkStream = vfs.symlink(outputBase)

    let datas = 0
    symlinkStream.on("data", () => {
      datas++
    })

    function assert(err) {
      expect(datas).to.equal(1)
      done(err)
    }

    pipe([from.obj([file]), symlinkStream], assert)
  })

  it("sinks the stream if all the readable event handlers are removed", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: null,
      })
      highwatermarkFiles.push(file)
    }

    const symlinkStream = vfs.symlink(outputBase)

    symlinkStream.on("readable", noop)

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        symlinkStream,
      ],
      done
    )

    process.nextTick(() => {
      symlinkStream.removeListener("readable", noop)
    })
  })

  it("sinks the stream if all the data event handlers are removed", done => {
    const expectedCount = 17
    const highwatermarkFiles = []
    for (let idx = 0; idx < expectedCount; idx++) {
      const file = new File({
        base: inputBase,
        path: inputPath,
        contents: null,
      })
      highwatermarkFiles.push(file)
    }

    const symlinkStream = vfs.symlink(outputBase)

    symlinkStream.on("data", noop)

    pipe(
      [
        from.obj(highwatermarkFiles),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        symlinkStream,
      ],
      done
    )

    process.nextTick(() => {
      symlinkStream.removeListener("data", noop)
    })
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

    pipe([from.obj([file]), vfs.symlink(outputBase, { read }), concat(assert)], done)
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

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })

  it("marshalls a Vinyl object without isSymbolic to a newer Vinyl", done => {
    const file = new File({
      base: outputBase,
      path: outputPath,
      // Pre-set this because it is set by symlink
      symlink: outputPath,
    })

    breakPrototype(file)

    function assert(files) {
      expect(files.length).to.equal(1)
      // Avoid comparing stats because they get reflected
      delete files[0].stat
      expect(files[0]).toMatch(file)
      expect(files[0]).toNotBe(file)
    }

    pipe([from.obj([file]), vfs.symlink(outputBase), concat(assert)], done)
  })
})
