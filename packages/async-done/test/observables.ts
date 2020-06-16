import expect from "expect"
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
      expect(result).toEqual(undefined)
      done(err)
    })
  })

  it("should handle a finished observable with value", done => {
    asyncDone(successValue, (err, result) => {
      expect(result).toEqual(42)
      done(err)
    })
  })

  it("should handle an errored observable", done => {
    asyncDone(failure, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })
})