import pump from "../index"
import * as fs from "fs"
import { Transform } from "stream"
import { assert } from "chai"

describe("pump", function () {
  it("test", async () => {
    const rs = fs.createReadStream("/dev/random")
    const ws = fs.createWriteStream("/dev/null")

    const toHex = () => {
      const reverse = new Transform()

      reverse._transform = (chunk, enc, callback) => {
        reverse.push(chunk.toString("hex"))
        callback()
      }

      return reverse
    }

    let wsClosed = false
    let rsClosed = false
    let callbackCalled = false

    const check = () => {
      if (wsClosed && rsClosed && callbackCalled) {
        assert.ok(true, "test-node.js passes")
        clearTimeout(timeout)
      }
    }

    ws.on("close", () => {
      wsClosed = true
      check()
    })

    rs.on("close", () => {
      rsClosed = true
      check()
    })

    const res = await pump(rs, toHex(), toHex(), toHex(), ws)
    callbackCalled = true
    check()

    if (res !== ws) {
      assert.fail("should return last stream")
    }

    setTimeout(() => {
      rs.destroy()
    }, 1000)

    const timeout = setTimeout(() => {
      assert.fail("timeout")
    }, 5000)
  })
})
