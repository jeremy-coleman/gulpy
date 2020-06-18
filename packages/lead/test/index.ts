import { expect } from "chai"
import "chai-as-promised"

import sink from "../"
import { noop } from "lodash"

import from from "from2"
import pipe from "@local/pump"
import * as through from "through2"
import to from "flush-write-stream"

function count(value: number) {
  let count = 0
  return through.obj(
    (file, _enc, cb) => {
      count++
      cb(null, file)
    },
    cb => {
      expect(count).to.equal(value)
      cb()
    }
  )
}

function slowCount(value) {
  let count = 0
  return to.obj(
    (file, _enc, cb) => {
      count++

      setTimeout(() => {
        cb(null, file)
      }, 250)
    },
    cb => {
      expect(count).to.equal(value)
      cb()
    }
  )
}

describe("lead", () => {
  it("can wrap binary stream", () => {
    const write = sink(through.main())

    expect(
      pipe(
        from(["1", "2", "3"]),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.fulfilled
  })

  it("can wrap object stream", () => {
    const write = sink(through.obj())

    expect(
      pipe(
        from.obj([{}, {}, {}]),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.fulfilled
  })

  it("does not convert between object and binary stream", () => {
    const write = sink(through.main())
    expect(
      pipe(
        from.obj([{}, {}, {}]),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.rejected
  })

  it("does not get clogged by highWaterMark", () => {
    const expectedCount = 17
    const highwatermarkObjs: object[] = []
    for (let idx = 0; idx < expectedCount; idx++) {
      highwatermarkObjs.push({})
    }

    const write = sink(through.obj())

    expect(
      pipe(
        from.obj(highwatermarkObjs),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.fulfilled
  })

  it("allows backpressure when piped to another, slower stream", function () {
    this.timeout(20000)

    const expectedCount = 24
    const highWatermarkObjs: object[] = []
    for (let idx = 0; idx < expectedCount; idx++) {
      highWatermarkObjs.push({})
    }

    const write = sink(through.obj())

    expect(
      pipe(
        from.obj(highWatermarkObjs),
        count(expectedCount),
        write,
        slowCount(expectedCount)
      )
    ).to.be.eventually.fulfilled
  })

  it("respects readable listeners on wrapped stream", done => {
    const write = sink(through.obj())

    let readables = 0
    write.on("readable", () => {
      while (write.read()) {
        readables++
      }
    })

    function assert(err) {
      expect(readables).to.equal(1)
      done(err)
    }

    pipe(from.obj([{}]), write).then(assert)
  })

  it("respects data listeners on wrapped stream", done => {
    const write = sink(through.obj())

    let data = 0
    write.on("data", () => {
      data++
    })

    function assert(err) {
      expect(data).to.equal(1)
      done(err)
    }

    pipe(from.obj([{}]), write).then(assert)
  })

  it("sinks the stream if all the readable event handlers are removed", () => {
    const expectedCount = 17
    const highwatermarkObjs: object[] = []
    for (let idx = 0; idx < expectedCount; idx++) {
      highwatermarkObjs.push({})
    }

    const write = sink(through.obj())

    write.on("readable", noop)

    expect(
      pipe(
        from.obj(highwatermarkObjs),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.fulfilled

    process.nextTick(() => {
      write.removeListener("readable", noop)
    })
  })

  it("does not sink the stream if an event handler still exists when one is removed", done => {
    const expectedCount = 17
    const highwatermarkObjs: object[] = []
    for (let idx = 0; idx < expectedCount; idx++) {
      highwatermarkObjs.push({})
    }

    const write = sink(through.obj())

    write.on("readable", noop)
    let readables = 0
    write.on("readable", () => {
      while (write.read()) {
        readables++
      }
    })

    function assert(err) {
      expect(readables).to.equal(expectedCount)
      done(err)
    }

    pipe(
      from.obj(highwatermarkObjs),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      write
    ).then(assert)

    process.nextTick(() => {
      write.removeListener("readable", noop)
    })
  })

  it("sinks the stream if all the data event handlers are removed", () => {
    const expectedCount = 17
    const highwatermarkObjs: object[] = []
    for (let idx = 0; idx < expectedCount; idx++) {
      highwatermarkObjs.push({})
    }

    const write = sink(through.obj())

    write.on("data", noop)

    expect(
      pipe(
        from.obj(highwatermarkObjs),
        count(expectedCount),
        // Must be in the Writable position to test this
        // So concat-stream cannot be used
        write
      )
    ).to.be.eventually.fulfilled

    process.nextTick(() => {
      write.removeListener("data", noop)
    })
  })
})
