import { Readable } from "stream"
import { isFunction } from "lodash"

function isReadable({ pipe, readable, _read, _readableState }) {
  return isFunction(pipe) && !!readable && isFunction(_read) && !!_readableState
}

function addStream(this: OrderedStreams, streams, stream) {
  if (!isReadable(stream)) {
    throw Error("All input streams must be readable")
  }

  const self = this

  stream._buffer = []

  stream.on("readable", function () {
    let chunk = stream.read()
    while (chunk) {
      if (this === streams[0]) {
        self.push(chunk)
      } else {
        this._buffer.push(chunk)
      }
      chunk = stream.read()
    }
  })

  stream.on("end", () => {
    for (
      let stream = streams[0];
      stream && stream._readableState.ended;
      stream = streams[0]
    ) {
      while (stream._buffer.length) {
        this.push(stream._buffer.shift())
      }

      streams.shift()
    }

    if (!streams.length) {
      this.push(null)
    }
  })

  stream.on("error", this.emit.bind(this, "error"))

  streams.push(stream)
}

export class OrderedStreams extends Readable {
  constructor(
    streams: NodeJS.ReadableStream | any[] = [],
    options = { objectMode: true }
  ) {
    options.objectMode = true

    super(options)

    if (!Array.isArray(streams)) {
      streams = [streams]
    }
    if (!streams.length) {
      this.push(null) // no streams, close
    } else {
      const _streams = []
      streams.flat(1).forEach(item => {
        addStream.call(this, _streams, item)
      })
    }
  }

  _read() {}
}

export default OrderedStreams
