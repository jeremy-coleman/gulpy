import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("string -> buffer stream", () => {
    const strings = concat({ encoding: "buffer" }, out => {
      expect(Buffer.isBuffer(out)).to.be.true
      expect(out.toString("utf8")).to.equal("nacho dogs")
    })
    strings.write("nacho ")
    strings.write("dogs")
    strings.end()
  })

  it("string stream", () => {
    const strings = concat({ encoding: "string" }, out => {
      expect(out).to.be.a("string")
      expect(out).to.equal("burrito dogs")
    })
    strings.write("burrito ")
    strings.write("dogs")
    strings.end()
  })

  it("end chunk", () => {
    const endChunk = concat({ encoding: "string" }, out => {
      expect(out).to.equal("this is the end")
    })
    endChunk.write("this ")
    endChunk.write("is the ")
    endChunk.end("end")
  })

  it("string from mixed write encodings", () => {
    const strings = concat({ encoding: "string" }, out => {
      expect(out).to.be.a("string")
      expect(out).to.equal("nacho dogs")
    })
    strings.write("na")
    strings.write(Buffer.from("cho"))
    strings.write([32, 100])
    const u8 = new Uint8Array(3)
    u8[0] = 111
    u8[1] = 103
    u8[2] = 115
    strings.end(u8)
  })

  it("string from buffers with multibyte characters", () => {
    const strings = concat({ encoding: "string" }, out => {
      expect(out).to.be.a("string")
      expect(out).to.equal("☃☃☃☃☃☃☃☃")
    })
    const snowman = Buffer.from("☃")
    for (let i = 0; i < 8; i++) {
      strings.write(snowman.slice(0, 1))
      strings.write(snowman.slice(1))
    }
    strings.end()
  })

  it("string infer encoding with empty string chunk", () => {
    const strings = concat(out => {
      expect(out).to.be.a("string")
      expect(out).to.equal("nacho dogs")
    })
    strings.write("")
    strings.write("nacho ")
    strings.write("dogs")
    strings.end()
  })

  it("to string numbers", done => {
    const write = concat(str => {
      expect(str).to.equal("a1000")
      done()
    })

    write.write("a")
    write.write(1000)
    write.end()
  })
})
