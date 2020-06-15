import { expect } from "chai"
import { Undertaker } from "../mod"

describe("lastRun", () => {
  let taker
  const defaultResolution = process.env.UNDERTAKER_TIME_RESOLUTION
  let test1
  let test2
  let error
  let alias

  beforeEach(done => {
    process.env.UNDERTAKER_TIME_RESOLUTION = "0"
    taker = new Undertaker()

    test1 = cb => {
      cb()
    }
    taker.task("test1", test1)

    test2 = cb => {
      cb()
    }
    test2.displayName = "test2"
    taker.task(test2)

    error = cb => {
      cb(new Error())
    }
    taker.task("error", error)

    alias = test1
    taker.task("alias", alias)

    done()
  })

  afterEach(done => {
    process.env.UNDERTAKER_TIME_RESOLUTION = defaultResolution
    done()
  })

  it("should only record time when task has completed", done => {
    let ts
    const test = cb => {
      ts = taker.lastRun("test")
      cb()
    }
    taker.task("test", test)
    taker.parallel("test")(err => {
      expect(ts).to.be.undefined
      done(err)
    })
  })

  it("should record tasks time execution", done => {
    taker.parallel("test1")(err => {
      expect(taker.lastRun("test1")).to.exist
      expect(taker.lastRun("test1")).to.not.be.greaterThan(Date.now())
      expect(taker.lastRun(test2)).to.not.exist
      expect(taker.lastRun(() => {})).to.not.exist
      done(err)
    })
  })

  it("should record all tasks time execution", done => {
    taker.parallel(
      "test1",
      test2
    )(err => {
      expect(taker.lastRun("test1")).to.exist
      expect(taker.lastRun("test1")).to.not.be.greaterThan(Date.now())
      expect(taker.lastRun(test2)).to.exist
      expect(taker.lastRun(test2)).to.not.be.greaterThan(Date.now())
      done(err)
    })
  })

  it("should record same tasks time execution for a string task and its original", done => {
    taker.series(test2)(err => {
      expect(taker.lastRun(test2)).to.equal(taker.lastRun("test2"))
      done(err)
    })
  })

  it("should record tasks time execution for an aliased task", done => {
    taker.series("alias")(err => {
      expect(taker.lastRun("alias")).to.equal(taker.lastRun("test1"))
      done(err)
    })
  })

  it("should give time with 1s resolution", done => {
    const resolution = 1000 // 1s
    const since = Date.now()
    const expected = since - (since % resolution)

    taker.series("test1")(() => {
      expect(taker.lastRun("test1", resolution)).to.equal(expected)
      done()
    })
  })

  it("should not record task start time on error", done => {
    taker.on("error", () => {
      // To keep the test from catching the emitted errors
    })
    taker.series("error")(err => {
      expect(err).to.exist
      expect(taker.lastRun("error")).to.not.exist
      done()
    })
  })
})
