import { Writable } from "stream"
export default resumer

function resumer(stream) {
  if (!stream.readable) {
    return stream
  }

  if (stream._read) {
    stream.pipe(new Sink())
    return stream
  }

  if (typeof stream.resume === "function") {
    stream.resume()
    return stream
  }

  return stream
}

class Sink extends Writable {
  constructor() {
    super({
      objectMode: true,
    })
  }

  _write(chunk, encoding, cb) {
    setImmediate(cb)
  }
}
