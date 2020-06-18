import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import isWindows from "./utils/is-windows"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "@local/pump"

const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const outputPath = testConstants.outputPath
const contents = testConstants.contents

const clean = cleanup(outputBase)

describe(".dest() with custom times", () => {
  beforeEach(clean)
  afterEach(clean)

  it("does not call futimes when no mtime is provided on the vinyl stat", function (done) {
    // Changing the time of a directory errors in Windows.
    // Windows is treated as though it does not have permission to make this operation.
    if (isWindows) {
      this.skip()
      return
    }

    const earlier = Date.now() - 1001

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {},
    })

    function assert() {
      const stats = fs.lstatSync(outputPath)

      expect(futimesSpy.calls.length).to.equal(0)
      expect(stats.atime.getTime()).toBeGreaterThan(earlier)
      expect(stats.mtime.getTime()).toBeGreaterThan(earlier)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("calls futimes when an mtime is provided on the vinyl stat", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    // Use new mtime
    const mtime = new Date(Date.now() - 2048)

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mtime,
      },
    })

    function assert() {
      expect(futimesSpy.calls.length).to.equal(1)

      // Compare args instead of fs.lstats(), since mtime may be drifted in x86 Node.js
      const mtimeSpy = futimesSpy.calls[0].arguments[2]

      expect(mtimeSpy.getTime()).toEqual(mtime.getTime())

      expect(file.stat.mtime).toEqual(mtime)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("does not call futimes when provided mtime on the vinyl stat is invalid", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const earlier = Date.now() - 1001

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        mtime: new Date(undefined),
      },
    })

    function assert() {
      const stats = fs.lstatSync(outputPath)

      expect(futimesSpy.calls.length).to.equal(0)
      expect(stats.mtime.getTime()).toBeGreaterThan(earlier)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("calls futimes when provided mtime on the vinyl stat is valid but provided atime is invalid", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    // Use new mtime
    const mtime = new Date(Date.now() - 2048)
    const invalidAtime = new Date(undefined)

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        atime: invalidAtime,
        mtime,
      },
    })

    function assert() {
      expect(futimesSpy.calls.length).to.equal(1)

      const mtimeSpy = futimesSpy.calls[0].arguments[2]

      expect(mtimeSpy.getTime()).toEqual(mtime.getTime())
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })

  it("writes file atime and mtime using the vinyl stat", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    // Use new atime/mtime
    const atime = new Date(Date.now() - 2048)
    const mtime = new Date(Date.now() - 1024)

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        atime,
        mtime,
      },
    })

    function assert() {
      expect(futimesSpy.calls.length).to.equal(1)

      const atimeSpy = futimesSpy.calls[0].arguments[1]
      const mtimeSpy = futimesSpy.calls[0].arguments[2]

      expect(atimeSpy.getTime()).toEqual(atime.getTime())
      expect(mtimeSpy.getTime()).toEqual(mtime.getTime())
      expect(file.stat.mtime).toEqual(mtime)
      expect(file.stat.atime).toEqual(atime)
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { cwd: __dirname }), concat(assert)],
      done
    )
  })
})
