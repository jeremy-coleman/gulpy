import * as domain from "domain"
import expect from "expect"
import when from "when"
import { asyncDone } from "../"

function success() {
  return when.resolve(2)
}

function failure() {
  return when.reject(new Error("Promise Error"))
}

function rejectNoError() {
  return when.reject()
}

describe("promises", () => {
  it("should handle a resolved promise", done => {
    asyncDone(success, (err, result) => {
      expect(result).toEqual(2)
      done(err)
    })
  })

  it("should handle a rejected promise", done => {
    asyncDone(failure, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })

  it("properly errors when rejected without an error", done => {
    asyncDone(rejectNoError, err => {
      expect(err).toExist()
      expect(err).toBeAn(Error)
      done()
    })
  })

  it("does not swallow thrown errors in callback", done => {
    const d = domain.create()
    d.once("error", err => {
      expect(err).toExist()
      expect(err.message).toContain("Boom")
      done()
    })
    d.run(() => {
      asyncDone(success, () => {
        throw new Error("Boom")
      })
    })
  })
})
