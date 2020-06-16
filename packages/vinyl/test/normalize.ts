import path from "path"
import { expect } from "chai"
import normalize from "../lib/normalize"

describe("normalize()", () => {
  it("leaves empty strings unmodified", done => {
    const result = normalize("")
    expect(result).to.equal("")
    done()
  })

  it("applies path.normalize for everything else", done => {
    const str = "/foo//../bar/baz"
    const result = normalize(str)
    expect(result).to.equal(path.normalize(str))
    done()
  })
})
