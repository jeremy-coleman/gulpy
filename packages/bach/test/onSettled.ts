import { expect } from "chai"
import { onSettled } from "../lib/helpers"

const errors = [
  { state: "error", value: new Error("Error 1") },
  { state: "error", value: new Error("Error 2") },
]

describe("onSettled", () => {
  it("should group all errors", done => {
    onSettled(({ length }, results) => {
      expect(length).to.equal(2)
      expect(results).to.be.null
      done()
    })(null, errors)
  })

  it("should error early if called with an error", done => {
    onSettled((err, results) => {
      expect(err).to.be.an("error")
      expect(results).to.be.null
      done()
    })(new Error("Should not happen"))
  })

  it("should handle the no callback case", done => {
    onSettled()(null, errors)
    done()
  })

  it("should handle non-functions as callbacks", done => {
    onSettled("not a function")(null, errors)
    done()
  })
})
