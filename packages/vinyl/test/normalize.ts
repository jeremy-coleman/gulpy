import * as path from "path"
import { expect } from "chai"
import { normalize } from "../lib/normalize"

describe("normalize()", () => {
  it("leaves empty strings unmodified", () => {
    const result = normalize("")
    expect(result).to.equal("")
  })

  it("applies path.normalize for everything else", () => {
    const str = "/foo//../bar/baz"
    const result = normalize(str)
    expect(result).to.equal(path.normalize(str))
  })
})
