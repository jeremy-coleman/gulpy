import { once, isFunction } from "lodash"
import eos, { isRequest } from "end-of-stream"
import type { Stream } from "end-of-stream"
import type { Writable } from "stream"

const isWritable = (stream: any): stream is Writable => isFunction(stream.destroy)

const destroyer = (stream: Stream, reading, writing, callback) => {
  callback = once(callback)

  let closed = false
  stream.on("close", () => {
    closed = true
  })

  eos(stream, { readable: reading, writable: writing }, err => {
    if (err) return callback(err)
    closed = true
    callback()
  })

  let destroyed = false
  return (err?: Error) => {
    if (closed) return
    if (destroyed) return
    destroyed = true

    if (isRequest(stream)) return stream.abort() // request.destroy just do .end - .abort is what we want

    if (isWritable(stream)) return stream.destroy()

    callback(err ?? Error("stream was destroyed"))
  }
}

const call = (fn: () => void) => fn()
const pipe = (from, to) => from.pipe(to)

export const pump = (...streams: Stream[]) =>
  new Promise<Stream>((resolve, reject) => {
    if (streams.length < 2) throw new Error("pump requires two streams per minimum")

    let error: Error
    const destroys = streams.map((stream, i) => {
      const reading = i < streams.length - 1
      const writing = i > 0
      return destroyer(stream, reading, writing, err => {
        if (!error) error = err
        if (err) destroys.forEach(call)
        if (reading) return
        destroys.forEach(call)
        reject(error)
      })
    })

    resolve(streams.reduce(pipe))
  })

export default pump
