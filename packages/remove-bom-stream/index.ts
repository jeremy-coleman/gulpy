import through from "through2"
import { removeBOM } from "@local/remove-bom-buffer"

export function removeBomStream() {
  let completed = false
  let buffer = Buffer.alloc(0)

  return through(onChunk, onFlush)

  function removeAndCleanup(data) {
    completed = true
    buffer = null!
    return removeBOM(data)
  }

  function onChunk(data, enc, cb) {
    if (completed) {
      return cb(null, data)
    }

    if (data.length >= 7) {
      return cb(null, removeAndCleanup(data))
    }

    const bufferLength = buffer.length
    const chunkLength = data.length
    const totalLength = bufferLength + chunkLength

    buffer = Buffer.concat([buffer, data], totalLength)

    if (totalLength >= 7) {
      return cb(null, removeAndCleanup(buffer))
    }
    cb()
  }

  function onFlush(cb) {
    if (completed || !buffer) {
      return cb()
    }

    cb(null, removeAndCleanup(buffer))
  }
}

export default removeBomStream
