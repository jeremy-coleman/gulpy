"use strict"
exports.__esModule = true
var lodash_es_1 = require("lodash")
function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === "function"
}
function isChildProcess(stream) {
  return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3
}
exports["default"] = eos
function eos(stream, opts, _callback) {
  if (lodash_es_1.isFunction(opts)) return eos(stream, {}, opts)
  if (!opts) opts = {}
  var callback = lodash_es_1.once(_callback || lodash_es_1.noop)
  var ws = stream._writableState
  var rs = stream._readableState
  var readable = opts.readable || (opts.readable !== false && stream.readable)
  var writable = opts.writable || (opts.writable !== false && stream.writable)
  var cancelled = false
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
  function onExit(exitCode) {
    callback.call(stream, exitCode ? Error("exited with error code: " + exitCode) : null)
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
  return function () {
    var _a
    cancelled = true
    stream.removeListener("complete", onFinish)
    stream.removeListener("abort", onClose)
    stream.removeListener("request", onRequest)
    ;(_a = stream.req) === null || _a === void 0
      ? void 0
      : _a.removeListener("finish", onFinish)
    stream.removeListener("end", onLegacyFinish)
    stream.removeListener("close", onLegacyFinish)
    stream.removeListener("finish", onFinish)
    stream.removeListener("exit", onExit)
    stream.removeListener("end", onEnd)
    stream.removeListener("error", onError)
    stream.removeListener("close", onClose)
  }
}
