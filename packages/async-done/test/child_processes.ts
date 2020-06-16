import { expect } from "chai"
import * as cp from "child_process"
import { asyncDone } from "../"

function execSuccess() {
  return cp.exec("echo hello world")
}

function execFail() {
  return cp.exec("foo-bar-baz hello world")
}

function spawnSuccess() {
  return cp.spawn("echo", ["hello world"])
}

function spawnFail() {
  return cp.spawn("foo-bar-baz", ["hello world"])
}

describe("child processes", () => {
  it("should handle successful exec", done => {
    asyncDone(execSuccess, err => {
      expect(err).toNotBeAn(Error)
      done()
    })
  })

  it("should handle failing exec", done => {
    asyncDone(execFail, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })

  it("should handle successful spawn", done => {
    asyncDone(spawnSuccess, err => {
      expect(err).toNotBeAn(Error)
      done()
    })
  })

  it("should handle failing spawn", done => {
    asyncDone(spawnFail, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })
})
