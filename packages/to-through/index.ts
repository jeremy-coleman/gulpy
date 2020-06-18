import through from "through2"

function forward(chunk, enc, cb) {
  cb(null, chunk)
}

function toThrough(readable) {
  const opts = {
    objectMode: readable._readableState.objectMode,
    highWaterMark: readable._readableState.highWaterMark,
  }

  function flush(cb) {
    const self = this

    readable.on("readable", onReadable)
    readable.on("end", cb)

    function onReadable() {
      let chunk
      while ((chunk = readable.read())) {
        self.push(chunk)
      }
    }
  }

  const wrapper = through(opts, forward, flush)

  let shouldFlow = true
  wrapper.once("pipe", onPipe)
  wrapper.on("newListener", onListener)
  readable.on("error", wrapper.emit.bind(wrapper, "error"))

  function onListener(event) {
    // Once we've seen the data or readable event, check if we need to flow
    if (event === "data" || event === "readable") {
      maybeFlow()
      this.removeListener("newListener", onListener)
    }
  }

  function onPipe() {
    // If the wrapper is piped, disable flow
    shouldFlow = false
  }

  function maybeFlow() {
    // If we need to flow, end the stream which triggers flush
    if (shouldFlow) {
      wrapper.end()
    }
  }

  return wrapper
}

export default toThrough
