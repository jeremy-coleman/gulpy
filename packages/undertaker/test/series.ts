import { expect } from "chai"

import { Undertaker } from "../mod"

function fn1(done) {
  done(null, 1)
}

function fn2(done) {
  setTimeout(() => {
    done(null, 2)
  }, 500)
}

function fn3(done) {
  done(null, 3)
}

function fnError(done) {
  done(new Error("An Error Occurred"))
}

describe("series", () => {
  let taker

  beforeEach(done => {
    taker = new Undertaker()
    taker.task("test1", fn1)
    taker.task("test2", fn2)
    taker.task("test3", fn3)
    taker.task("error", fnError)
    done()
  })

  it("should throw on non-valid tasks combined with valid tasks", done => {
    function fail() {
      taker.series("test1", "test2", "test3", {})
    }

    expect(fail).to.throw(/Task never defined:/)
    done()
  })

  it("should throw on tasks array with both valid and non-valid tasks", done => {
    function fail() {
      taker.series(["test1", "test2", "test3", {}])
    }

    expect(fail).to.throw(/Task never defined:/)
    done()
  })

  it("should throw on non-valid task", done => {
    function fail() {
      taker.series({})
    }

    expect(fail).to.throw(/Task never defined:/)
    done()
  })

  it("should throw when no tasks specified", done => {
    function fail() {
      taker.series()
    }

    expect(fail).to.throw(/One or more tasks should be combined using series or parallel/)
    done()
  })

  it("should throw on empty array of registered tasks", done => {
    function fail() {
      taker.series([])
    }

    expect(fail).to.throw(/One or more tasks should be combined using series or parallel/)
    done()
  })

  it("should take only one array of registered tasks", done => {
    taker.series(["test1", "test2", "test3"])((err, results) => {
      expect(results).to.deep.equal([1, 2, 3])
      done(err)
    })
  })

  it("should take all string names", done => {
    taker.series(
      "test1",
      "test2",
      "test3"
    )((err, results) => {
      expect(results).to.deep.equal([1, 2, 3])
      done(err)
    })
  })

  it("should take all functions", done => {
    taker.series(
      fn1,
      fn2,
      fn3
    )((err, results) => {
      expect(results).to.deep.equal([1, 2, 3])
      done(err)
    })
  })

  it("should take string names and functions", done => {
    taker.series(
      "test1",
      fn2,
      "test3"
    )((err, results) => {
      expect(results).to.deep.equal([1, 2, 3])
      done(err)
    })
  })

  it("should take nested series", done => {
    const series1 = taker.series("test1", "test2", "test3")
    taker.series(
      "test1",
      series1,
      "test3"
    )((err, results) => {
      expect(results).to.deep.equal([1, [1, 2, 3], 3])
      done(err)
    })
  })

  it("should stop processing on error", done => {
    taker.on("error", () => {
      // To keep the test from catching the emitted errors
    })
    taker.series(
      "test1",
      "error",
      "test3"
    )((err, results) => {
      expect(err).to.be.instanceOf(Error)
      expect(results).to.deep.equal([1, undefined, undefined])
      done()
    })
  })

  it("should throw on unregistered task", done => {
    function unregistered() {
      taker.series("unregistered")
    }

    expect(unregistered).to.throw("Task never defined: unregistered")
    done()
  })

  it("should process all functions if settle flag is true", done => {
    taker.on("error", () => {
      // To keep the test from catching the emitted errors
    })
    taker._settle = true
    taker.series(
      taker.series("test1", "error"),
      "test3"
    )((err, results) => {
      expect(err[0][0]).to.be.instanceOf(Error)
      expect(results).to.deep.equal([3])
      done()
    })
  })

  it("should not register a displayName on the returned function by default", done => {
    const task = taker.series(fn1)
    expect(task.displayName).to.be.undefined
    done()
  })
})
