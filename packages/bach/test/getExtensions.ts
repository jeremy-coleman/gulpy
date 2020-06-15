import { expect } from "chai"
import { getExtensions } from "../lib/helpers"

describe("getExtensions", () => {
  it("should return the argument if it is an object", done => {
    const obj = {}
    expect(getExtensions(obj)).to.equal(obj)
    done()
  })

  it("should return undefined if argument is not an object", done => {
    const fn = () => {}
    expect(getExtensions(fn)).to.be.undefined
    done()
  })
})
