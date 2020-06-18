import { Stream } from "stream"
import { expect } from "chai"
import Cloneable from "@local/cloneable-readable"
import { inspectStream } from "../lib/inspect-stream"

describe("inspectStream()", () => {
  it("works on a Stream", () => {
    const testStream = new Stream()
    const result = inspectStream(testStream)
    expect(result).to.equal("<Stream>")
  })

  it("works on a Readable Stream", () => {
    const testStream = new Stream.Readable()
    const result = inspectStream(testStream)
    expect(result).to.equal("<ReadableStream>")
  })

  it("works on a Writable Stream", () => {
    const testStream = new Stream.Writable()
    const result = inspectStream(testStream)
    expect(result).to.equal("<WritableStream>")
  })

  it("works on a Duplex Stream", () => {
    const testStream = new Stream.Duplex()
    const result = inspectStream(testStream)
    expect(result).to.equal("<DuplexStream>")
  })

  it("works on a Transform Stream", () => {
    const testStream = new Stream.Transform()
    const result = inspectStream(testStream)
    expect(result).to.equal("<TransformStream>")
  })

  it("works on a PassThrough Stream", () => {
    const testStream = new Stream.PassThrough()
    const result = inspectStream(testStream)
    expect(result).to.equal("<PassThroughStream>")
  })

  it("works on a custom Stream", () => {
    const testStream = new Cloneable(new Stream.Readable())
    const result = inspectStream(testStream)
    expect(result).to.equal("<CloneableStream>")
  })
})
