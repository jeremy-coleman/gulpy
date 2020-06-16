import concat from "../"
import { expect } from "chai"

describe("concat-stream", () => {
  it("type inference works as expected", () => {
    const stream = concat()
    expect(stream.inferEncoding(["hello"])).to.equal("array")
    expect(stream.inferEncoding(Buffer.from("hello"))).to.equal("buffer")
    expect(stream.inferEncoding(undefined)).to.equal("buffer")
    expect(stream.inferEncoding(new Uint8Array(1))).to.equal("uint8array")
    expect(stream.inferEncoding("hello")).to.equal("string")
    expect(stream.inferEncoding("")).to.equal("string")
    expect(stream.inferEncoding({ hello: "world" })).to.equal("object")
    expect(stream.inferEncoding(1 as any)).to.equal("buffer")
  })
})
