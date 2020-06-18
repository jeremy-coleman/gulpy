import exhaust from "../index"
import { expect } from "chai"
import Stream, { Readable, Writable } from "stream"
import { Readable as S2Readable } from "stream"
import through from "through2"

describe("stream-exhaust", () => {
  it("it should cause a Readable stream to complete if it's not piped anywhere", done => {
    const rs = new Readable({ highWaterMark: 2 })
    let a = 0
    let ended = false
    rs._read = () => {
      if (a++ < 100) {
        rs.push(`${a}`)
      } else {
        ended = true
        rs.push(null)
      }
    }

    rs.on("end", () => {
      expect(a).to.be.greaterThan(99)
      expect(ended).to.be.true
      done()
    })

    exhaust(rs)
  })

  test("should work with Readable streams in objectMode", done => {
    const rs = new Readable({ highWaterMark: 2, objectMode: true })
    let a = 0
    let ended = false
    rs._read = () => {
      if (a++ < 100) {
        rs.push(a)
      } else {
        ended = true
        rs.push(null)
      }
    }

    rs.on("end", () => {
      expect(a).to.be.greaterThan(99)
      expect(ended).to.be.true
      done()
    })

    exhaust(rs)
  })

  test("should not interfere with a Readable stream that is piped somewhere", done => {
    const rs = new Readable({ highWaterMark: 2 })
    let a = 0
    let ended = false
    rs._read = () => {
      if (a++ < 100) {
        rs.push(".")
      } else {
        ended = true
        rs.push(null)
      }
    }

    let sizeRead = 0
    const ws = new Writable({ highWaterMark: 2 })
    ws._write = ({ length }, _enc, next) => {
      sizeRead += length
      next()
    }

    ws.on("finish", () => {
      expect(a).to.be.greaterThan(99)
      expect(ended).to.be.true
      expect(sizeRead).to.equal(100)
      done()
    })

    rs.pipe(ws)

    exhaust(rs)
  })

  test("should not interfere with a Writable stream", done => {
    const rs = new Readable({ highWaterMark: 2 })
    let a = 0
    let ended = false
    rs._read = () => {
      if (a++ < 100) {
        rs.push(".")
      } else {
        ended = true
        rs.push(null)
      }
    }

    let sizeRead = 0
    const ws = new Writable({ highWaterMark: 2 })
    ws._write = ({ length }, _enc, next) => {
      sizeRead += length
      next()
    }

    ws.on("finish", () => {
      expect(a).to.be.greaterThan(99)
      expect(ended).to.be.true
      expect(sizeRead).to.equal(100)
      done()
    })

    rs.pipe(ws)

    exhaust(ws)
  })

  test("should handle a Transform stream", done => {
    const rs = new Readable({ highWaterMark: 2 })
    let a = 0
    let ended = false
    rs._read = () => {
      if (a++ < 100) {
        rs.push(".")
      } else {
        ended = true
        rs.push(null)
      }
    }

    let sizeRead = 0
    let flushed = false
    const ts = through(
      { highWaterMark: 2 },
      function (chunk, _enc, cb) {
        sizeRead += chunk.length
        this.push(chunk)
        cb()
      },
      cb => {
        flushed = true
        cb()
      }
    )

    ts.on("end", () => {
      expect(a).to.be.greaterThan(99)
      expect(ended).to.be.true
      expect(sizeRead).to.equal(100)
      expect(flushed).to.be.true
      done()
    })

    rs.pipe(ts)

    exhaust(ts)
  })

  test("should handle a classic stream", done => {
    const rs = new Stream()
    let ended = false
    let i

    rs.on("end", () => {
      expect(ended).to.be.true
      done()
    })

    exhaust(rs)

    for (i = 0; i < 100; i++) {
      rs.emit("data", i)
    }
    ended = true
    rs.emit("end")
  })

  test("should not modify .pipe", done => {
    const stream = new S2Readable()

    const pipe = stream.pipe

    stream._read = () => {
      stream.push("ending")
      stream.push(null)
    }

    exhaust(stream)

    expect(stream.pipe).to.equal(pipe)
    done()
  })

  test("does not error on no resume but readable set to true", done => {
    const rs = new Stream()
    rs["readable"] = true

    let ended = false

    rs.on("end", () => {
      expect(ended).to.be.true
      done()
    })

    exhaust(rs)

    for (let i = 0; i < 100; i++) {
      rs.emit("data", i)
    }
    ended = true
    rs.emit("end")
  })
})
