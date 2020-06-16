import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("typed array stream", () => {
    const a = new Uint8Array(5)
    a[0] = 97
    a[1] = 98
    a[2] = 99
    a[3] = 100
    a[4] = 101
    const b = new Uint8Array(3)
    b[0] = 32
    b[1] = 102
    b[2] = 103
    const c = new Uint8Array(4)
    c[0] = 32
    c[1] = 120
    c[2] = 121
    c[3] = 122

    const arrays = concat({ encoding: "Uint8Array" }, out => {
      expect(out.subarray).to.be.a("function")
      expect(Buffer.from(out).toString("utf8")).to.equal("abcde fg xyz")
    })
    arrays.write(a)
    arrays.write(b)
    arrays.end(c)
  })

  it("typed array from strings, buffers, and arrays", () => {
    const arrays = concat({ encoding: "Uint8Array" }, out => {
      expect(out.subarray).to.be.a("function")
      expect(Buffer.from(out).toString("utf8")).to.equal("abcde fg xyz")
    })
    arrays.write("abcde")
    arrays.write(Buffer.from(" fg "))
    arrays.end([120, 121, 122])
  })
})
