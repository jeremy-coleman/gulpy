import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import applyUmask from "./utils/apply-umask"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "@local/pump"

const notOwnedBase = testConstants.notOwnedBase
const notOwnedPath = testConstants.notOwnedPath
const contents = testConstants.contents

const clean = cleanup()

describe(".dest() on not owned files", () => {
  const fileStats = fs.statSync(notOwnedPath)

  beforeEach(clean)
  afterEach(clean)

  let seenActions = false

  function needsAction() {
    const problems = []
    const actions = []
    if (fileStats.uid !== 0) {
      problems.push("Test files not owned by root.")
      actions.push(`  sudo chown root ${notOwnedPath}`)
    }
    if ((fileStats.mode & parseInt("022", 8)) !== parseInt("022", 8)) {
      problems.push("Test files not readable/writable by non-owners.")
      actions.push(`  sudo chmod 666 ${notOwnedPath}`)
    }
    if (actions.length > 0) {
      if (!seenActions) {
        console.log(problems.join("\n"))
        console.log("Please run the following commands and try again:")
        console.log(actions.join("\n"))
        seenActions = true
      }
      return true
    }
    return false
  }

  it("does not error if mtime is different", function (done) {
    if (needsAction()) {
      this.skip()
      return
    }

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const earlier = Date.now() - 1000

    const file = new File({
      base: notOwnedBase,
      path: notOwnedPath,
      contents: new Buffer(contents),
      stat: {
        mtime: new Date(earlier),
      },
    })

    function assert() {
      expect(futimesSpy.calls.length).to.equal(0)
    }

    pipe([from.obj([file]), vfs.dest(notOwnedBase), concat(assert)], done)
  })

  it("does not error if mode is different", function (done) {
    if (needsAction()) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()

    const file = new File({
      base: notOwnedBase,
      path: notOwnedPath,
      contents: new Buffer(contents),
      stat: {
        mode: applyUmask("777"),
      },
    })

    function assert() {
      expect(fchmodSpy.calls.length).to.equal(0)
    }

    pipe([from.obj([file]), vfs.dest(notOwnedBase), concat(assert)], done)
  })
})
