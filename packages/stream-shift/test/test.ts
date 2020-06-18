import { expect } from "chai"
import through from "through2"
import * as stream from "stream"
import { shift } from "../"

describe("stream-shift", () => {
  it("shifts next", () => {
    const passthrough = through()

    passthrough.write("hello")
    passthrough.write("world")

    expect(shift(passthrough)).to.deep.equal(Buffer.from("hello"))
    expect(shift(passthrough)).to.deep.equal(Buffer.from("world"))
  })

  it("shifts next with core", () => {
    const passthrough = new stream.PassThrough()

    passthrough.write("hello")
    passthrough.write("world")

    expect(shift(passthrough)).to.deep.equal(Buffer.from("hello"))
    expect(shift(passthrough)).to.deep.equal(Buffer.from("world"))
  })

  it("shifts next with object mode", () => {
    const passthrough = through({ objectMode: true })

    passthrough.write({ hello: 1 })
    passthrough.write({ world: 1 })

    expect(shift(passthrough)).to.deep.equal({ hello: 1 })
    expect(shift(passthrough)).to.deep.equal({ world: 1 })
  })

  it("shifts next with object mode with core", () => {
    const passthrough = new stream.PassThrough({ objectMode: true })

    passthrough.write({ hello: 1 })
    passthrough.write({ world: 1 })

    expect(shift(passthrough)).to.deep.equal({ hello: 1 })
    expect(shift(passthrough)).to.deep.equal({ world: 1 })
  })
})
