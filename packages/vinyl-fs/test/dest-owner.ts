import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import isWindows from "./utils/is-windows"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump2"

const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const contents = testConstants.contents

const clean = cleanup(outputBase)

describe(".dest() with custom owner", () => {
  beforeEach(clean)
  afterEach(clean)

  it("calls fchown when the uid and/or gid are provided on the vinyl stat", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchownSpy = expect.spyOn(fs, "fchown").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        uid: 1001,
        gid: 1001,
      },
    })

    function assert() {
      expect(fchownSpy.calls.length).to.equal(1)
      expect(fchownSpy.calls[0].arguments[1]).to.equal(1001)
      expect(fchownSpy.calls[0].arguments[2]).to.equal(1001)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("does not call fchown when the uid and gid provided on the vinyl stat are invalid", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchownSpy = expect.spyOn(fs, "fchown").andCallThrough()

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: {
        uid: -1,
        gid: -1,
      },
    })

    function assert() {
      expect(fchownSpy.calls.length).to.equal(0)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })
})
