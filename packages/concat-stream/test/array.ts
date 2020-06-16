import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("array stream", () => {
    const arrays = concat({ encoding: "array" }, out => {
      expect(out).to.deep.equal([1, 2, 3, 4, 5, 6])
    })
    arrays.write([1, 2, 3])
    arrays.write([4, 5, 6])
    arrays.end()
  })
})
