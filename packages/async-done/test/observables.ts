import { expect } from "chai"
import { asyncDone } from "../"
import { Observable } from "rxjs"

function success() {
  return Observable.empty()
}

function successValue() {
  // This corresponds to `Observable.return(42);` in RxJS 4
  return Observable.of(42)
}

function failure() {
  return Observable.throw(new Error("Observable error"))
}

describe("observables", () => {
  it("should handle a finished observable", done => {
    asyncDone(success, (err, result) => {
      expect(result).to.be.undefined
      done(err)
    })
  })

  it("should handle a finished observable with value", done => {
    asyncDone(successValue, (err, result) => {
      expect(result).to.equal(42)
      done(err)
    })
  })

  it("should handle an errored observable", done => {
    asyncDone(failure, err => {
      expect(err).to.be.an(Error)
      done()
    })
  })
})
