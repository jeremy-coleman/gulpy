import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import statMode from "./utils/stat-mode"
import mockError from "./utils/mock-error"
import isWindows from "./utils/is-windows"
import applyUmask from "./utils/apply-umask"
import always from "./utils/always"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "@local/pump"

const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const outputPath = testConstants.outputPath
const inputDirpath = testConstants.inputDirpath
const outputDirpath = testConstants.outputDirpath
const inputNestedPath = testConstants.inputNestedPath
const outputNestedPath = testConstants.outputNestedPath
const contents = testConstants.contents

const clean = cleanup(outputBase)

describe(".dest() with custom modes", () => {
  beforeEach(clean)
  afterEach(clean)

  it("sets the mode of a written buffer file if set on the vinyl object", function (done) {
    // Changing the mode of a file is not supported by node.js in Windows.
    // Windows is treated as though it does not have permission to make this operation.
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("677")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("sets the sticky bit on the mode of a written stream file if set on the vinyl object", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("1677")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("sets the mode of a written stream file if set on the vinyl object", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("677")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: from([contents]),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("sets the mode of a written directory if set on the vinyl object", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("677")

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputDirpath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("sets sticky bit on the mode of a written directory if set on the vinyl object", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("1677")

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputDirpath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("writes new files with the mode specified in options", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("777")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
    })

    function assert() {
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { cwd: __dirname, mode: expectedMode }),
        concat(assert),
      ],
      done
    )
  })

  it("updates the file mode to match the vinyl mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const startMode = applyUmask("655")
    const expectedMode = applyUmask("722")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    fs.mkdirSync(outputBase)
    fs.closeSync(fs.openSync(outputPath, "w"))
    fs.chmodSync(outputPath, startMode)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("updates the directory mode to match the vinyl mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const startMode = applyUmask("2777")
    const expectedMode = applyUmask("727")

    const file1 = new File({
      base: inputBase,
      path: outputDirpath,
      stat: {
        isDirectory: always(true),
        mode: startMode,
      },
    })
    const file2 = new File({
      base: inputBase,
      path: outputDirpath,
      stat: {
        isDirectory: always(true),
        mode: expectedMode,
      },
    })

    function assert() {
      expect(statMode(outputDirpath)).toEqual(expectedMode)
    }

    pipe(
      [
        from.obj([file1, file2]),
        vfs.dest(outputBase, { cwd: __dirname }),
        concat(assert),
      ],
      done
    )
  })

  it("uses different modes for files and directories", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedDirMode = applyUmask("2777")
    const expectedFileMode = applyUmask("755")

    const file = new File({
      base: inputBase,
      path: inputNestedPath,
      contents: new Buffer(contents),
    })

    function assert() {
      expect(statMode(outputDirpath)).toEqual(expectedDirMode)
      expect(statMode(outputNestedPath)).toEqual(expectedFileMode)
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, {
          cwd: __dirname,
          mode: expectedFileMode,
          dirMode: expectedDirMode,
        }),
        concat(assert),
      ],
      done
    )
  })

  it("does not fchmod a matching file", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()

    const expectedMode = applyUmask("777")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(fchmodSpy.calls.length).to.equal(0)
      expect(statMode(outputPath)).toEqual(expectedMode)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("sees a file with special chmod (setuid/setgid/sticky) as distinct", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()

    const startMode = applyUmask("3722")
    const expectedMode = applyUmask("722")

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mode: expectedMode,
      },
    })

    function assert() {
      expect(fchmodSpy.calls.length).to.equal(1)
    }

    fs.mkdirSync(outputBase)
    fs.closeSync(fs.openSync(outputPath, "w"))
    fs.chmodSync(outputPath, startMode)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("reports fchmod errors", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const expectedMode = applyUmask("722")

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCall(mockError)

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
      expect(fchmodSpy.calls.length).to.equal(1)
      done()
    }

    fs.mkdirSync(outputBase)
    fs.closeSync(fs.openSync(outputPath, "w"))

    pipe([from.obj([file]), vfs.dest(outputBase, { cwd: __dirname })], assert)
  })
})
