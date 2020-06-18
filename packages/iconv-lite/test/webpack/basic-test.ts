import { strict as assert } from "assert"

describe("iconv-lite", () => {
  let iconv

  it("can be require-d successfully", () => {
    // Emulate more complex environments that are both web- and node.js-compatible (e.g. Electron renderer process).
    // See https://github.com/ashtuchkin/iconv-lite/issues/204 for details.
    process.versions.node = "12.0.0"

    iconv = require(".").iconv
  })

  it("does not support streams by default", () => {
    assert(!iconv.supportsStreams)

    assert.throws(() => {
      iconv.encodeStream()
    }, /Streaming API is not enabled/)
  })

  it("can encode/decode sbcs encodings", () => {
    const buf = iconv.encode("abc", "win1251")
    const str = iconv.decode(buf, "win1251")
    assert.equal(str, "abc")
  })

  it("can encode/decode dbcs encodings", () => {
    const buf = iconv.encode("abc", "shiftjis")
    const str = iconv.decode(buf, "shiftjis")
    assert.equal(str, "abc")
  })

  it("can encode/decode internal encodings", () => {
    const buf = iconv.encode("💩", "utf8")
    const str = iconv.decode(buf, "utf8")
    assert.equal(str, "💩")
  })
})

describe("stream module", () => {
  it("is not included in the bundle", () => {
    const stream_module_name = "stream"
    assert.throws(() => require(stream_module_name), /Cannot find module 'stream'/)
  })
})
