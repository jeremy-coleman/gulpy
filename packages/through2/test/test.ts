import test from "tape"
import * as through2 from "../"
import { Transform, DuplexOptions } from "stream"
import crypto from "crypto"
import bl from "bl"
import spigot from "stream-spigot"

interface ITransform extends Transform {
  (): ITransform
  new (): ITransform
  _i: number
}

describe("through2", () => {
  it("plain through", t => {
    const th2 = through2.default<ITransform>(function ({ length }, _enc, callback) {
      if (!this._i) {
        this._i = 97
      }
      // 'a'
      else this._i++
      const b = Buffer.alloc(length)
      for (let i = 0; i < length; i++) b[i] = this._i
      this.push(b)
      callback()
    })

    th2.pipe(
      bl((_err, b) => {
        const s = b.toString("ascii")
        t.equal("aaaaaaaaaabbbbbcccccccccc", s, "got transformed string")
        t.end()
      })
    )

    th2.write(crypto.randomBytes(10))
    th2.write(crypto.randomBytes(5))
    th2.write(crypto.randomBytes(10))
    th2.end()
  })

  it("pipeable through", t => {
    const th2 = through2.default<ITransform>(function ({ length }, enc, callback) {
      if (!this._i) this._i = 97
      // 'a'
      else this._i++
      const b = Buffer.alloc(length)
      for (let i = 0; i < length; i++) b[i] = this._i
      this.push(b)
      callback()
    })

    th2.pipe(
      bl((err, b) => {
        const s = b.toString("ascii")
        // bl() acts like a proper streams2 stream and passes as much as it's
        // asked for, so we really only get one write with such a small amount
        // of data
        t.equal(s, "aaaaaaaaaaaaaaaaaaaaaaaaa", "got transformed string")
        t.end()
      })
    )

    const bufs = bl()
    bufs.append(crypto.randomBytes(10))
    bufs.append(crypto.randomBytes(5))
    bufs.append(crypto.randomBytes(10))
    bufs.pipe(th2)
  })

  it("object through", t => {
    t.plan(3)

    const th2 = through2.default({ objectMode: true }, function (chunk, enc, callback) {
      this.push({ out: chunk.in + 1 })
      callback()
    })

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("object through with through2.obj", t => {
    t.plan(3)

    const th2 = through2.obj(function (chunk, enc, callback) {
      this.push({ out: chunk.in + 1 })
      callback()
    })

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("flushing through", t => {
    const th2 = through2.default<ITransform>(
      function ({ length }, enc, callback) {
        if (!this._i) this._i = 97
        // 'a'
        else this._i++
        const b = Buffer.alloc(length)
        for (let i = 0; i < length; i++) b[i] = this._i
        this.push(b)
        callback()
      },
      function (callback) {
        this.push(Buffer.from([101, 110, 100]))
        callback()
      }
    )

    th2.pipe(
      bl((err, b) => {
        const s = b.toString("ascii")
        t.equal(s, "aaaaaaaaaabbbbbccccccccccend", "got transformed string")
        t.end()
      })
    )

    th2.write(crypto.randomBytes(10))
    th2.write(crypto.randomBytes(5))
    th2.write(crypto.randomBytes(10))
    th2.end()
  })

  it("plain through ctor", t => {
    const Th2 = through2.ctor<ITransform>(function ({ length }, _enc, callback) {
      if (!this._i) this._i = 97
      // 'a'
      else this._i++
      const b = Buffer.alloc(length)
      for (let i = 0; i < length; i++) b[i] = this._i
      this.push(b)
      callback()
    })

    const th2 = new Th2()

    th2.pipe(
      bl((err, b) => {
        const s = b.toString("ascii")
        t.equal("aaaaaaaaaabbbbbcccccccccc", s, "got transformed string")
        t.end()
      })
    )

    th2.write(crypto.randomBytes(10))
    th2.write(crypto.randomBytes(5))
    th2.write(crypto.randomBytes(10))
    th2.end()
  })

  it("reuse through ctor", t => {
    t.plan(4)

    const Th2 = through2.ctor<ITransform>(function ({ length }, enc, callback) {
      if (!this._i) {
        t.ok(1, "did not contain previous instance data (this._i)")
        this._i = 97 // 'a'
      } else this._i++
      const b = Buffer.alloc(length)
      for (let i = 0; i < length; i++) b[i] = this._i
      this.push(b)
      callback()
    })

    const th2 = Th2()

    th2.pipe(
      bl((err, b) => {
        const s = b.toString("ascii")
        t.equal("aaaaaaaaaabbbbbcccccccccc", s, "got transformed string")

        const newInstance = Th2()
        newInstance.pipe(
          bl((err, b) => {
            const s = b.toString("ascii")
            t.equal("aaaaaaabbbbccccccc", s, "got transformed string")
          })
        )

        newInstance.write(crypto.randomBytes(7))
        newInstance.write(crypto.randomBytes(4))
        newInstance.write(crypto.randomBytes(7))
        newInstance.end()
      })
    )

    th2.write(crypto.randomBytes(10))
    th2.write(crypto.randomBytes(5))
    th2.write(crypto.randomBytes(10))
    th2.end()
  })

  it("object through ctor", t => {
    t.plan(3)

    const Th2 = through2.ctor({ objectMode: true }, function (chunk, enc, callback) {
      this.push({ out: chunk.in + 1 })
      callback()
    })

    const th2 = new Th2()

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("pipeable object through ctor", t => {
    t.plan(4)

    const Th2 = through2.ctor({ objectMode: true }, function (record, enc, callback) {
      if (record.temp != null && record.unit == "F") {
        record.temp = ((record.temp - 32) * 5) / 9
        record.unit = "C"
      }
      this.push(record)
      callback()
    })

    const th2 = Th2()

    const expect = [-19, -40, 100, 22]
    th2.on("data", o => {
      t.deepEqual(o, { temp: expect.shift(), unit: "C" }, "got transformed object")
    })

    spigot({ objectMode: true }, [
      { temp: -2.2, unit: "F" },
      { temp: -40, unit: "F" },
      { temp: 212, unit: "F" },
      { temp: 22, unit: "C" },
    ]).pipe(th2)
  })

  it("object through ctor override", t => {
    t.plan(3)

    const Th2 = through2.ctor(function (chunk, enc, callback) {
      this.push({ out: chunk.in + 1 })
      callback()
    })

    const th2 = Th2({ objectMode: true })

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("object settings available in transform", t => {
    t.plan(6)

    const Th2 = through2.ctor({ objectMode: true, peek: true }, function (
      chunk,
      enc,
      callback
    ) {
      t.ok(this.options.peek, "reading options from inside _transform")
      this.push({ out: chunk.in + 1 })
      callback()
    })

    const th2 = Th2()

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("object settings available in transform override", t => {
    t.plan(6)

    const Th2 = through2.ctor(function (chunk, enc, callback) {
      t.ok(this.options.peek, "reading options from inside _transform")
      this.push({ out: chunk.in + 1 })
      callback()
    })

    const th2 = Th2({ objectMode: true, peek: true })

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("object override extends options", t => {
    t.plan(6)

    const Th2 = through2.ctor({ objectMode: true }, function (chunk, enc, callback) {
      t.ok(this.options.peek, "reading options from inside _transform")
      this.push({ out: chunk.in + 1 })
      callback()
    })

    const th2 = Th2({ peek: true })

    let e = 0
    th2.on("data", o => {
      t.deepEqual(
        o,
        { out: e === 0 ? 102 : e == 1 ? 203 : -99 },
        "got transformed object"
      )
      e++
    })

    th2.write({ in: 101 })
    th2.write({ in: 202 })
    th2.write({ in: -100 })
    th2.end()
  })

  it("can be destroyed", t => {
    t.plan(1)

    const th = through2()

    th.on("close", () => {
      t.ok(true, "shoud emit close")
      t.end()
    })

    th.destroy()
  })

  it("can be destroyed twice", t => {
    t.plan(1)

    const th = through2.default()

    th.on("close", () => {
      t.ok(true, "shoud emit close")
      t.end()
    })

    th.destroy()
    th.destroy()
  })
})
