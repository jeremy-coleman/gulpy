import * as fs from "fs"
import isUtf8 from "../index"
import { expect } from "chai"

describe("is-utf8", () => {
  it("ansi", () => {
    const ansi = fs.readFileSync("ansi.txt")
    expect(isUtf8(ansi)).to.be.false
  })

  it("utf8", () => {
    const utf8 = fs.readFileSync("utf8.txt")
    expect(isUtf8(utf8)).to.be.true
  })
})
