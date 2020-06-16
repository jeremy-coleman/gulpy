/*
on rvagg@fletcher:
  @0.2.3: Ran 36719 iterations in 10000 ms
*/

import through2 from "../"

import bl from "bl"
import * as crypto from "crypto"
import * as assert from "assert"

describe("bench", () => {
  function run(callback) {
    const bufs = Array(10)
      .fill(0)
      .map(() => crypto.randomBytes(32))

    const stream = through2((chunk, env, callback) => {
      callback(null, chunk.toString("hex"))
    })

    stream.pipe(
      bl((err, data) => {
        assert(!err)
        assert.equal(data.toString(), Buffer.concat(bufs).toString("hex"))
        callback()
      })
    )

    bufs.forEach(b => {
      stream.write(b)
    })
    stream.end()
  }

  let count = 0
  const start = Date.now()
  ;(function exec() {
    count++
    run(() => {
      if (Date.now() - start < 1000 * 10) {
        return setImmediate(exec)
      }
      console.log("Ran", count, "iterations in", Date.now() - start, "ms")
    })
  })()

  console.log("Running for ~10s")
})
