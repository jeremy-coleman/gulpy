import { strict as assert } from "assert"

describe("iconv-lite with streams", () => {
  const iconv = require(".").iconv

  it("supports streams when explicitly enabled", () => {
    iconv.enableStreamingAPI(require("stream"))
    assert(iconv.supportsStreams)
  })

  it("can encode/decode in streaming mode", done => {
    const stream1 = iconv.encodeStream("win1251")
    const stream2 = iconv.decodeStream("win1251")
    stream1.pipe(stream2)

    stream1.end("abc")
    stream2.collect((err, str) => {
      if (err) return done(err)

      assert.equal(str, "abc")
      done(null)
    })
  })
})
