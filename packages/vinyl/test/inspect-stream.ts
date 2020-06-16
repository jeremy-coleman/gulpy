import Stream from "stream"
import expect from "expect"
import Cloneable from "cloneable-readable"
import inspectStream from "../lib/inspect-stream"

describe("inspectStream()", () => {
  it("works on a Stream", done => {
    const testStream = new Stream()
    const result = inspectStream(testStream)
    expect(result).toEqual("<Stream>")
    done()
  })

  it("works on a Readable Stream", done => {
    const testStream = new Stream.Readable()
    const result = inspectStream(testStream)
    expect(result).toEqual("<ReadableStream>")
    done()
  })

  it("works on a Writable Stream", done => {
    const testStream = new Stream.Writable()
    const result = inspectStream(testStream)
    expect(result).toEqual("<WritableStream>")
    done()
  })

  it("works on a Duplex Stream", done => {
    const testStream = new Stream.Duplex()
    const result = inspectStream(testStream)
    expect(result).toEqual("<DuplexStream>")
    done()
  })

  it("works on a Transform Stream", done => {
    const testStream = new Stream.Transform()
    const result = inspectStream(testStream)
    expect(result).toEqual("<TransformStream>")
    done()
  })

  it("works on a PassThrough Stream", done => {
    const testStream = new Stream.PassThrough()
    const result = inspectStream(testStream)
    expect(result).toEqual("<PassThroughStream>")
    done()
  })

  it("works on a custom Stream", done => {
    const testStream = new Cloneable(new Stream.Readable())
    const result = inspectStream(testStream)
    expect(result).toEqual("<CloneableStream>")
    done()
  })
})
