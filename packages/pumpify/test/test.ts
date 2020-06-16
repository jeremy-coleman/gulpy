import tape from "tape"
import * as through from "through2"
import pumpify from "../"
import stream from "stream"
import duplexify from "duplexify"

tape("basic", t => {
  t.plan(3)

  const pipeline = pumpify(
    through.default((data, enc, cb) => {
      t.same(data.toString(), "hello")
      cb(null, data.toString().toUpperCase())
    }),
    through.default((data, enc, cb) => {
      t.same(data.toString(), "HELLO")
      cb(null, data.toString().toLowerCase())
    })
  )

  pipeline.write("hello")
  pipeline.on("data", data => {
    t.same(data.toString(), "hello")
    t.end()
  })
})

tape("3 times", t => {
  t.plan(4)

  const pipeline = pumpify(
    through((data, enc, cb) => {
      t.same(data.toString(), "hello")
      cb(null, data.toString().toUpperCase())
    }),
    through((data, enc, cb) => {
      t.same(data.toString(), "HELLO")
      cb(null, data.toString().toLowerCase())
    }),
    through((data, enc, cb) => {
      t.same(data.toString(), "hello")
      cb(null, data.toString().toUpperCase())
    })
  )

  pipeline.write("hello")
  pipeline.on("data", data => {
    t.same(data.toString(), "HELLO")
    t.end()
  })
})

tape("destroy", t => {
  const test = through()
  test.destroy = () => {
    t.ok(true)
    t.end()
  }

  const pipeline = pumpify(through(), test)

  pipeline.destroy()
})

tape("close", t => {
  const test = through()
  const pipeline = pumpify(through(), test)

  pipeline.on("error", ({ message }) => {
    t.same(message, "lol")
    t.end()
  })

  test.emit("error", new Error("lol"))
})

tape("end waits for last one", t => {
  let ran = false

  const a = through()
  const b = through()
  const c = through((data, enc, cb) => {
    setTimeout(() => {
      ran = true
      cb()
    }, 100)
  })

  const pipeline = pumpify(a, b, c)

  pipeline.write("foo")
  pipeline.end(() => {
    t.ok(ran)
    t.end()
  })

  t.ok(!ran)
})

tape("always wait for finish", t => {
  const a = new stream.Readable()
  a._read = () => {}
  a.push("hello")

  const pipeline = pumpify(a, through(), through())
  let ran = false

  pipeline.on("finish", () => {
    t.ok(ran)
    t.end()
  })

  setTimeout(() => {
    ran = true
    a.push(null)
  }, 100)
})

tape("async", t => {
  const pipeline = pumpify()

  t.plan(4)

  pipeline.write("hello")
  pipeline.on("data", data => {
    t.same(data.toString(), "HELLO")
    t.end()
  })

  setTimeout(() => {
    pipeline.setPipeline(
      through((data, enc, cb) => {
        t.same(data.toString(), "hello")
        cb(null, data.toString().toUpperCase())
      }),
      through((data, enc, cb) => {
        t.same(data.toString(), "HELLO")
        cb(null, data.toString().toLowerCase())
      }),
      through((data, enc, cb) => {
        t.same(data.toString(), "hello")
        cb(null, data.toString().toUpperCase())
      })
    )
  }, 100)
})

tape("early destroy", t => {
  const a = through()
  const b = through()
  const c = through()

  b.destroy = () => {
    t.ok(true)
    t.end()
  }

  const pipeline = pumpify()

  pipeline.destroy()
  setTimeout(() => {
    pipeline.setPipeline(a, b, c)
  }, 100)
})

tape("preserves error", t => {
  const a = through()
  const b = through((data, enc, cb) => {
    cb(new Error("stop"))
  })
  const c = through()
  const s = pumpify()

  s.on("error", ({ message }) => {
    t.same(message, "stop")
    t.end()
  })

  s.setPipeline(a, b, c)
  s.resume()
  s.write("hi")
})

tape("preserves error again", t => {
  const ws = new stream.Writable()
  const rs = new stream.Readable({ highWaterMark: 16 })

  ws._write = (data, enc, cb) => {
    cb(null)
  }

  let once = true
  rs._read = () => {
    process.nextTick(() => {
      if (!once) return
      once = false
      rs.push("hello world")
    })
  }

  const pumpifyErr = pumpify(
    through(),
    through((chunk, _, cb) => {
      cb(new Error("test"))
    }),
    ws
  )

  rs.pipe(pumpifyErr).on("error", err => {
    t.ok(err)
    t.ok(err.message !== "premature close", "does not close with premature close")
    t.end()
  })
})

tape("returns error from duplexify", t => {
  const a = through()
  const b = duplexify()
  const s = pumpify()

  s.setPipeline(a, b)

  s.on("error", ({ message }) => {
    t.same(message, "stop")
    t.end()
  })

  s.write("data")
  // Test passes if `.end()` is not called
  s.end()

  b.setWritable(through())

  setImmediate(() => {
    b.destroy(new Error("stop"))
  })
})
