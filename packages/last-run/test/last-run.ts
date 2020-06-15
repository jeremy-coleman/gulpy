import { expect } from "chai"
import { lastRun, capture, release, defaultResolution } from "../index"

describe("lastRun", () => {
  let since: number
  beforeEach(done => {
    since = Date.now()
    // Account for default resolution
    since = since - (since % defaultResolution())
    done()
  })

  it("should record function capture time", done => {
    function test() {}

    capture(test)

    expect(lastRun(test)).to.exist
    expect(lastRun(test)).to.be.at.most(Date.now())
    done()
  })

  it("should accept a timestamp", done => {
    function test() {}

    capture(test, since)

    expect(lastRun(test)).to.exist
    expect(lastRun(test)).to.equal(since)
    done()
  })

  it("removes last run time with release method", function (done) {
    function test() {}

    capture(test)

    expect(lastRun(test)).to.exist

    release(test)

    expect(lastRun(test)).to.not.exist
    done()
  })

  it("does not error on release if not captures", function (done) {
    function test() {}

    release(test)

    expect(lastRun(test)).to.not.exist
    done()
  })

  it("should return undefined for a function not captured", function (done) {
    function test() {}

    expect(lastRun(test)).to.not.exist
    done()
  })

  it("works with anonymous functions", function (done) {
    var test = function () {}

    capture(test)

    expect(lastRun(test)).to.exist
    expect(lastRun(test)).to.be.at.most(Date.now())
    done()
  })

  it("should give time with 1s resolution", function (done) {
    let resolution = 1000 // 1s
    since = Date.now()
    since = since - (since % resolution)

    function test() {}
    capture(test)

    expect(lastRun(test, resolution)).to.equal(since)
    done()
  })

  it("should accept a string for resolution", function (done) {
    const resolution = "1000" // 1s
    since = Date.now()
    since = since - (since % 1000)

    function test() {}
    capture(test)

    expect(lastRun(test, resolution)).to.equal(since)
    done()
  })

  it("should use default resolution when forced to 0ms resolution", done => {
    const resolution = 0

    function test() {}
    capture(test)

    expect(lastRun(test, resolution)).to.equal(since)
    done()
  })

  it("throws on non-enumerable functions when using weakmap shim", done => {
    function extensions() {
      const test = function () {}
      Object.preventExtensions(test)
      capture(test)
    }

    function seal() {
      const test = function () {}
      Object.seal(test)
      capture(test)
    }

    function freeze() {
      const test = function () {}
      Object.freeze(test)
      capture(test)
    }

    expect(extensions).to.not.throw
    expect(seal).to.not.throw
    expect(freeze).to.not.throw
    done()
  })
})
