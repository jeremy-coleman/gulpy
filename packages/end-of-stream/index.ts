import { once, noop, isFunction } from "lodash"
import type { ClientRequest } from "http"
import * as stream from "stream"
import type { ChildProcess, ChildProcessWithoutNullStreams } from "child_process"

export function isRequest(stream): stream is ClientRequest {
  return stream.setHeader && isFunction(stream.abort)
}

function isChildProcess(stream): stream is ChildProcess {
  return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3
}

// Type definitions for end-of-stream 1.4
// Project: https://github.com/mafintosh/end-of-stream
// Definitions by: Sami Kukkonen <https://github.com/strax>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
interface Options {
  readable?: boolean
  writable?: boolean
  error?: boolean
}

export type Stream =
  | stream.Stream
  | NodeJS.ReadableStream
  | NodeJS.WritableStream
  | ChildProcess
  | ChildProcessWithoutNullStreams
type Callback = (error?: Error | null) => void

export default eos
export { eos }

function eos(stream: Stream, callback?: Callback): () => void
function eos(stream: Stream, options: Options, callback?: Callback): () => void

function eos(stream: any, opts?: Options | Callback, _callback?: Callback) {
  if (isFunction(opts)) return eos(stream, {}, opts)
  if (!opts) opts = {}

  const callback = once(_callback || noop)!

  const ws = stream._writableState
  const rs = stream._readableState
  let readable = opts.readable || (opts.readable !== false && stream.readable)
  let writable = opts.writable || (opts.writable !== false && stream.writable)
  let cancelled = false

  function onLegacyFinish() {
    if (!stream.writable) onFinish()
  }

  function onFinish() {
    writable = false
    if (!readable) callback.call(stream)
  }

  function onEnd() {
    readable = false
    if (!writable) callback.call(stream)
  }

  function onExit(exitCode: number) {
    callback.call(stream, exitCode ? Error(`exited with error code: ${exitCode}`) : null)
  }

  function onError(err) {
    callback.call(stream, err)
  }

  function onClose() {
    process.nextTick(onCloseNextTick)
  }

  function onCloseNextTick() {
    if (cancelled) return
    if (readable && !(rs && rs.ended && !rs.destroyed))
      return callback.call(stream, new Error("premature close"))
    if (writable && !(ws && ws.ended && !ws.destroyed))
      return callback.call(stream, new Error("premature close"))
  }

  function onRequest() {
    stream.req.on("finish", onFinish)
  }

  if (isRequest(stream)) {
    stream.on("complete", onFinish)
    stream.on("abort", onClose)
    if (stream.req) {
      onRequest()
    } else {
      stream.on("request", onRequest)
    }
  } else if (writable && !ws) {
    // legacy streams
    stream.on("end", onLegacyFinish)
    stream.on("close", onLegacyFinish)
  }

  if (isChildProcess(stream)) {
    stream.on("exit", onExit)
  }

  stream.on("end", onEnd)
  stream.on("finish", onFinish)
  if (opts.error !== false) {
    stream.on("error", onError)
  }
  stream.on("close", onClose)

  return () => {
    cancelled = true
    stream.removeListener("complete", onFinish)
    stream.removeListener("abort", onClose)
    stream.removeListener("request", onRequest)
    stream.req?.removeListener("finish", onFinish)
    stream.removeListener("end", onLegacyFinish)
    stream.removeListener("close", onLegacyFinish)
    stream.removeListener("finish", onFinish)
    stream.removeListener("exit", onExit)
    stream.removeListener("end", onEnd)
    stream.removeListener("error", onError)
    stream.removeListener("close", onClose)
  }
}
