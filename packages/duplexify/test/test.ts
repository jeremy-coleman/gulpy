import { assert, expect } from "chai"
import * as through from "through2"
import concat from "concat-stream"
import * as stream from "stream"
import * as net from "net"
import duplexify from "../"

const HELLO_WORLD = Buffer.from("hello world")

describe("duplexify", () => {
  it("passthrough", done => {
    const pt = through()
    const dup = duplexify(pt, pt)

    dup.end("hello world")
    dup.on("finish", () => {
      assert.ok(true, "should finish")
    })
    dup.pipe(
      concat(data => {
        expect(data.toString()).to.equal("hello world", "same in as out")
      })
    )
  })

  it("passthrough + double end", done => {
    const pt = through()
    const dup = duplexify(pt, pt)

    dup.end("hello world")
    dup.end()

    dup.on("finish", () => {
      assert.ok(true, "should finish")
    })
    dup.pipe(
      concat(data => {
        expect(data.toString()).to.equal("hello world", "same in as out")
      })
    )
  })

  it("async passthrough + end", done => {
    const pt = through.obj({ highWaterMark: 1 }, (data, enc, cb) => {
      setTimeout(() => {
        cb(null, data)
      }, 100)
    })

    const dup = duplexify(pt, pt)

    dup.write("hello ")
    dup.write("world")
    dup.end()

    dup.on("finish", () => {
      t.ok(true, "should finish")
    })
    dup.pipe(
      concat(data => {
        t.same(data.toString(), "hello world", "same in as out")
      })
    )
  })

  it("duplex", done => {
    const readExpected = ["read-a", "read-b", "read-c"]
    const writeExpected = ["write-a", "write-b", "write-c"]

    t.plan(readExpected.length + writeExpected.length + 2)

    const readable = through.obj()
    const writable = through.obj((data, enc, cb) => {
      t.same(data, writeExpected.shift(), "onwrite should match")
      cb()
    })

    const dup = duplexify.obj(writable, readable)

    readExpected.slice().forEach(data => {
      readable.write(data)
    })
    readable.end()

    writeExpected.slice().forEach(data => {
      dup.write(data)
    })
    dup.end()

    dup.on("data", data => {
      t.same(data, readExpected.shift(), "ondata should match")
    })
    dup.on("end", () => {
      t.ok(true, "should end")
    })
    dup.on("finish", () => {
      t.ok(true, "should finish")
    })
  })

  it("async", done => {
    const dup = duplexify()
    const pt = through()

    dup.pipe(
      concat(data => {
        t.same(data.toString(), "i was async", "same in as out")
        t.end()
      })
    )

    dup.write("i")
    dup.write(" was ")
    dup.end("async")

    setTimeout(() => {
      dup.setWritable(pt)
      setTimeout(() => {
        dup.setReadable(pt)
      }, 50)
    }, 50)
  })

  it("destroy", done => {
    t.plan(2)

    const write = through()
    const read = through()
    const dup = duplexify(write, read)

    write.destroy = () => {
      t.ok(true, "write destroyed")
    }

    dup.on("close", () => {
      t.ok(true, "close emitted")
    })

    dup.destroy()
    dup.destroy() // should only work once
  })

  it("destroy both", done => {
    t.plan(3)

    const write = through()
    const read = through()
    const dup = duplexify(write, read)

    write.destroy = () => {
      t.ok(true, "write destroyed")
    }

    read.destroy = () => {
      t.ok(true, "read destroyed")
    }

    dup.on("close", () => {
      t.ok(true, "close emitted")
    })

    dup.destroy()
    dup.destroy() // should only work once
  })

  it("bubble read errors", done => {
    t.plan(2)

    const write = through()
    const read = through()
    const dup = duplexify(write, read)

    dup.on("error", ({ message }) => {
      t.same(message, "read-error", "received read error")
    })
    dup.on("close", () => {
      t.ok(true, "close emitted")
    })

    read.emit("error", new Error("read-error"))
    write.emit("error", new Error("write-error")) // only emit first error
  })

  it("bubble write errors", done => {
    t.plan(2)

    const write = through()
    const read = through()
    const dup = duplexify(write, read)

    dup.on("error", ({ message }) => {
      t.same(message, "write-error", "received write error")
    })
    dup.on("close", () => {
      t.ok(true, "close emitted")
    })

    write.emit("error", new Error("write-error"))
    read.emit("error", new Error("read-error")) // only emit first error
  })

  it("bubble errors from write()", done => {
    t.plan(3)

    let errored = false
    const dup = duplexify(
      new stream.Writable({
        write(chunk, enc, next) {
          next(new Error("write-error"))
        },
      })
    )

    dup.on("error", ({ message }) => {
      errored = true
      t.same(message, "write-error", "received write error")
    })
    dup.on("close", () => {
      t.pass("close emitted")
      t.ok(errored, "error was emitted before close")
    })
    dup.end("123")
  })

  it("destroy while waiting for drain", done => {
    t.plan(3)

    let errored = false
    const dup = duplexify(
      new stream.Writable({
        highWaterMark: 0,
        write() {},
      })
    )

    dup.on("error", ({ message }) => {
      errored = true
      t.same(message, "destroy-error", "received destroy error")
    })
    dup.on("close", () => {
      t.pass("close emitted")
      t.ok(errored, "error was emitted before close")
    })
    dup.write("123")
    dup.destroy(new Error("destroy-error"))
  })

  it("reset writable / readable", done => {
    t.plan(3)

    const toUpperCase = (data, enc, cb) => {
      cb(null, data.toString().toUpperCase())
    }

    const passthrough = through()
    const upper = through(toUpperCase)
    const dup = duplexify(passthrough, passthrough)

    dup.once("data", data => {
      t.same(data.toString(), "hello")
      dup.setWritable(upper)
      dup.setReadable(upper)
      dup.once("data", data => {
        t.same(data.toString(), "HELLO")
        dup.once("data", data => {
          t.same(data.toString(), "HI")
          t.end()
        })
      })
      dup.write("hello")
      dup.write("hi")
    })
    dup.write("hello")
  })

  it("cork", done => {
    const passthrough = through()
    const dup = duplexify(passthrough, passthrough)
    let ok = false

    dup.on("prefinish", () => {
      dup.cork()
      setTimeout(() => {
        ok = true
        dup.uncork()
      }, 100)
    })
    dup.on("finish", () => {
      t.ok(ok)
      t.end()
    })
    dup.end()
  })

  it("prefinish not twice", done => {
    const passthrough = through()
    const dup = duplexify(passthrough, passthrough)
    let prefinished = false

    dup.on("prefinish", () => {
      t.ok(!prefinished, "only prefinish once")
      prefinished = true
    })

    dup.on("finish", () => {
      t.end()
    })

    dup.end()
  })

  it("close", done => {
    const passthrough = through()
    const dup = duplexify(passthrough, passthrough)

    passthrough.emit("close")
    dup.on("close", () => {
      t.ok(true, "should forward close")
      done()
    })
  })

  it("works with node native streams (net)", done => {
    const server = net.createServer(socket => {
      const dup = duplexify(socket, socket)

      dup.once("data", chunk => {
        expect(chunk).to.deep.equal(HELLO_WORLD)
        server.close()
        socket.end()
        done()
      })
    })

    server.listen(0, () => {
      const socket = net.connect(server.address().port)
      const dup = duplexify(socket, socket)

      dup.write(HELLO_WORLD)
    })
  })
})
