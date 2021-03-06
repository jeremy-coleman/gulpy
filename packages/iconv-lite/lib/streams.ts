import { Transform } from "stream"
import { isString } from "lodash"

// NOTE: Due to 'stream' module being pretty large (~100Kb, significant in browser environments),
// we opt to dependency-inject it instead of creating a hard dependency.
// == Encoder stream =======================================================

export class IconvLiteEncoderStream extends Transform {
  constructor(conv, options) {
    super(options)
    this.conv = conv
    options = options || {}
    options.decodeStrings = false // We accept only strings, so we don't need to decode them.
  }

  _transform(chunk, encoding, done) {
    if (!isString(chunk))
      return done(new Error("Iconv encoding stream needs strings as its input."))
    try {
      const res = this.conv.write(chunk)
      if (res && res.length) this.push(res)
      done()
    } catch (e) {
      done(e)
    }
  }

  _flush(done) {
    try {
      const res = this.conv.end()
      if (res && res.length) this.push(res)
      done()
    } catch (e) {
      done(e)
    }
  }

  collect(cb) {
    const chunks = []
    this.on("error", cb)
    this.on("data", chunk => {
      chunks.push(chunk)
    })
    this.on("end", () => {
      cb(null, Buffer.concat(chunks))
    })
    return this
  }
}

IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, {
  constructor: { value: IconvLiteEncoderStream },
})

// == Decoder stream =======================================================

export class IconvLiteDecoderStream {
  constructor(conv, options) {
    this.conv = conv
    options = options || {}
    options.encoding = this.encoding = "utf8" // We output strings.
    Transform.call(this, options)
  }

  _transform(chunk, encoding, done) {
    if (!Buffer.isBuffer(chunk))
      return done(new Error("Iconv decoding stream needs buffers as its input."))
    try {
      const res = this.conv.write(chunk)
      if (res && res.length) this.push(res, this.encoding)
      done()
    } catch (e) {
      done(e)
    }
  }

  _flush(done) {
    try {
      const res = this.conv.end()
      if (res && res.length) this.push(res, this.encoding)
      done()
    } catch (e) {
      done(e)
    }
  }

  collect(cb) {
    let res = ""
    this.on("error", cb)
    this.on("data", chunk => {
      res += chunk
    })
    this.on("end", () => {
      cb(null, res)
    })
    return this
  }
}
