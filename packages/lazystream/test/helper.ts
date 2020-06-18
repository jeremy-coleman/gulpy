import _Readable from "readable-stream/readable"
import _Writable from "readable-stream/writable"

export class DummyReadable extends _Readable {
  constructor(strings) {
    super()
    this.strings = strings
    this.emit("readable")
  }

  _read(n) {
    if (this.strings.length) {
      this.push(new Buffer(this.strings.shift()))
    } else {
      this.push(null)
    }
  }
}

export class DummyWritable extends _Writable {
  constructor(strings) {
    super()
    this.strings = strings
    this.emit("writable")
  }

  _write(chunk, encoding, callback) {
    this.strings.push(chunk.toString())
    if (callback) callback()
  }
}
