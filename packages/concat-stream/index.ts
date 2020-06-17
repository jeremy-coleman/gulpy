import { Writable } from "stream"
import { isFunction, isString } from "lodash"

interface ConcatOpts {
  encoding?: string
}

// Type definitions for concat-stream 1.6
// Project: https://github.com/maxogden/concat-stream
// Definitions by: Joey Marianer <https://github.com/jmarianer>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export class ConcatStream extends Writable {
  body: any[]
  encoding: "uint8array" | "buffer" | "array" | "string" | "object"
  shouldInferEncoding: boolean

  constructor(opts: ConcatOpts, cb?: (buf: Buffer) => void) {
    let encoding = opts.encoding
    let shouldInferEncoding = false

    if (!encoding) {
      shouldInferEncoding = true
    } else {
      encoding = String(encoding).toLowerCase()
      if (encoding === "u8" || encoding === "uint8") {
        encoding = "uint8array"
      }
    }

    super({ objectMode: true })

    this.encoding = encoding as any
    this.shouldInferEncoding = shouldInferEncoding

    if (cb) {
      this.on("finish", function () {
        cb(this.getBody())
      })
    }
    this.body = []
  }

  _write(chunk, _enc, next) {
    this.body.push(chunk)
    next()
  }

  inferEncoding(buffer: Buffer | Uint8Array | any[] | string | object = this.body[0]) {
    return Buffer.isBuffer(buffer)
      ? "buffer"
      : buffer instanceof Uint8Array
      ? "uint8array"
      : Array.isArray(buffer)
      ? "array"
      : isString(buffer)
      ? "string"
      : {}.toString.call(buffer) === "[object Object]"
      ? "object"
      : "buffer"
  }

  getBody() {
    if (!this.encoding && this.body.length === 0) return []
    if (this.shouldInferEncoding) this.encoding = this.inferEncoding()
    if (this.encoding === "array") return arrayConcat(this.body)
    if (this.encoding === "string") return stringConcat(this.body)
    if (this.encoding === "buffer") return bufferConcat(this.body)
    if (this.encoding === "uint8array") return u8Concat(this.body)
    return this.body
  }
}

function isArrayish(arr) {
  return /Array\]$/.test({}.toString.call(arr))
}

function isBufferLike(p) {
  return isString(p) || isArrayish(p) || (p && isFunction(p.subarray))
}

function stringConcat(parts) {
  const strings: (Buffer | string)[] = parts.map(p =>
    isString(p) || Buffer.isBuffer(p)
      ? p
      : isBufferLike(p)
      ? Buffer.from(p)
      : Buffer.from(String(p))
  )

  if (Buffer.isBuffer(parts[0])) {
    return Buffer.concat(strings as Buffer[]).toString("utf8")
  } else {
    return strings.join("")
  }
}

function bufferConcat(parts) {
  const buffers: Buffer[] = parts.map(p =>
    Buffer.isBuffer(p) ? p : isBufferLike(p) ? Buffer.from(p) : Buffer.from(String(p))
  )
  return Buffer.concat(buffers)
}

function arrayConcat<T>(parts: T[][]) {
  const res: T[] = []
  for (let i = 0; i < parts.length; i++) {
    res.push(...parts[i])
  }
  return res
}

function u8Concat(parts: any[] | string[]) {
  let len = 0
  for (let i = 0; i < parts.length; i++) {
    if (isString(parts[i])) {
      parts[i] = Buffer.from(parts[i])
    }
    len += parts[i].length
  }

  const u8 = new Uint8Array(len)
  for (let i = 0, offset = 0; i < parts.length; i++) {
    const part = parts[i]
    for (let j = 0; j < part.length; j++) {
      u8[offset++] = part[j]
    }
  }
  return u8
}

function concat(cb?: (buf: Buffer) => void): ConcatStream
function concat(opts?: ConcatOpts, cb?: (buf: Buffer) => void): ConcatStream

function concat(opts, cb?) {
  if (isFunction(opts)) {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}
  return new ConcatStream(opts, cb)
}

export { concat }
export default concat
