import * as fs from "fs"
import { expect } from "chai"
import { removeBOM as strip } from "../"

describe("strip-bom-buffer", () => {
  it("should strip bom:", () => {
    expect(strip(new Buffer("\ufefffoo")).toString()).to.equal("foo")
  })

  it("returns a non-utf8 value", () => {
    const utf16be = fs.readFileSync("./fixtures/bom-utf16be.txt")
    const utf16le = fs.readFileSync("./fixtures/bom-utf16le.txt")

    expect(strip(utf16be)).to.equal(utf16be)
    expect(strip(utf16le)).to.equal(utf16le)
  })
})
