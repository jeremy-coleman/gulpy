import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("writing objects", () => {
    const stream = concat({ encoding: "objects" }, concatenated)
    function concatenated(objects) {
      expect(objects).to.have.lengthOf(2)
      expect(objects[0]).to.deep.equal({ foo: "bar" })
      expect(objects[1]).to.deep.equal({ baz: "taco" })
    }
    stream.write({ foo: "bar" })
    stream.write({ baz: "taco" })
    stream.end()
  })

  it("switch to objects encoding if no encoding specified and objects are written", () => {
    const stream = concat(concatenated)
    function concatenated(objects) {
      expect(objects).to.have.lengthOf(2)
      expect(objects[0]).to.deep.equal({ foo: "bar" })
      expect(objects[1]).to.deep.equal({ baz: "taco" })
    }
    stream.write({ foo: "bar" })
    stream.write({ baz: "taco" })
    stream.end()
  })
})
