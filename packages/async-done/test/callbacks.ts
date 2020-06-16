import { expect } from "chai"
import { asyncDone } from "../"

function success(cb) {
  cb(null, 2)
}

function failure(cb) {
  cb(new Error("Callback Error"))
}

function neverDone() {
  return 2
}

describe("callbacks", () => {
  it("should handle a successful callback", done => {
    asyncDone(success, (err, result) => {
      expect(result).to.equal(2)
      done(err)
    })
  })

  it("should handle an errored callback", done => {
    asyncDone(failure, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })

  it("a function that takes an argument but never calls callback", done => {
    asyncDone(neverDone, () => {
      done(new Error("Callback called"))
    })

    setTimeout(() => {
      done()
    }, 1000)
  })

  it("should not handle error if something throws inside the callback", done => {
    const d = require("domain").create()
    d.on("error", err => {
      expect(err).toBeAn(Error)
      done()
    })

    d.run(() => {
      asyncDone(success, () => {
        throw new Error("Thrown Error")
      })
    })
  })
})
