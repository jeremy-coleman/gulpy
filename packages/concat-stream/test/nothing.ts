import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("no callback stream", () => {
    const stream = concat()
    stream.write("space")
    stream.end(" cats")
  })

  it("no encoding set, no data", done => {
    const stream = concat(data => {
      expect(data).to.deep.equal([])
      done()
    })
    stream.end()
  })

  it("encoding set to string, no data", done => {
    const stream = concat({ encoding: "string" }, data => {
      expect(data).to.equal("")
      done()
    })
    stream.end()
  })
})
