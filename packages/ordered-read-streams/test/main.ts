import { expect } from "chai"
import { OrderedStreams } from "../index"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump2"
import to from "flush-write-stream"

function fromOnce(fn) {
  let called = false
  return from.obj(function (size, next) {
    if (called) {
      return next(null, null)
    }
    called = true
    fn.apply(this, arguments)
  })
}

describe("ordered-read-streams", () => {
  it("ends if no streams are given", done => {
    const streams = new OrderedStreams()
    pipe([streams, concat()], done)
  })

  it("throws an error if stream is not readable", () => {
    const writable = to()
    function withWritable() {
      new OrderedStreams(writable)
    }
    expect(withWritable).to.throw("All input streams must be readable")
  })

  it("emits data from all streams", done => {
    const s1 = from.obj([{ value: "stream 1" }])
    const s2 = from.obj([{ value: "stream 2" }])
    const s3 = from.obj([{ value: "stream 3" }])

    const streams = new OrderedStreams([s1, s2, s3])

    function assert(results) {
      expect(results.length).to.equal(3)
      expect(results[0]).to.deep.equal({ value: "stream 1" })
      expect(results[1]).to.deep.equal({ value: "stream 2" })
      expect(results[2]).to.deep.equal({ value: "stream 3" })
    }

    pipe([streams, concat(assert)], done)
  })

  it("emits all data event from each stream", done => {
    const s = from.obj([{ value: "data1" }, { value: "data2" }, { value: "data3" }])

    const streams = new OrderedStreams(s)

    function assert({ length }) {
      expect(length).to.equal(3)
    }

    pipe([streams, concat(assert)], done)
  })

  it("preserves streams order", done => {
    const s1 = fromOnce((size, next) => {
      setTimeout(() => {
        next(null, { value: "stream 1" })
      }, 200)
    })
    const s2 = fromOnce((size, next) => {
      setTimeout(() => {
        next(null, { value: "stream 2" })
      }, 30)
    })
    const s3 = fromOnce((size, next) => {
      setTimeout(() => {
        next(null, { value: "stream 3" })
      }, 100)
    })

    const streams = new OrderedStreams([s1, s2, s3])

    function assert(results) {
      expect(results.length).to.equal(3)
      expect(results[0]).to.deep.equal({ value: "stream 1" })
      expect(results[1]).to.deep.equal({ value: "stream 2" })
      expect(results[2]).to.deep.equal({ value: "stream 3" })
    }

    pipe([streams, concat(assert)], done)
  })

  it("emits stream errors downstream", done => {
    const s = fromOnce((size, next) => {
      setTimeout(() => {
        next(new Error("stahp!"))
      }, 500)
    })
    const s2 = from.obj([{ value: "Im ok!" }])

    const streams = new OrderedStreams([s, s2])

    function assert({ message }) {
      expect(message).to.equal("stahp!")
      done()
    }

    pipe([streams, concat()], assert)
  })

  it("emits received data before a stream errors downstream", done => {
    const s = fromOnce((_size, next) => {
      setTimeout(() => {
        next(new Error("stahp!"))
      }, 500)
    })
    const s2 = from.obj([{ value: "Im ok!" }])

    // Invert the order to emit data first
    const streams = new OrderedStreams([s2, s])

    function assertData(chunk, _enc, next) {
      expect(chunk).to.deep.equal({ value: "Im ok!" })
      next()
    }

    function assertErr({ message }) {
      expect(message).to.equal("stahp!")
      done()
    }

    pipe([streams, to.obj(assertData)], assertErr)
  })
})
