"use strict"

var assert = require("assert")
var events = require("events")
var lodash = require("lodash")
var domain = require("domain")
var stream = require("stream")
var util = require("util")
var glob = require("glob")
var path = require("path")
var fs = require("fs")
var os = require("os")
var fs$1 = require("fs-extra")
var chokidar = require("chokidar")

function isRequest(stream) {
  return stream.setHeader && lodash.isFunction(stream.abort)
}

function isChildProcess(stream) {
  return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3
}

function eos(stream, opts, _callback) {
  if (lodash.isFunction(opts)) return eos(stream, {}, opts)
  if (!opts) opts = {}
  const callback = lodash.once(_callback || lodash.noop)
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

  function onExit(exitCode) {
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
    var _stream$req

    cancelled = true
    stream.removeListener("complete", onFinish)
    stream.removeListener("abort", onClose)
    stream.removeListener("request", onRequest)
    ;(_stream$req = stream.req) === null || _stream$req === void 0
      ? void 0
      : _stream$req.removeListener("finish", onFinish)
    stream.removeListener("end", onLegacyFinish)
    stream.removeListener("close", onLegacyFinish)
    stream.removeListener("finish", onFinish)
    stream.removeListener("exit", onExit)
    stream.removeListener("end", onEnd)
    stream.removeListener("error", onError)
    stream.removeListener("close", onClose)
  }
}

function resumer(stream) {
  if (!stream.readable) {
    return stream
  }

  if (stream._read) {
    stream.pipe(new Sink())
    return stream
  }

  if (lodash.isFunction(stream.resume)) {
    stream.resume()
    return stream
  }

  return stream
}

class Sink extends stream.Writable {
  constructor() {
    super({
      objectMode: true,
    })
  }

  _write(chunk, encoding, cb) {
    setImmediate(cb)
  }
}

const eosConfig = {
  error: false,
}
function asyncDone(fn, cb) {
  cb = lodash.once(cb)
  const d = domain.create()
  d.once("error", onError)
  const domainBoundFn = d.bind(fn)

  function done(...rest) {
    d.removeListener("error", onError)
    d.exit()

    try {
      return cb(...rest)
    } catch (e) {
      process.nextTick(() => {
        throw e
      })
    }
  }

  function onSuccess(result) {
    done(null, result)
  }

  function onError(error = Error("Promise rejected without Error")) {
    done(error)
  }

  function asyncRunner() {
    const result = domainBoundFn(done)

    function onNext(state) {
      onNext.state = state
    }

    onNext.state = null

    function onCompleted() {
      onSuccess(onNext.state)
    }

    if (result && lodash.isFunction(result.on)) {
      d.add(result)
      eos(resumer(result), eosConfig, done)
      return
    }

    if (result && lodash.isFunction(result.subscribe)) {
      result.subscribe(onNext, onError, onCompleted)
      return
    }

    if (result && lodash.isFunction(result.then)) {
      result.then(onSuccess, onError)
      return
    }
  }

  process.nextTick(asyncRunner)
}

function initializeResults(values) {
  const keys = Object.keys(values)
  const results = Array.isArray(values) ? [] : {}
  let idx = 0
  const length = keys.length

  for (idx = 0; idx < length; idx++) {
    const key = keys[idx]
    results[key] = undefined
  }

  return results
}

function map(values, iterator, extensions, done) {
  if (lodash.isFunction(extensions)) {
    done = extensions
    extensions = {}
  }

  if (!lodash.isFunction(done)) {
    done = lodash.noop
  }

  done = lodash.once(done)
  const keys = Object.keys(values)
  const length = keys.length
  let count = length
  let idx = 0
  const results = initializeResults(values)
  const exts = extensions

  if (length === 0) {
    return done(null, results)
  }

  for (idx = 0; idx < length; idx++) {
    const key = keys[idx]
    next(key)
  }

  function next(key) {
    var _exts$create, _exts$before

    const value = values[key]
    const storage =
      ((_exts$create = exts.create) === null || _exts$create === void 0
        ? void 0
        : _exts$create.call(exts, value, key)) || {}
    ;(_exts$before = exts.before) === null || _exts$before === void 0
      ? void 0
      : _exts$before.call(exts, storage)
    iterator(value, key, lodash.once(handler))

    function handler(err, result) {
      var _exts$after

      if (err) {
        var _exts$error

        ;(_exts$error = exts.error) === null || _exts$error === void 0
          ? void 0
          : _exts$error.call(exts, err, storage)
        return done(err, results)
      }

      ;(_exts$after = exts.after) === null || _exts$after === void 0
        ? void 0
        : _exts$after.call(exts, result, storage)
      results[key] = result

      if (--count === 0) {
        done(err, results)
      }
    }
  }
}

function mapSeries(values, iterator, extensions, done) {
  if (lodash.isFunction(extensions)) {
    done = extensions
    extensions = {}
  }

  if (!lodash.isFunction(done)) {
    done = lodash.noop
  }

  done = lodash.once(done)
  const keys = Object.keys(values)
  const length = keys.length
  let idx = 0
  const results = initializeResults(values)
  const exts = extensions

  if (length === 0) {
    return done(null, results)
  }

  const key = keys[idx]
  next(key)

  function next(key) {
    var _exts$create, _exts$before

    const value = values[key]
    const storage =
      ((_exts$create = exts.create) === null || _exts$create === void 0
        ? void 0
        : _exts$create.call(exts, value, key)) || {}
    ;(_exts$before = exts.before) === null || _exts$before === void 0
      ? void 0
      : _exts$before.call(exts, storage)
    iterator(value, key, lodash.once(handler))

    function handler(err, result) {
      var _exts$after

      if (err) {
        var _exts$error

        ;(_exts$error = exts.error) === null || _exts$error === void 0
          ? void 0
          : _exts$error.call(exts, err, storage)
        return done(err, results)
      }

      ;(_exts$after = exts.after) === null || _exts$after === void 0
        ? void 0
        : _exts$after.call(exts, result, storage)
      results[key] = result

      if (++idx >= length) {
        done(err, results)
      } else {
        next(keys[idx])
      }
    }
  }
}

function getExtensions(lastArg) {
  if (!lodash.isFunction(lastArg)) {
    return lastArg
  }
}

function filterSuccess({ state }) {
  return state === "success"
}

function filterError({ state }) {
  return state === "error"
}

function onSettled(done) {
  if (!lodash.isFunction(done)) {
    done = lodash.noop
  }

  function onSettled(error, result) {
    if (error) {
      return done(error, null)
    }

    const settledErrors = result.filter(filterError)
    const settledResults = result.filter(filterSuccess)
    let errors = null

    if (settledErrors.length) {
      errors = settledErrors.map(x => x.value)
    }

    let results = null

    if (settledResults.length) {
      results = settledResults.map(x => x.value)
    }

    done(errors, results)
  }

  return onSettled
}
function verifyArguments(args) {
  args = args.flat(Infinity)
  const lastIdx = args.length - 1
  assert.ok(args.length, "A set of functions to combine is required")
  args.forEach((arg, argIdx) => {
    const _isFunction = lodash.isFunction(arg)

    if (_isFunction) {
      return
    }

    if (argIdx === lastIdx) {
      return
    }

    const msg = `Only functions can be combined, got ${typeof arg} for argument ${argIdx}`
    assert.ok(_isFunction, msg)
  })
  return args
}

function series(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function series(done) {
    mapSeries(args, (fn, _key, cb) => asyncDone(fn, cb), extensions, done)
  }

  return series
}

function parallel(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function parallel(done) {
    map(args, (fn, _key, cb) => asyncDone(fn, cb), extensions, done)
  }

  return parallel
}

function settle(fn, done) {
  asyncDone(fn, (error, result) => {
    const settled = {
      state: undefined,
      value: undefined,
    }

    if (error != null) {
      settled.state = "error"
      settled.value = error
    } else {
      settled.state = "success"
      settled.value = result
    }

    done(null, settled)
  })
}

function iterator(fn, _key, cb) {
  return settle(fn, cb)
}

function settleSeries(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function settleSeries(done) {
    const onSettled$1 = onSettled(done)
    mapSeries(args, iterator, extensions, onSettled$1)
  }

  return settleSeries
}

function iterator$1(fn, _key, cb) {
  return settle(fn, cb)
}

function settleParallel(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function settleParallel(done) {
    const onSettled$1 = onSettled(done)
    map(args, iterator$1, extensions, onSettled$1)
  }

  return settleParallel
}

class DefaultRegistry {
  constructor() {
    this._tasks = new Map()
  }

  init(taker) {}

  get(name) {
    return this._tasks.get(name)
  }

  set(name, fn) {
    this._tasks.set(name, fn)

    return fn
  }

  tasks() {
    return Object.fromEntries(this._tasks.entries())
  }
}

const metadata = new WeakMap()

function buildTree(tasks) {
  return tasks.map(task => {
    let meta = metadata.get(task)

    if (meta) {
      return meta.tree
    }

    const name = task.displayName || task.name || "<anonymous>"
    meta = {
      name,
      tree: {
        label: name,
        type: "function",
        nodes: [],
      },
    }
    metadata.set(task, meta)
    return meta.tree
  })
}

function normalizeArgs(registry, args) {
  function getFunction(task) {
    if (lodash.isFunction(task)) {
      return task
    }

    const fn = registry.get(task)
    assert.ok(fn, `Task never defined: ${task}`)
    return fn
  }

  const flattenArgs = args.flat(Infinity)
  assert.ok(
    flattenArgs.length,
    "One or more tasks should be combined using series or parallel"
  )
  return flattenArgs.map(getFunction)
}

const runtimes = new WeakMap()
function lastRun(fn, timeResolution) {
  const time = runtimes.get(fn)
  if (time == null) return
  const resolution = defaultResolution(timeResolution)
  return time - (time % resolution)
}
function capture(fn, timestamp = Date.now()) {
  runtimes.set(fn, timestamp)
}
function release(fn) {
  runtimes.delete(fn)
}
function defaultResolution(customResolution) {
  return (
    (lodash.isString(customResolution)
      ? parseInt(customResolution, 10)
      : customResolution) || 1
  )
}

let uid = 0

class Storage {
  constructor(fn) {
    this.fn = void 0
    this.uid = void 0
    this.name = void 0
    this.branch = void 0
    this.captureTime = void 0
    this.startHr = void 0
    const meta = metadata.get(fn)
    this.fn = meta.orig || fn
    this.uid = uid++
    this.name = meta.name
    this.branch = meta.branch || false
    this.captureTime = Date.now()
    this.startHr = []
  }

  capture() {
    capture(this.fn, this.captureTime)
  }

  release() {
    release(this.fn)
  }
}

function createExtensions(ee) {
  return {
    create(fn) {
      return new Storage(fn)
    },

    before(storage) {
      storage.startHr = process.hrtime()
      ee.emit("start", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        time: Date.now(),
      })
    },

    after(result, storage) {
      if (result && result.state === "error") {
        return this.error(result.value, storage)
      }

      storage.capture()
      ee.emit("stop", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        duration: process.hrtime(storage.startHr),
        time: Date.now(),
      })
    },

    error(error, storage) {
      if (Array.isArray(error)) {
        error = error[0]
      }

      storage.release()
      ee.emit("error", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        error,
        duration: process.hrtime(storage.startHr),
        time: Date.now(),
      })
    },
  }
}

function isConstructor(registry) {
  if (!(registry && registry.prototype)) {
    return false
  }

  const hasProtoGet = lodash.isFunction(registry.prototype.get)
  const hasProtoSet = lodash.isFunction(registry.prototype.set)
  const hasProtoInit = lodash.isFunction(registry.prototype.init)
  const hasProtoTasks = lodash.isFunction(registry.prototype.tasks)

  if (hasProtoGet || hasProtoSet || hasProtoInit || hasProtoTasks) {
    return true
  }

  return false
}

function validateRegistry(registry) {
  try {
    assert.ok(lodash.isFunction(registry.get), "Custom registry must have `get` function")
    assert.ok(lodash.isFunction(registry.set), "Custom registry must have `set` function")
    assert.ok(
      lodash.isFunction(registry.init),
      "Custom registry must have `init` function"
    )
    assert.ok(
      lodash.isFunction(registry.tasks),
      "Custom registry must have `tasks` function"
    )
  } catch (err) {
    if (isConstructor(registry)) {
      assert.ok(
        false,
        "Custom registries must be instantiated, but it looks like you passed a constructor"
      )
    } else {
      throw err
    }
  }
}

class Undertaker extends events.EventEmitter {
  constructor(customRegistry) {
    super()
    this._registry = new DefaultRegistry()
    this._settle = void 0

    if (customRegistry) {
      this.registry(customRegistry)
    }

    this._settle = process.env.UNDERTAKER_SETTLE === "true"
  }

  tree(options) {
    options = lodash.defaults(options || {}, {
      deep: false,
    })

    const tasks = this._registry.tasks()

    const nodes = lodash.map(tasks, task => {
      const meta = metadata.get(task)

      if (options.deep) {
        return meta.tree
      }

      return meta.tree.label
    })
    return {
      label: "Tasks",
      nodes,
    }
  }

  task(name, fn) {
    if (lodash.isFunction(name)) {
      fn = name
      name = fn.displayName || fn.name
      assert.ok(name != null, "Function must have a name")
    }

    if (!fn) {
      return this._getTask(name)
    }

    this._setTask(name, fn)
  }

  series(...rest) {
    const create = this._settle ? settleSeries : series
    const args = normalizeArgs(this._registry, rest)
    const extensions = createExtensions(this)
    const fn = create(args, extensions)
    metadata.set(fn, {
      name: "<series>",
      branch: true,
      tree: {
        label: "<series>",
        type: "function",
        branch: true,
        nodes: buildTree(args),
      },
    })
    return fn
  }

  lastRun(task, timeResolution) {
    if (timeResolution == null) {
      timeResolution = process.env.UNDERTAKER_TIME_RESOLUTION
    }

    let fn = lodash.isString(task) ? this._getTask(task) : task
    const meta = metadata.get(fn)

    if (meta) {
      fn = meta.orig || fn
    }

    return lastRun(fn, timeResolution)
  }

  parallel(...rest) {
    const create = this._settle ? settleParallel : parallel
    const args = normalizeArgs(this._registry, rest)
    const extensions = createExtensions(this)
    const fn = create(args, extensions)
    metadata.set(fn, {
      name: "<parallel>",
      branch: true,
      tree: {
        label: "<parallel>",
        type: "function",
        branch: true,
        nodes: buildTree(args),
      },
    })
    return fn
  }

  registry(newRegistry) {
    if (!newRegistry) {
      return this._registry
    }

    validateRegistry(newRegistry)

    const tasks = this._registry.tasks()

    lodash.forEach(tasks, (task, name) => {
      newRegistry.set(name, task)
    })
    this._registry = newRegistry

    this._registry.init(this)
  }

  _getTask(name) {
    return this._registry.get(name)
  }

  _setTask(name, fn) {
    assert.ok(name, "Task name must be specified")

    function taskWrapper(...args) {
      return fn.apply(this, args)
    }

    function unwrap() {
      return fn
    }

    taskWrapper.unwrap = unwrap
    taskWrapper.displayName = name
    const meta = metadata.get(fn)
    const nodes = []

    if (meta === null || meta === void 0 ? void 0 : meta.branch) {
      nodes.push(meta.tree)
    }

    const task = this._registry.set(name, taskWrapper) || taskWrapper
    metadata.set(task, {
      name,
      orig: fn,
      tree: {
        label: name,
        type: "task",
        nodes,
      },
    })
  }
}

function isReadable({ pipe, readable, _read, _readableState }) {
  return (
    lodash.isFunction(pipe) && !!readable && lodash.isFunction(_read) && !!_readableState
  )
}

function addStream(streams, stream) {
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

class OrderedStreams extends stream.Readable {
  constructor(
    streams = [],
    options = {
      objectMode: true,
    }
  ) {
    options.objectMode = true
    super(options)

    if (!Array.isArray(streams)) {
      streams = [streams]
    }

    if (!streams.length) {
      this.push(null)
    } else {
      const _streams = []
      streams.flat(1).forEach(item => {
        addStream.call(this, _streams, item)
      })
    }
  }

  _read() {}
}

class DestroyableTransform extends stream.Transform {
  constructor(...args) {
    super(...args)
    this._destroyed = false
  }

  destroy(err) {
    if (this._destroyed) return
    this._destroyed = true
    process.nextTick(() => {
      if (err) this.emit("error", err)
      this.emit("close")
    })
  }
}

const noop = (chunk, _enc, callback) => {
  callback(null, chunk)
}

function through2(construct) {
  const fn = (options, transform, flush) => {
    if (lodash.isFunction(options)) {
      flush = transform
      transform = options
      options = {}
    }

    if (!lodash.isFunction(transform)) transform = noop
    if (!lodash.isFunction(flush)) flush = undefined
    return construct(options, transform, flush)
  }

  return fn
}

const main = through2((options, transform, flush) => {
  const t2 = new DestroyableTransform(options)
  t2._transform = transform
  if (flush) t2._flush = flush
  return t2
})
const ctor = through2((options, transform, flush) => {
  function Through2(override) {
    if (!(this instanceof Through2)) {
      return new Through2(override)
    }

    this.options = { ...options, ...override }
    stream.Transform.call(this, this.options)
  }

  util.inherits(Through2, DestroyableTransform)
  Through2.prototype._transform = transform
  if (flush) Through2.prototype._flush = flush
  return Through2
})
const obj = through2((options, transform, flush) => {
  const t2 = new DestroyableTransform({
    objectMode: true,
    highWaterMark: 16,
    ...options,
  })
  t2._transform = transform
  if (flush) t2._flush = flush
  return t2
})

function ctor$1(fn, options) {
  const Filter = ctor(options, function (chunk, _encoding, callback) {
    if (options === null || options === void 0 ? void 0 : options.wantStrings)
      chunk = chunk.toString()

    try {
      if (fn.call(this, chunk, this._index++)) this.push(chunk)
      return callback()
    } catch (e) {
      return callback(e)
    }
  })
  Filter.prototype._index = 0
  return Filter
}
function make(fn, options) {
  return ctor$1(fn, options)()
}
function obj$1(fn, options) {
  return make(fn, {
    objectMode: true,
    highWaterMark: 16,
    ...options,
  })
}

function unique(by, keyStore = new Set()) {
  const keyfn = lodash.isString(by)
    ? data => data[by]
    : lodash.isFunction(by)
    ? by
    : JSON.stringify
  return obj$1(data => {
    const key = keyfn(data)

    if (keyStore.has(key)) {
      return false
    }

    keyStore.add(key)
    return true
  })
}

function shift(stream) {
  const rs = stream["_readableState"]
  if (!rs) return null
  return rs.objectMode || lodash.isNumber(stream["_duplexState"])
    ? stream.read()
    : stream.read(getStateLength(rs))
}

function getStateLength(state) {
  if (state.buffer.length) {
    if (state.buffer.head) {
      return state.buffer.head.data.length
    }

    return state.buffer[0].length
  }

  return state.length
}

const SIGNAL_FLUSH =
  Buffer.from && Buffer.from !== Uint8Array.from ? Buffer.from([0]) : new Buffer([0])

const onuncork = (self, fn) => {
  if (self._corked) self.once("uncork", fn)
  else fn()
}

const autoDestroy = (self, err) => {
  if (self._autoDestroy) self.destroy(err)
}

const destroyer = (self, end) => err => {
  if (err) autoDestroy(self, err.message === "premature close" ? null : err)
  else if (end && !self._ended) self.end()
}

const end = (ws, fn) => {
  if (!ws) return fn()
  if (ws._writableState && ws._writableState.finished) return fn()
  if (ws._writableState) return ws.end(fn)
  ws.end()
  fn()
}

const toStreams2 = rs =>
  new stream.Readable({
    objectMode: true,
    highWaterMark: 16,
  }).wrap(rs)

class Duplexify extends stream.Duplex {
  constructor(writable, readable, opts) {
    super(opts)
    this._writable = null
    this._readable = null
    this._readable2 = null
    this._autoDestroy = void 0
    this._forwardDestroy = void 0
    this._forwardEnd = void 0
    this._corked = 1
    this._ondrain = null
    this._drained = false
    this._forwarding = false
    this._unwrite = null
    this._unread = null
    this._ended = false
    this._autoDestroy = !opts || opts.autoDestroy !== false
    this._forwardDestroy = !opts || opts.destroy !== false
    this._forwardEnd = !opts || opts.end !== false
    this.destroyed = false
    if (writable) this.setWritable(writable)
    if (readable) this.setReadable(readable)
  }

  cork() {
    if (++this._corked === 1) this.emit("cork")
  }

  uncork() {
    if (this._corked && --this._corked === 0) this.emit("uncork")
  }

  setWritable(writable) {
    if (this._unwrite) this._unwrite()

    if (this.destroyed) {
      if (writable && writable.destroy) writable.destroy()
      return
    }

    if (writable === null || writable === false) {
      this.end()
      return
    }
    const unend = eos(
      writable,
      {
        writable: true,
        readable: false,
      },
      destroyer(this, this._forwardEnd)
    )

    const ondrain = () => {
      const ondrain = this._ondrain
      this._ondrain = null
      if (ondrain) ondrain()
    }

    const clear = () => {
      this._writable.removeListener("drain", ondrain)

      unend()
    }

    if (this._unwrite) process.nextTick(ondrain)
    this._writable = writable

    this._writable.on("drain", ondrain)

    this._unwrite = clear
    this.uncork()
  }

  setReadable(readable) {
    if (this._unread) this._unread()

    if (this.destroyed) {
      if (readable && readable.destroy) readable.destroy()
      return
    }

    if (readable === null || readable === false) {
      this.push(null)
      this.resume()
      return
    }
    const unend = eos(
      readable,
      {
        writable: false,
        readable: true,
      },
      destroyer(this)
    )

    const onreadable = () => {
      this._forward()
    }

    const onend = () => {
      this.push(null)
    }

    const clear = () => {
      this._readable2.removeListener("readable", onreadable)

      this._readable2.removeListener("end", onend)

      unend()
    }

    this._drained = true
    this._readable = readable
    this._readable2 = readable._readableState ? readable : toStreams2(readable)

    this._readable2.on("readable", onreadable)

    this._readable2.on("end", onend)

    this._unread = clear

    this._forward()
  }

  _read() {
    this._drained = true

    this._forward()
  }

  _forward() {
    if (this._forwarding || !this._readable2 || !this._drained) return
    this._forwarding = true
    let data

    while (this._drained && (data = shift(this._readable2)) !== null) {
      if (this.destroyed) continue
      this._drained = this.push(data)
    }

    this._forwarding = false
  }

  destroy(err, cb) {
    if (!cb) cb = lodash.noop
    if (this.destroyed) return cb(null)
    this.destroyed = true
    const self = this
    process.nextTick(() => {
      self._destroy(err)

      cb(null)
    })
  }

  _destroy(err) {
    if (err) {
      const ondrain = this._ondrain
      this._ondrain = null
      if (ondrain) ondrain(err)
      else this.emit("error", err)
    }

    if (this._forwardDestroy) {
      if (this._readable && this._readable.destroy) this._readable.destroy()
      if (this._writable && this._writable.destroy) this._writable.destroy()
    }

    this.emit("close")
  }

  _write(data, enc, cb) {
    if (this.destroyed) return
    if (this._corked) return onuncork(this, this._write.bind(this, data, enc, cb))
    if (data === SIGNAL_FLUSH) return this._finish(cb)
    if (!this._writable) return cb()
    if (this._writable.write(data) === false) this._ondrain = cb
    else if (!this.destroyed) cb()
  }

  _finish(cb) {
    const self = this
    this.emit("preend")
    onuncork(this, () => {
      end(self._forwardEnd && self._writable, () => {
        if (self._writableState.prefinished === false)
          self._writableState.prefinished = true
        self.emit("prefinish")
        onuncork(self, cb)
      })
    })
  }

  end(data, enc, cb) {
    if (lodash.isFunction(data)) return this.end(null, null, data)
    if (lodash.isFunction(enc)) return this.end(data, null, enc)
    this._ended = true
    if (data) this.write(data)
    if (!this._writableState.ending) this.write(SIGNAL_FLUSH)
    return stream.Writable.prototype.end.call(this, cb)
  }
}

function duplexify(writable, readable, opts) {
  return new Duplexify(writable, readable, opts)
}

duplexify.obj = (writable, readable, opts) => {
  if (!opts) opts = {}
  opts.objectMode = true
  opts.highWaterMark = 16
  return new Duplexify(writable, readable, opts)
}

const toArray = args => {
  if (!args.length) return []
  return Array.isArray(args[0]) ? args[0] : Array.prototype.slice.call(args)
}

const define = opts => {
  class Pumpify extends duplexify {
    constructor(...args) {
      const streams = toArray(args)
      super(null, null, opts)
      if (streams.length) this.setPipeline(streams)
    }

    setPipeline(...args) {
      const streams = toArray(args)
      const self = this
      let ended = false
      let w = streams[0]
      let r = streams[streams.length - 1]
      r = r.readable ? r : null
      w = w.writable ? w : null

      const onclose = () => {
        streams[0].emit("error", new Error("stream was destroyed"))
      }

      this.on("close", onclose)
      this.on("prefinish", () => {
        if (!ended) self.cork()
      })
      pump(streams, err => {
        self.removeListener("close", onclose)
        if (err) return self.destroy(err.message === "premature close" ? null : err)
        ended = true
        if (self._autoDestroy === false) self._autoDestroy = true
        self.uncork()
      })
      if (this.destroyed) return onclose()
      this.setWritable(w)
      this.setReadable(r)
    }
  }

  return (...args) => new Pumpify(...args)
}

var pumpify = define({
  autoDestroy: false,
  destroy: false,
})
const obj$2 = define({
  autoDestroy: false,
  destroy: false,
  objectMode: true,
  highWaterMark: 16,
})

function isNegatedGlob(pattern) {
  if (!lodash.isString(pattern)) {
    throw TypeError("expected a string")
  }

  const glob = {
    negated: false,
    pattern,
    original: pattern,
  }

  if (pattern[0] === "!" && pattern[1] !== "(") {
    glob.negated = true
    glob.pattern = pattern.slice(1)
  }

  return glob
}

var id = 0

function _classPrivateFieldLooseKey(name) {
  return "__private_" + id++ + "_" + name
}

function _classPrivateFieldLooseBase(receiver, privateKey) {
  if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
    throw new TypeError("attempted to use private field on non-instance")
  }

  return receiver
}

const regex = /(\\).|([@?!+*]\(.*\))/
function isExtGlob(str) {
  if (!lodash.isString(str) || str === "") {
    return false
  }

  let match

  while ((match = regex.exec(str))) {
    if (match[2]) return true
    str = str.slice(match.index + match[0].length)
  }

  return false
}

const chars = {
  "{": "}",
  "(": ")",
  "[": "]",
}
const strictRegex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/
const relaxedRegex = /\\(.)|(^!|[*?{}()[\]]|\(\?)/
function isGlob(
  str,
  options = {
    strict: true,
  }
) {
  if (!lodash.isString(str) || str === "") {
    return false
  }

  if (isExtGlob(str)) {
    return true
  }

  let regex = strictRegex
  let match

  if ((options === null || options === void 0 ? void 0 : options.strict) === false) {
    regex = relaxedRegex
  }

  while ((match = regex.exec(str))) {
    if (match[2]) return true
    let idx = match.index + match[0].length
    const open = match[1]
    const close = open ? chars[open] : null

    if (open && close) {
      const n = str.indexOf(close, idx)

      if (n !== -1) {
        idx = n + 1
      }
    }

    str = str.slice(idx)
  }

  return false
}

const pathPosixDirname = path.posix.dirname
const isWin32 = process.platform === "win32"
const slash = "/"
const backslash = /\\/g
const enclosure = /[\{\[].*[\/]*.*[\}\]]$/
const globby = /(^|[^\\])([\{\[]|\([^\)]+$)/
const escaped = /\\([\!\*\?\|\[\]\(\)\{\}])/g
function globParent(str, opts = {}) {
  var _opts$flipBackslashes

  const flipBackslashes =
    (_opts$flipBackslashes = opts.flipBackslashes) != null ? _opts$flipBackslashes : true

  if (flipBackslashes && isWin32 && !str.includes(slash)) {
    str = str.replace(backslash, slash)
  }

  if (enclosure.test(str)) {
    str += slash
  }

  str += "a"

  do {
    str = pathPosixDirname(str)
  } while (isGlob(str) || globby.test(str))

  return str.replace(escaped, "$1")
}

function removeTrailingSeparator(path) {
  return path.replace(/(?<=.)\/+$/, "")
}

function toAbsoluteGlob(glob, opts) {
  var _opts$cwd

  let cwd = path.resolve(
    (_opts$cwd = opts === null || opts === void 0 ? void 0 : opts.cwd) != null
      ? _opts$cwd
      : process.cwd()
  )
  cwd = unix(cwd)
  let rootDir = opts === null || opts === void 0 ? void 0 : opts.root

  if (rootDir) {
    rootDir = unix(rootDir)

    if (process.platform === "win32" || !path.isAbsolute(rootDir)) {
      rootDir = unix(path.resolve(rootDir))
    }
  }

  if (glob.slice(0, 2) === "./") {
    glob = glob.slice(2)
  }

  if (glob.length === 1 && glob === ".") {
    glob = ""
  }

  const suffix = glob.slice(-1)
  const ing = isNegatedGlob(glob)
  glob = ing.pattern

  if (rootDir && glob.charAt(0) === "/") {
    glob = join(rootDir, glob)
  } else if (!path.isAbsolute(glob) || glob.slice(0, 1) === "\\") {
    glob = join(cwd, glob)
  }

  if (suffix === "/" && glob.slice(-1) !== "/") {
    glob += "/"
  }

  return ing.negated ? `!${glob}` : glob
}

function unix(filepath) {
  return filepath.replace(/\\/g, "/")
}

function join(dir, glob) {
  if (lodash.last(dir) === "/") {
    dir = dir.slice(0, -1)
  }

  if (glob[0] === "/") {
    glob = glob.slice(1)
  }

  if (!glob) return dir
  return `${dir}/${glob}`
}

const globErrMessage1 = "File not found with singular glob: "
const globErrMessage2 = " (if this was purposeful, use `allowEmpty` option)"

function getBasePath(ourGlob, opt) {
  return globParent(toAbsoluteGlob(ourGlob, opt))
}

function globIsSingular({ minimatch }) {
  const globSet = minimatch.set

  if (globSet.length !== 1) {
    return false
  }

  return globSet[0].every(lodash.isString)
}

class GlobStream extends stream.Readable {
  constructor(ourGlob, negatives, opt) {
    super({
      objectMode: true,
      highWaterMark: opt.highWaterMark || 16,
    })
    Object.defineProperty(this, _glob, {
      writable: true,
      value: void 0,
    })
    const ourOpt = { ...opt }
    delete ourOpt.highWaterMark

    function resolveNegatives(negative) {
      return toAbsoluteGlob(negative, ourOpt)
    }

    const ourNegatives = negatives.map(resolveNegatives)
    ourOpt.ignore = ourNegatives
    const cwd = ourOpt.cwd
    const allowEmpty = ourOpt.allowEmpty || false
    const basePath = ourOpt.base || getBasePath(ourGlob, ourOpt)
    ourGlob = toAbsoluteGlob(ourGlob, ourOpt)
    delete ourOpt.root
    const glob$1 = new glob.Glob(ourGlob, ourOpt)
    _classPrivateFieldLooseBase(this, _glob)[_glob] = glob$1
    let found = false
    glob$1.on("match", filepath => {
      found = true
      const obj = {
        cwd,
        base: basePath,
        path: removeTrailingSeparator(filepath),
      }

      if (!this.push(obj)) {
        glob$1.pause()
      }
    })
    glob$1.once("end", () => {
      if (allowEmpty !== true && !found && globIsSingular(glob$1)) {
        const err = new Error(globErrMessage1 + ourGlob + globErrMessage2)
        return this.destroy(err)
      }

      this.push(null)
    })

    const onError = err => {
      this.destroy(err)
    }

    glob$1.once("error", onError)
  }

  _read() {
    _classPrivateFieldLooseBase(this, _glob)[_glob].resume()
  }

  destroy(err) {
    const self = this

    _classPrivateFieldLooseBase(this, _glob)[_glob].abort()

    process.nextTick(() => {
      if (err) {
        self.emit("error", err)
      }

      self.emit("close")
    })
  }
}

var _glob = _classPrivateFieldLooseKey("glob")

function globStream(globs, opt) {
  if (!opt) {
    opt = {}
  }

  const ourOpt = Object.assign({}, opt)
  let ignore = ourOpt.ignore
  ourOpt.cwd = lodash.isString(ourOpt.cwd) ? ourOpt.cwd : process.cwd()
  ourOpt.dot = lodash.isBoolean(ourOpt.dot) ? ourOpt.dot : false
  ourOpt.silent = lodash.isBoolean(ourOpt.silent) ? ourOpt.silent : true
  ourOpt.cwdbase = lodash.isBoolean(ourOpt.cwdbase) ? ourOpt.cwdbase : false
  ourOpt.uniqueBy =
    lodash.isString(ourOpt.uniqueBy) || lodash.isFunction(ourOpt.uniqueBy)
      ? ourOpt.uniqueBy
      : "path"

  if (ourOpt.cwdbase) {
    ourOpt.base = ourOpt.cwd
  }

  if (lodash.isString(ignore)) {
    ignore = [ignore]
  }

  if (!Array.isArray(ignore)) {
    ignore = []
  }

  if (!Array.isArray(globs)) {
    globs = [globs]
  }

  const positives = []
  const negatives = []
  globs.forEach(sortGlobs)

  function sortGlobs(globString, index) {
    if (!lodash.isString(globString)) {
      throw Error(`Invalid glob at index ${index}`)
    }

    const glob = isNegatedGlob(globString)
    const globArray = glob.negated ? negatives : positives
    globArray.push({
      index,
      glob: glob.pattern,
    })
  }

  if (positives.length === 0) {
    throw Error("Missing positive glob")
  }

  const streams = positives.map(streamFromPositive)
  const aggregate = new OrderedStreams(streams)
  const uniqueStream = unique(ourOpt.uniqueBy)
  return obj$2(aggregate, uniqueStream)

  function streamFromPositive({ index, glob }) {
    const negativeGlobs = negatives
      .filter(indexGreaterThan(index))
      .map(toGlob)
      .concat(ignore)
    return new GlobStream(glob, negativeGlobs, ourOpt)
  }
}

function indexGreaterThan(index) {
  return obj => obj.index > index
}

function toGlob({ glob }) {
  return glob
}

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

  const wrapper = main(opts, forward, flush)
  let shouldFlow = true
  wrapper.once("pipe", onPipe)
  wrapper.on("newListener", onListener)
  readable.on("error", wrapper.emit.bind(wrapper, "error"))

  function onListener(event) {
    if (event === "data" || event === "readable") {
      maybeFlow()
      this.removeListener("newListener", onListener)
    }
  }

  function onPipe() {
    shouldFlow = false
  }

  function maybeFlow() {
    if (shouldFlow) {
      wrapper.end()
    }
  }

  return wrapper
}

const MASK_MODE = parseInt("7777", 8)
const DEFAULT_FILE_MODE = parseInt("0666", 8)
const DEFAULT_ENCODING = "utf8"

function resolve(config) {
  return {
    buffer: true,
    read: true,
    removeBOM: true,
    encoding: DEFAULT_ENCODING,
    sourcemaps: false,
    resolveSymlinks: true,
    ...config,
  }
}

function resolveOption(provider, arg) {
  return lodash.isFunction(provider) ? provider(arg) : provider
}

function prepareRead(options) {
  function normalize(file, _enc, callback) {
    const since = resolveOption(options.since, file)

    if (file.stat && file.stat.mtime <= since) {
      return callback()
    }

    return callback(null, file)
  }

  return obj(normalize)
}

class Cloneable extends stream.PassThrough {
  constructor(stream, opts) {
    const objectMode = stream._readableState.objectMode
    opts = opts || {}
    opts.objectMode = objectMode
    super(opts)
    this._original = stream
    this._clonesCount = 1
    forwardDestroy(stream, this)
    this.on("newListener", onData)
    this.once("resume", onResume)
    this._hasListener = true
  }

  clone() {
    if (!this._original) {
      throw Error("already started")
    }

    this._clonesCount++
    this.removeListener("newListener", onData)
    const clone = new Clone(this)

    if (this._hasListener) {
      this.on("newListener", onData)
    }

    return clone
  }

  _destroy(err, cb) {
    if (!err) {
      this.push(null)
      this.end()
    }

    process.nextTick(cb, err)
  }
}

function onData(event, listener) {
  if (event === "data" || event === "readable") {
    this._hasListener = false
    this.removeListener("newListener", onData)
    this.removeListener("resume", onResume)
    process.nextTick(clonePiped, this)
  }
}

function onResume() {
  this._hasListener = false
  this.removeListener("newListener", onData)
  process.nextTick(clonePiped, this)
}

function forwardDestroy(src, dest) {
  src.on("error", destroy)
  src.on("close", onClose)

  function destroy(err) {
    src.removeListener("close", onClose)
    dest.destroy(err)
  }

  function onClose() {
    dest.end()
  }
}

function clonePiped(that) {
  if (--that._clonesCount === 0 && !that._readableState.destroyed) {
    that._original.pipe(that)

    that._original = undefined
  }
}

class Clone extends stream.PassThrough {
  constructor(parent, opts) {
    if (!(this instanceof Clone)) {
      return new Clone(parent, opts)
    }

    const objectMode = parent._readableState.objectMode
    opts = opts || {}
    opts.objectMode = objectMode
    this.parent = parent
    super(opts)
    forwardDestroy(parent, this)
    parent.pipe(this)
    this.on("newListener", onDataClone)
    this.on("resume", onResumeClone)
  }

  clone() {
    return this.parent.clone()
  }

  _destroy(err, cb) {
    if (!err) {
      this.push(null)
      this.end()
    }

    process.nextTick(cb, err)
  }
}

function onDataClone(event, listener) {
  if (event === "data" || event === "readable" || event === "close") {
    process.nextTick(clonePiped, this.parent)
    this.removeListener("newListener", onDataClone)
  }
}

function onResumeClone() {
  this.removeListener("newListener", onDataClone)
  process.nextTick(clonePiped, this.parent)
}

Cloneable.isCloneable = stream => stream instanceof Cloneable || stream instanceof Clone

function replaceExt(nPath, ext) {
  if (!lodash.isString(nPath)) {
    return nPath
  }

  if (nPath.length === 0) {
    return nPath
  }

  const nFileName = path.basename(nPath, path.extname(nPath)) + ext
  const nFilepath = path.join(path.dirname(nPath), nFileName)

  if (startsWithSingleDot(nPath)) {
    return "." + path.sep + nFilepath
  }

  return nFilepath
}

function startsWithSingleDot(fPath) {
  const first2chars = fPath.slice(0, 2)
  return first2chars === "." + path.sep || first2chars === "./"
}

function isStream(stream) {
  if (!stream) {
    return false
  }

  if (!lodash.isFunction(stream.pipe)) {
    return false
  }

  return true
}

function normalize(str) {
  return str === "" ? str : path.normalize(str)
}

function inspectStream({ constructor }) {
  let streamType = constructor.name

  if (streamType === "Stream") {
    streamType = ""
  }

  return `<${streamType}Stream>`
}

const builtInFields = [
  "_contents",
  "_symlink",
  "contents",
  "stat",
  "history",
  "path",
  "_base",
  "base",
  "_cwd",
  "cwd",
]
class File {
  constructor(file = {}) {
    var _file$history$slice, _file$history

    this.history = void 0
    this.stat = void 0
    this.custom = void 0
    this.sourceMap = void 0
    this._isVinyl = true
    this._symlink = void 0
    this._contents = void 0
    this._cwd = void 0
    this._base = void 0
    this.pipe = void 0
    this.stat = file.stat || undefined
    this.contents = file.contents || null
    const history =
      (_file$history$slice =
        (_file$history = file.history) === null || _file$history === void 0
          ? void 0
          : _file$history.slice()) != null
        ? _file$history$slice
        : []

    if (file.path) {
      history.push(file.path)
    }

    this.history = []
    history.forEach(path => {
      this.path = path
    })
    this.cwd = file.cwd || process.cwd()
    this.base = file.base
    this._symlink = null
    lodash.forEach(file, (value, key) => {
      if (File.isCustomProp(key)) {
        this[key] = value
      }
    })
  }

  isBuffer() {
    return Buffer.isBuffer(this.contents)
  }

  isStream() {
    return isStream(this.contents)
  }

  isNull() {
    return this.contents === null
  }

  isDirectory() {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && lodash.isFunction(this.stat.isDirectory)) {
      return this.stat.isDirectory()
    }

    return false
  }

  isSymbolic() {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && lodash.isFunction(this.stat.isSymbolicLink)) {
      return this.stat.isSymbolicLink()
    }

    return false
  }

  clone(opt) {
    let deep

    let _contents

    if (lodash.isBoolean(opt)) {
      deep = opt
      _contents = true
    } else if (!opt) {
      deep = true
      _contents = true
    } else {
      deep = opt.deep === true
      _contents = opt.contents !== false
    }

    let contents

    if (this.isStream()) {
      contents = this.contents.clone()
    } else if (this.isBuffer()) {
      contents = _contents ? Buffer.from(this.contents) : this.contents
    }

    const file = new this.constructor({
      cwd: this.cwd,
      base: this.base,
      stat: this.stat && lodash.clone(this.stat),
      history: this.history.slice(),
      contents,
    })
    lodash.forEach(this, (value, key) => {
      if (File.isCustomProp(key)) {
        file[key] = deep ? lodash.cloneDeep(value) : value
      }
    })
    return file
  }

  inspect() {
    const inspection = []
    const filePath = this.path ? this.relative : null

    if (filePath) {
      inspection.push(`"${filePath}"`)
    }

    if (this.isBuffer()) {
      inspection.push(this.contents[util.inspect.custom]())
    }

    if (this.isStream()) {
      inspection.push(inspectStream(this.contents))
    }

    return `<File ${inspection.join(" ")}>`
  }

  get contents() {
    return this._contents
  }

  set contents(val) {
    if (!Buffer.isBuffer(val) && !isStream(val) && val !== null) {
      throw Error("File.contents can only be a Buffer, a Stream, or null.")
    }

    if (isStream(val) && !Cloneable.isCloneable(val)) {
      val = Cloneable(val)
    }

    this._contents = val
  }

  get cwd() {
    return this._cwd
  }

  set cwd(cwd) {
    if (!cwd || !lodash.isString(cwd)) {
      throw Error("cwd must be a non-empty string.")
    }

    this._cwd = removeTrailingSeparator(normalize(cwd))
  }

  get base() {
    return this._base || this._cwd
  }

  set base(base) {
    if (base == null) {
      delete this._base
      return
    }

    if (!lodash.isString(base) || !base) {
      throw Error("base must be a non-empty string, or null/undefined.")
    }

    base = removeTrailingSeparator(normalize(base))

    if (base !== this._cwd) {
      this._base = base
    } else {
      delete this._base
    }
  }

  get relative() {
    if (!this.path) {
      throw Error("No path specified! Can not get relative.")
    }

    return path.relative(this.base, this.path)
  }

  set relative(value) {
    throw Error(
      "File.relative is generated from the base and path attributes. Do not modify it."
    )
  }

  get dirname() {
    if (!this.path) {
      throw Error("No path specified! Can not get dirname.")
    }

    return path.dirname(this.path)
  }

  set dirname(dirname) {
    if (!this.path) {
      throw Error("No path specified! Can not set dirname.")
    }

    this.path = path.join(dirname, this.basename)
  }

  get basename() {
    if (!this.path) {
      throw Error("No path specified! Can not get basename.")
    }

    return path.basename(this.path)
  }

  set basename(basename) {
    if (!this.path) {
      throw Error("No path specified! Can not set basename.")
    }

    this.path = path.join(this.dirname, basename)
  }

  get stem() {
    if (!this.path) {
      throw Error("No path specified! Can not get stem.")
    }

    return path.basename(this.path, this.extname)
  }

  set stem(stem) {
    if (!this.path) {
      throw Error("No path specified! Can not set stem.")
    }

    this.path = path.join(this.dirname, stem + this.extname)
  }

  get extname() {
    if (!this.path) {
      throw Error("No path specified! Can not get extname.")
    }

    return path.extname(this.path)
  }

  set extname(extname) {
    if (!this.path) {
      throw Error("No path specified! Can not set extname.")
    }

    this.path = replaceExt(this.path, extname)
  }

  get path() {
    return lodash.last(this.history)
  }

  set path(path) {
    if (!lodash.isString(path)) {
      throw Error("path should be a string.")
    }

    path = removeTrailingSeparator(normalize(path))

    if (path && path !== this.path) {
      this.history.push(path)
    }
  }

  get symlink() {
    return this._symlink
  }

  set symlink(symlink) {
    if (!lodash.isString(symlink)) {
      throw Error("symlink should be a string")
    }

    this._symlink = removeTrailingSeparator(normalize(symlink))
  }

  static isCustomProp(key) {
    return !builtInFields.includes(key)
  }

  static isVinyl(file) {
    return (file && file._isVinyl === true) || false
  }
}

File.of = file => new File(file)

if (util.inspect.custom) {
  File.prototype[util.inspect.custom] = File.prototype.inspect
}

function wrapVinyl() {
  function wrapFile(globFile, enc, callback) {
    const file = new File(globFile)
    callback(null, file)
  }

  return main.obj(wrapFile)
}

const mapFileCommentRegex = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"`]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/){1}[ \t]*$)/gm

function decodeBase64(base64) {
  return Buffer.from(base64, "base64").toString()
}

function stripComment(sm) {
  return sm.split(",").pop()
}

function readFromFileMap(sm, dir) {
  const r = exports.mapFileCommentRegex.exec(sm)
  const filename = r[1] || r[2]
  const filepath = path.resolve(dir, filename)

  try {
    return fs.readFileSync(filepath, "utf8")
  } catch (e) {
    throw Error(
      `An error occurred while trying to read the map file at ${filepath}\n${e}`
    )
  }
}

class Converter {
  constructor(sm, opts = {}) {
    if (opts.isFileComment) sm = readFromFileMap(sm, opts.commentFileDir)
    if (opts.hasComment) sm = stripComment(sm)
    if (opts.isEncoded) sm = decodeBase64(sm)
    if (opts.isJSON || opts.isEncoded) sm = JSON.parse(sm)
    this.sourcemap = sm
  }

  toJSON(space) {
    return JSON.stringify(this.sourcemap, null, space)
  }

  toBase64() {
    const json = this.toJSON()
    return Buffer.from(json, "utf8").toString("base64")
  }

  toComment(options) {
    const base64 = this.toBase64()
    const data = `sourceMappingURL=data:application/json;charset=utf-8;base64,${base64}`
    return options && options.multiline ? `/*# ${data} */` : `//# ${data}`
  }

  toObject() {
    return JSON.parse(this.toJSON())
  }

  addProperty(key, value) {
    if (this.sourcemap.hasOwnProperty(key))
      throw Error(
        `property "${key}" already exists on the sourcemap, use set property instead`
      )
    return this.setProperty(key, value)
  }

  setProperty(key, value) {
    this.sourcemap[key] = value
    return this
  }

  getProperty(key) {
    return this.sourcemap[key]
  }
}

function fromObject(obj) {
  return new Converter(obj)
}
function fromSource(content) {
  const m = content.match(exports.commentRegex)
  return m ? exports.fromComment(m.pop()) : null
}
function removeComments(src) {
  return src.replace(exports.commentRegex, "")
}
function removeMapFileComments(src) {
  return src.replace(exports.mapFileCommentRegex, "")
}
function generateMapFileComment(file, options) {
  const data = `sourceMappingURL=${file}`
  return options && options.multiline ? `/*# ${data} */` : `//# ${data}`
}

function inRange(lower, number, upper) {
  return lower <= number && number <= upper
}

function isUTF8(bytes) {
  let i = 0

  while (i < bytes.length) {
    if (
      bytes[i] == 0x09 ||
      bytes[i] == 0x0a ||
      bytes[i] == 0x0d ||
      inRange(0x20, bytes[i], 0x7e)
    ) {
      i += 1
      continue
    }

    if (inRange(0xc2, bytes[i], 0xdf) && inRange(0x80, bytes[i + 1], 0xbf)) {
      i += 2
      continue
    }

    if (
      (bytes[i] == 0xe0 &&
        inRange(0xa0, bytes[i + 1], 0xbf) &&
        inRange(0x80, bytes[i + 2], 0xbf)) ||
      ((inRange(0xe1, bytes[i], 0xec) || bytes[i] == 0xee || bytes[i] == 0xef) &&
        inRange(0x80, bytes[i + 1], 0xbf) &&
        inRange(0x80, bytes[i + 2], 0xbf)) ||
      (bytes[i] == 0xed &&
        inRange(0x80, bytes[i + 1], 0x9f) &&
        inRange(0x80, bytes[i + 2], 0xbf))
    ) {
      i += 3
      continue
    }

    if (
      (bytes[i] == 0xf0 &&
        inRange(0x90, bytes[i + 1], 0xbf) &&
        inRange(0x80, bytes[i + 2], 0xbf) &&
        inRange(0x80, bytes[i + 3], 0xbf)) ||
      (inRange(0xf1, bytes[i], 0xf3) &&
        inRange(0x80, bytes[i + 1], 0xbf) &&
        inRange(0x80, bytes[i + 2], 0xbf) &&
        inRange(0x80, bytes[i + 3], 0xbf)) ||
      (bytes[i] == 0xf4 &&
        inRange(0x80, bytes[i + 1], 0x8f) &&
        inRange(0x80, bytes[i + 2], 0xbf) &&
        inRange(0x80, bytes[i + 3], 0xbf))
    ) {
      i += 4
      continue
    }

    return false
  }

  return true
}

function matchBOM(buf) {
  return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
}

function maybeUTF8(buf) {
  return isUTF8(buf.slice(3, 7))
}
function removeBOM(buf) {
  if (matchBOM(buf) && maybeUTF8(buf)) {
    return buf.slice(3)
  }

  return buf
}

const cr = new Buffer("\r\n")
const nl = new Buffer("\n")
function appendBuffer(buf, suffix) {
  if (!suffix || !suffix.length) {
    return buf
  }

  let eol

  if (buf.slice(-2).equals(cr)) {
    eol = cr
  } else if (buf.slice(-1).equals(nl)) {
    eol = nl
  } else {
    return Buffer.concat([buf, Buffer.from(os.EOL), Buffer.from(suffix)])
  }

  return Buffer.concat([buf, Buffer.from(suffix), eol])
}

const urlRegex = /^(https?|webpack(-[^:]+)?):\/\//

function isRemoteSource(source) {
  return source.match(urlRegex)
}

function parse(data) {
  try {
    return JSON.parse(removeBOM(data))
  } catch (err) {}
}

function loadSourceMap(file, state, callback) {
  state.map = fromSource(state.content)

  if (state.map) {
    state.map = state.map.toObject()
    state.path = file.dirname
    state.content = removeComments(state.content)
    file.contents = new Buffer(state.content, "utf8")
    return callback()
  }

  const mapComment = mapFileCommentRegex.exec(state.content)
  let mapFile

  if (mapComment) {
    mapFile = path.resolve(file.dirname, mapComment[1] || mapComment[2])
    state.content = removeMapFileComments(state.content)
    file.contents = new Buffer(state.content, "utf8")
  } else {
    mapFile = `${file.path}.map`
  }

  state.path = path.dirname(mapFile)
  fs.readFile(mapFile, onRead)

  function onRead(err, data) {
    if (err) {
      return callback()
    }

    state.map = parse(data)
    callback()
  }
}

function fixImportedSourceMap(file, state, callback) {
  if (!state.map) {
    return callback()
  }

  state.map.sourcesContent = state.map.sourcesContent || []
  map(state.map.sources, normalizeSourcesAndContent, callback)

  function assignSourcesContent(sourceContent, idx) {
    state.map.sourcesContent[idx] = sourceContent
  }

  function normalizeSourcesAndContent(sourcePath, idx, cb) {
    const sourceRoot = state.map.sourceRoot || ""
    const sourceContent = state.map.sourcesContent[idx] || null

    if (isRemoteSource(sourcePath)) {
      assignSourcesContent(sourceContent, idx)
      return cb()
    }

    if (state.map.sourcesContent[idx]) {
      return cb()
    }

    if (sourceRoot && isRemoteSource(sourceRoot)) {
      assignSourcesContent(sourceContent, idx)
      return cb()
    }

    const basePath = path.resolve(file.base, sourceRoot)
    const absPath = path.resolve(state.path, sourceRoot, sourcePath)
    const relPath = path.relative(basePath, absPath)
    const unixRelPath = path.normalize(relPath)
    state.map.sources[idx] = unixRelPath

    if (absPath !== file.path) {
      return fs.readFile(absPath, onRead)
    }

    assignSourcesContent(state.content, idx)
    cb()

    function onRead(err, data) {
      if (err) {
        assignSourcesContent(null, idx)
        return cb()
      }

      assignSourcesContent(removeBOM(data).toString("utf8"), idx)
      cb()
    }
  }
}

function mapsLoaded(file, state, callback) {
  if (!state.map) {
    state.map = {
      version: 3,
      names: [],
      mappings: "",
      sources: [path.normalize(file.relative)],
      sourcesContent: [state.content],
      file: undefined,
    }
  }

  state.map.file = path.normalize(file.relative)
  file.sourceMap = state.map
  callback()
}

function addSourceMaps(file, state, callback) {
  const tasks = [loadSourceMap, fixImportedSourceMap, mapsLoaded]

  function apply(fn, key, cb) {
    fn(file, state, cb)
  }

  mapSeries(tasks, apply, done)

  function done() {
    callback(null, file)
  }
}

function createSourceMapFile(opts) {
  return new File({
    cwd: opts.cwd,
    base: opts.base,
    path: opts.path,
    contents: new Buffer(JSON.stringify(opts.content)),
    stat: {
      isFile() {
        return true
      },

      isDirectory() {
        return false
      },

      isBlockDevice() {
        return false
      },

      isCharacterDevice() {
        return false
      },

      isSymbolicLink() {
        return false
      },

      isFIFO() {
        return false
      },

      isSocket() {
        return false
      },
    },
  })
}

const needsMultiline = [".css"]

function getCommentOptions(extname) {
  const opts = {
    multiline: needsMultiline.includes(extname),
  }
  return opts
}

function writeSourceMaps(file, destPath, callback) {
  let sourceMapFile
  const commentOpts = getCommentOptions(file.extname)
  let comment

  if (destPath == null) {
    comment = fromObject(file.sourceMap).toComment(commentOpts)
  } else {
    const mapFile = `${path.join(destPath, file.relative)}.map`
    const sourceMapPath = path.join(file.base, mapFile)
    sourceMapFile = createSourceMapFile({
      cwd: file.cwd,
      base: file.base,
      path: sourceMapPath,
      content: file.sourceMap,
    })
    let sourcemapLocation = path.relative(file.dirname, sourceMapPath)
    sourcemapLocation = path.normalize(sourcemapLocation)
    comment = generateMapFileComment(sourcemapLocation, commentOpts)
  }

  file.contents = appendBuffer(file.contents, comment)
  callback(null, file, sourceMapFile)
}

const PLUGIN_NAME = "vinyl-sourcemap"

function add(file, callback) {
  if (!File.isVinyl(file)) {
    return callback(new Error(`${PLUGIN_NAME}-add: Not a vinyl file`))
  }

  if (file.isStream()) {
    return callback(new Error(`${PLUGIN_NAME}-add: Streaming not supported`))
  }

  if (file.isNull() || file.sourceMap) {
    return callback(null, file)
  }

  const state = {
    path: "",
    map: null,
    content: file.contents.toString(),
    preExistingComment: null,
  }
  addSourceMaps(file, state, callback)
}

function write(file, destPath, callback) {
  if (lodash.isFunction(destPath)) {
    callback = destPath
    destPath = undefined
  }

  if (!File.isVinyl(file)) {
    return callback(new Error(`${PLUGIN_NAME}-write: Not a vinyl file`))
  }

  if (file.isStream()) {
    return callback(new Error(`${PLUGIN_NAME}-write: Streaming not supported`))
  }

  if (file.isNull() || !file.sourceMap) {
    return callback(null, file)
  }

  writeSourceMaps(file, destPath, callback)
}

var sourcemap = {
  add,
  write,
}

function sourcemapStream(options) {
  function addSourcemap(file, enc, callback) {
    const srcMap = resolveOption(options.sourcemaps, file)

    if (!srcMap) {
      return callback(null, file)
    }

    sourcemap.add(file, onAdd)

    function onAdd(sourcemapErr, updatedFile) {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      callback(null, updatedFile)
    }
  }

  return obj(addSourcemap)
}

function removeBomStream() {
  let completed = false
  let buffer = Buffer.alloc(0)
  return main(onChunk, onFlush)

  function removeAndCleanup(data) {
    completed = true
    buffer = null
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

function beforeFirstCall(instance, method, callback) {
  instance[method] = function (...args) {
    delete instance[method]
    callback.apply(this, args)
    return this[method].apply(this, args)
  }
}

class Readable extends stream.PassThrough {
  constructor(fn, options) {
    super(options)
    beforeFirstCall(this, "_read", function () {
      const source = fn.call(this, options)
      const emit = this.emit.bind(this, "error")
      source.on("error", emit)
      source.pipe(this)
    })
    this.emit("readable")
  }
}

class IconvLiteEncoderStream extends stream.Transform {
  constructor(conv, options) {
    super(options)
    this.conv = conv
    options = options || {}
    options.decodeStrings = false
  }

  _transform(chunk, encoding, done) {
    if (!lodash.isString(chunk))
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
IconvLiteEncoderStream.prototype = Object.create(stream.Transform.prototype, {
  constructor: {
    value: IconvLiteEncoderStream,
  },
})

var toEncoding = exports.encode
var fromEncoding = exports.decode
function getCodec(encoding) {
  if (!exports.encodings) exports.encodings = require("../encodings")

  let enc = exports._canonicalizeEncoding(encoding)

  const codecOptions = {}

  while (true) {
    let codec = exports._codecDataCache[enc]
    if (codec) return codec
    const codecDef = exports.encodings[enc]

    switch (typeof codecDef) {
      case "string":
        enc = codecDef
        break

      case "object":
        for (const key in codecDef) codecOptions[key] = codecDef[key]

        if (!codecOptions.encodingName) codecOptions.encodingName = enc
        enc = codecDef.type
        break

      case "function":
        if (!codecOptions.encodingName) codecOptions.encodingName = enc
        codec = new codecDef(codecOptions, exports)
        exports._codecDataCache[codecOptions.encodingName] = codec
        return codec

      default:
        throw Error(`Encoding not recognized: '${encoding}' (searched as: '${enc}')`)
    }
  }
}

class Codec {
  constructor(codec, encoding) {
    this.codec = void 0
    this.enc = void 0
    this.bomAware = void 0
    this.codec = codec
    this.enc = codec.enc || encoding
    this.bomAware = codec.bomAware || false
  }

  encode(str) {
    const encoder = getEncoder(this.codec)
    const buf = encoder.write(str)
    const end = encoder.end()
    return end && end.length > 0 ? Buffer.concat(buf, end) : buf
  }

  encodeStream() {
    const encoder = getEncoder(this.codec)
    return main(
      {
        decodeStrings: false,
      },
      function (str, enc, cb) {
        const buf = encoder.write(str)

        if (buf && buf.length) {
          this.push(buf)
        }

        cb()
      },
      function (cb) {
        const buf = encoder.end()

        if (buf && buf.length) {
          this.push(buf)
        }

        cb()
      }
    )
  }

  decode(buf) {
    const decoder = getDecoder(this.codec)
    const str = decoder.write(buf)
    const end = decoder.end()
    return end ? str + end : str
  }

  decodeStream() {
    const decoder = getDecoder(this.codec)
    return main(
      {
        encoding: DEFAULT_ENCODING,
      },
      function (buf, enc, cb) {
        const str = decoder.write(buf)

        if (str && str.length) {
          this.push(str, DEFAULT_ENCODING)
        }

        cb()
      },
      function (cb) {
        const str = decoder.end()

        if (str && str.length) {
          this.push(str, DEFAULT_ENCODING)
        }

        cb()
      }
    )
  }
}

function getEncoder(codec) {
  return new codec.encoder(null, codec)
}

function getDecoder(codec) {
  return new codec.decoder(null, codec)
}

const cache = {}
function getCodec$1(encoding) {
  let codec = cache[encoding]

  if (!!codec || !encoding || cache.hasOwnProperty(encoding)) {
    return codec
  }

  try {
    codec = new Codec(getCodec(encoding), encoding)
  } catch (err) {}

  cache[encoding] = codec
  return codec
}
getCodec$1(DEFAULT_ENCODING)

function streamFile(file, options, onRead) {
  const encoding = resolveOption(options.encoding, file)
  const codec = getCodec$1(encoding)

  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  const filePath = file.path
  file.contents = new Readable(() => {
    let contents = fs.createReadStream(filePath)

    if (encoding) {
      const removeBOM = codec.bomAware && resolveOption(options.removeBOM, file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = contents
          .pipe(codec.decodeStream())
          .pipe(getCodec$1(DEFAULT_ENCODING).encodeStream())
      }

      if (removeBOM) {
        contents = contents.pipe(removeBomStream())
      }
    }

    return contents
  })
  onRead()
}

function bufferFile(file, options, onRead) {
  const encoding = resolveOption(options.encoding, file)
  const codec = getCodec$1(encoding)

  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  fs.readFile(file.path, onReadFile)

  function onReadFile(readErr, contents) {
    if (readErr) {
      return onRead(readErr)
    }

    if (encoding) {
      let removeBOM$1 = codec.bomAware && resolveOption(options.removeBOM, file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = codec.decode(contents)
        removeBOM$1 = removeBOM$1 && contents[0] === "\ufeff"
        contents = getCodec$1(DEFAULT_ENCODING).encode(contents)
      }

      if (removeBOM$1) {
        contents = removeBOM(contents)
      }
    }

    file.contents = contents
    onRead()
  }
}

function readLink(file, onRead) {
  fs.readlink(file.path, onReadlink)

  function onReadlink(readErr, target) {
    if (readErr) {
      return onRead(readErr)
    }

    file.symlink = target
    onRead()
  }
}

function readContents(options) {
  function readFile(file, enc, callback) {
    const read = resolveOption(options.read, file)

    if (!read) {
      return callback(null, file)
    }

    if (file.isDirectory()) {
      return onRead(null)
    }

    if (file.stat && file.stat.isSymbolicLink()) {
      return readLink(file, onRead)
    }

    const buffer = resolveOption(options.buffer, file)

    if (buffer) {
      return bufferFile(file, options, onRead)
    }

    return streamFile(file, options, onRead)

    function onRead(readErr) {
      if (readErr) {
        return callback(readErr)
      }

      callback(null, file)
    }
  }

  return obj(readFile)
}

const APPEND_MODE_REGEXP = /a/

function date(value) {
  if (value instanceof Date) {
    return value
  }
}

function closeFd(propagatedErr, fd, callback) {
  if (!lodash.isNumber(fd)) {
    return callback(propagatedErr)
  }

  fs.close(fd, onClosed)

  function onClosed(closeErr) {
    if (propagatedErr || closeErr) {
      return callback(propagatedErr || closeErr)
    }

    callback()
  }
}

function isValidUnixId(id) {
  if (!lodash.isNumber(id)) {
    return false
  }

  if (id < 0) {
    return false
  }

  return true
}

function getFlags({ append, overwrite }) {
  let flags = !append ? "w" : "a"

  if (!overwrite) {
    flags += "x"
  }

  return flags
}

function isFatalOverwriteError(err, flags) {
  if (!err) {
    return false
  }

  if (err.code === "EEXIST" && flags[1] === "x") {
    return false
  }

  return true
}

function isFatalUnlinkError(err) {
  if (!err || err.code === "ENOENT") {
    return false
  }

  return true
}

function getModeDiff(fsMode, vinylMode) {
  let modeDiff = 0

  if (lodash.isNumber(vinylMode)) {
    modeDiff = (vinylMode ^ fsMode) & MASK_MODE
  }

  return modeDiff
}

function getTimesDiff(fsStat, vinylStat) {
  const mtime = date(vinylStat.mtime) || 0

  if (!mtime) {
    return
  }

  let atime = date(vinylStat.atime) || 0

  if (+mtime === +fsStat.mtime && +atime === +fsStat.atime) {
    return
  }

  if (!atime) {
    atime = date(fsStat.atime) || undefined
  }

  const timesDiff = {
    mtime: vinylStat.mtime,
    atime,
  }
  return timesDiff
}

function getOwnerDiff(fsStat, vinylStat) {
  if (!isValidUnixId(vinylStat.uid) && !isValidUnixId(vinylStat.gid)) {
    return
  }

  if (
    (!isValidUnixId(fsStat.uid) && !isValidUnixId(vinylStat.uid)) ||
    (!isValidUnixId(fsStat.gid) && !isValidUnixId(vinylStat.gid))
  ) {
    return
  }

  let uid = fsStat.uid

  if (isValidUnixId(vinylStat.uid)) {
    uid = vinylStat.uid
  }

  let gid = fsStat.gid

  if (isValidUnixId(vinylStat.gid)) {
    gid = vinylStat.gid
  }

  if (uid === fsStat.uid && gid === fsStat.gid) {
    return
  }

  const ownerDiff = {
    uid,
    gid,
  }
  return ownerDiff
}

function isOwner(fsStat) {
  const hasGetuid = lodash.isFunction(process.getuid)
  const hasGeteuid = lodash.isFunction(process.geteuid)

  if (!hasGeteuid && !hasGetuid) {
    return false
  }

  let uid

  if (hasGeteuid) {
    uid = process.geteuid()
  } else {
    uid = process.getuid()
  }

  if (fsStat.uid !== uid && uid !== 0) {
    return false
  }

  return true
}

function reflectStat(path, file, callback) {
  fs.stat(path, onStat)

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr)
    }

    file.stat = stat
    callback()
  }
}

function reflectLinkStat(path, file, callback) {
  fs.lstat(path, onLstat)

  function onLstat(lstatErr, stat) {
    if (lstatErr) {
      return callback(lstatErr)
    }

    file.stat = stat
    callback()
  }
}

function updateMetadata(fd, file, callback) {
  fs.fstat(fd, onStat)

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr)
    }

    const modeDiff = getModeDiff(stat.mode, file.stat.mode)
    const timesDiff = getTimesDiff(stat, file.stat)
    const ownerDiff = getOwnerDiff(stat, file.stat)
    Object.assign(file.stat, stat)

    if (!modeDiff && !timesDiff && !ownerDiff) {
      return callback()
    }

    if (!isOwner(stat)) {
      return callback()
    }

    if (modeDiff) {
      return mode()
    }

    if (timesDiff) {
      return times()
    }

    owner()

    function mode() {
      const mode = stat.mode ^ modeDiff
      fs.fchmod(fd, mode, onFchmod)

      function onFchmod(fchmodErr) {
        if (!fchmodErr) {
          file.stat.mode = mode
        }

        if (timesDiff) {
          return times(fchmodErr)
        }

        if (ownerDiff) {
          return owner(fchmodErr)
        }

        callback(fchmodErr)
      }
    }

    function times(propagatedErr) {
      fs.futimes(fd, timesDiff.atime, timesDiff.mtime, onFutimes)

      function onFutimes(futimesErr) {
        if (!futimesErr) {
          file.stat.atime = timesDiff.atime
          file.stat.mtime = timesDiff.mtime
        }

        if (ownerDiff) {
          return owner(propagatedErr || futimesErr)
        }

        callback(propagatedErr || futimesErr)
      }
    }

    function owner(propagatedErr) {
      fs.fchown(fd, ownerDiff.uid, ownerDiff.gid, onFchown)

      function onFchown(fchownErr) {
        if (!fchownErr) {
          file.stat.uid = ownerDiff.uid
          file.stat.gid = ownerDiff.gid
        }

        callback(propagatedErr || fchownErr)
      }
    }
  }
}

function symlink(srcPath, destPath, { flags, type }, callback) {
  if (flags === "w") {
    fs.unlink(destPath, onUnlink)
  } else {
    fs.symlink(srcPath, destPath, type, onSymlink)
  }

  function onUnlink(unlinkErr) {
    if (isFatalUnlinkError(unlinkErr)) {
      return callback(unlinkErr)
    }

    fs.symlink(srcPath, destPath, type, onSymlink)
  }

  function onSymlink(symlinkErr) {
    if (isFatalOverwriteError(symlinkErr, flags)) {
      return callback(symlinkErr)
    }

    callback()
  }
}

function writeFile(filepath, data, options, callback) {
  if (lodash.isFunction(options)) {
    callback = options
    options = {}
  }

  if (!Buffer.isBuffer(data)) {
    return callback(new TypeError("Data must be a Buffer"))
  }

  if (!options) {
    options = {}
  }

  const mode = options.mode || DEFAULT_FILE_MODE
  const flags = options.flags || "w"
  const position = APPEND_MODE_REGEXP.test(flags) ? null : 0
  fs.open(filepath, flags, mode, onOpen)

  function onOpen(openErr, fd) {
    if (openErr) {
      return onComplete(openErr)
    }

    fs.write(fd, data, 0, data.length, position, onComplete)

    function onComplete(writeErr) {
      callback(writeErr, fd)
    }
  }
}

function createWriteStream(path, options, flush) {
  return new WriteStream(path, options, flush)
}

class WriteStream extends stream.Writable {
  constructor(path, options, flush) {
    if (lodash.isFunction(options)) {
      flush = options
      options = null
    }

    options = options || {}
    super(options)
    this.flush = void 0
    this.path = void 0
    this.mode = void 0
    this.flags = void 0
    this.fd = void 0
    this.start = void 0
    this.flush = flush
    this.path = path
    this.mode = options.mode || DEFAULT_FILE_MODE
    this.flags = options.flags || "w"
    this.fd = null
    this.start = null
    this.open()
    this.once("finish", this.close)
  }

  open() {
    const onOpen = (openErr, fd) => {
      if (openErr) {
        this.destroy()
        this.emit("error", openErr)
        return
      }

      this.fd = fd
      this.emit("open", fd)
    }

    fs.open(this.path, this.flags, this.mode, onOpen)
  }

  _destroy(err, cb) {
    this.close(err2 => {
      cb(err || err2)
    })
  }

  close(cb) {
    if (cb) {
      this.once("close", cb)
    }

    if (this.closed || !lodash.isNumber(this.fd)) {
      if (!lodash.isNumber(this.fd)) {
        this.once("open", closeOnOpen)
        return
      }

      return process.nextTick(() => {
        this.emit("close")
      })
    }

    this.closed = true
    fs.close(this.fd, er => {
      if (er) {
        this.emit("error", er)
      } else {
        this.emit("close")
      }
    })
    this.fd = null
  }

  _final(callback) {
    if (!lodash.isFunction(this.flush)) {
      return callback()
    }

    this.flush(this.fd, callback)
  }

  _write(data, encoding, callback) {
    if (!Buffer.isBuffer(data)) {
      return this.emit("error", new Error("Invalid data"))
    }

    if (!lodash.isNumber(this.fd)) {
      return this.once("open", onOpen)
    }

    const onOpen = () => {
      this._write(data, encoding, callback)
    }

    const onWrite = writeErr => {
      if (writeErr) {
        this.destroy()
        callback(writeErr)
        return
      }

      callback()
    }

    fs.write(this.fd, data, 0, data.length, null, onWrite)
  }
}

WriteStream.prototype.destroySoon = WriteStream.prototype.end

function closeOnOpen() {
  this.close()
}

function resolveSymlinks(options) {
  function resolveFile(file, _enc, callback) {
    reflectLinkStat(file.path, file, onReflect)

    function onReflect(statErr) {
      if (statErr) {
        return callback(statErr)
      }

      if (!file.stat.isSymbolicLink()) {
        return callback(null, file)
      }

      const resolveSymlinks = resolveOption(options.resolveSymlinks, file)

      if (!resolveSymlinks) {
        return callback(null, file)
      }

      reflectStat(file.path, file, onReflect)
    }
  }

  return obj(resolveFile)
}

function isValidGlob(glob) {
  return Array.isArray(glob) ? glob.every(isValidGlob) : lodash.isString(glob)
}

function src(glob, opt) {
  const options = resolve(opt)

  if (!isValidGlob(glob)) {
    throw Error(`Invalid glob argument: ${glob}`)
  }

  const streams = [
    globStream(glob, options),
    wrapVinyl(),
    resolveSymlinks(options),
    prepareRead(options),
    readContents(options),
    sourcemapStream(options),
  ]
  const outputStream = pumpify.obj(streams)
  return toThrough(outputStream)
}

function listenerCount(stream, evt) {
  return stream.listeners(evt).length
}

function hasListeners(stream) {
  return !!(listenerCount(stream, "readable") || listenerCount(stream, "data"))
}

function sink(stream$1) {
  let sinkAdded = false
  const sinkStream = new stream.Writable()

  function addSink() {
    if (sinkAdded) {
      return
    }

    if (hasListeners(stream$1)) {
      return
    }

    sinkAdded = true
    stream$1.pipe(sinkStream)
  }

  function removeSink(evt) {
    if (evt !== "readable" && evt !== "data") {
      return
    }

    if (hasListeners(stream$1)) {
      sinkAdded = false
      stream$1.unpipe(sinkStream)
    }
  }

  stream$1.on("newListener", removeSink)
  stream$1.on("removeListener", removeSink)
  stream$1.on("removeListener", addSink)
  process.nextTick(addSink)
  return stream$1
}

const MASK_MODE$1 = parseInt("7777", 8)
function mkdirp(dirpath, mode, callback) {
  if (lodash.isFunction(mode)) {
    callback = mode
    mode = undefined
  }

  if (lodash.isString(mode)) {
    mode = parseInt(mode, 8)
  }

  dirpath = path.resolve(dirpath)
  fs.mkdir(dirpath, mode, onMkdir)

  function onMkdir(mkdirErr) {
    if (!mkdirErr) {
      return fs.stat(dirpath, onStat)
    }

    switch (mkdirErr.code) {
      case "ENOENT": {
        return mkdirp(path.dirname(dirpath), onRecurse)
      }

      case "EEXIST": {
        return fs.stat(dirpath, onStat)
      }

      default: {
        return callback(mkdirErr)
      }
    }

    function onStat(statErr, stats) {
      if (statErr) {
        return callback(statErr)
      }

      if (!stats.isDirectory()) {
        return callback(mkdirErr)
      }

      if (!mode) {
        return callback()
      }

      if ((stats.mode & MASK_MODE$1) === mode) {
        return callback()
      }

      fs.chmod(dirpath, mode, callback)
    }
  }

  function onRecurse(recurseErr) {
    if (recurseErr) {
      return callback(recurseErr)
    }

    mkdirp(dirpath, mode, callback)
  }
}

function toFunction(dirpath) {
  function stringResolver(chunk, callback) {
    callback(null, dirpath)
  }

  return stringResolver
}

function mkdirpStream(resolver) {
  if (lodash.isString(resolver)) {
    resolver = toFunction(resolver)
  }

  return new stream.Transform({
    transform(chunk, callback) {
      const onDirpath = (dirpathErr, dirpath, mode) => {
        if (dirpathErr) {
          return this.destroy(dirpathErr)
        }

        mkdirp(dirpath, mode, onMkdirp)
      }

      const onMkdirp = mkdirpErr => {
        if (mkdirpErr) {
          return this.destroy(mkdirpErr)
        }

        this.push(chunk)
      }

      resolver(chunk, onDirpath)
    },
  })
}

var mkdirpStream$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  default: mkdirpStream,
})

function resolve$1(config) {
  return {
    cwd: process.cwd,

    mode({ stat }) {
      return stat ? stat.mode : null
    },

    overwrite: true,
    append: false,
    encoding: DEFAULT_ENCODING,
    sourcemaps: false,
    relativeSymlinks: false,
    useJunctions: true,
    ...config,
  }
}

function prepareWrite({ outFolder }, options) {
  if (!outFolder) {
    throw Error("Invalid output folder")
  }

  function normalize(file, _enc, cb) {
    if (!File.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `dest()`"))
    }

    if (!lodash.isFunction(file.isSymbolic)) {
      file = new File(file)
    }

    const outFolderPath = resolveOption(outFolder, file)

    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }

    const cwd = path.resolve(resolveOption(options.cwd, file))
    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)
    file.cwd = cwd
    file.base = basePath
    file.path = writePath

    if (!file.isSymbolic()) {
      const mode = resolveOption(options.mode, file)
      file.stat = file.stat || new fs.Stats()
      file.stat.mode = mode
    }

    cb(null, file)
  }

  return obj(normalize)
}

function sourcemapStream$1(options) {
  function saveSourcemap(file, enc, callback) {
    const srcMap = resolveOption(options.sourcemaps, file)

    if (!srcMap) {
      return callback(null, file)
    }

    const srcMapLocation = lodash.isString(srcMap) ? srcMap : undefined

    const onWrite = (sourcemapErr, updatedFile, sourcemapFile) => {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      this.push(updatedFile)

      if (sourcemapFile) {
        this.push(sourcemapFile)
      }

      callback()
    }

    sourcemap.write(file, srcMapLocation, onWrite)
  }

  return obj(saveSourcemap)
}

function writeDir(file, onWritten) {
  fs$1.mkdirp(file.path, file.stat.mode).then(onMkdirp)

  function onMkdirp(mkdirpErr) {
    if (mkdirpErr) {
      return onWritten(mkdirpErr)
    }

    fs$1.open(file.path, "r", onOpen)
  }

  function onOpen(openErr, fd) {
    if (isInaccessible(openErr)) {
      return closeFd(null, fd, onWritten)
    }

    if (openErr) {
      return closeFd(openErr, fd, onWritten)
    }

    updateMetadata(fd, file, onUpdate)

    function onUpdate(updateErr) {
      closeFd(updateErr, fd, onWritten)
    }
  }
}

function isInaccessible(err) {
  if (!err) {
    return false
  }

  if (err.code === "EACCES") {
    return true
  }

  return false
}

function writeStream(file, options, onWritten) {
  const flags = getFlags({
    overwrite: resolveOption(options.overwrite, file),
    append: resolveOption(options.append, file),
  })
  const encoding = resolveOption(options.encoding, file)
  const codec = getCodec$1(encoding)

  if (encoding && !codec) {
    return onWritten(new Error(`Unsupported encoding: ${encoding}`))
  }

  const opt = {
    mode: file.stat.mode,
    flags,
  }
  const outStream = createWriteStream(file.path, opt, onFlush)
  let contents = file.contents

  if (encoding && encoding.enc !== DEFAULT_ENCODING) {
    contents = contents
      .pipe(getCodec$1(DEFAULT_ENCODING).decodeStream())
      .pipe(codec.encodeStream())
  }

  file.contents.once("error", onComplete)
  outStream.once("error", onComplete)
  outStream.once("finish", onComplete)
  contents.pipe(outStream)

  function onComplete(streamErr) {
    file.contents.removeListener("error", onComplete)
    outStream.removeListener("error", onComplete)
    outStream.removeListener("finish", onComplete)
    outStream.once("close", onClose)
    outStream.end()

    function onClose(closeErr) {
      onWritten(streamErr || closeErr)
    }
  }

  function onFlush(fd, callback) {
    file.contents.removeListener("error", onComplete)
    streamFile(
      file,
      {
        encoding,
        removeBOM: false,
      },
      complete
    )

    function complete() {
      if (!lodash.isNumber(fd)) {
        return callback()
      }

      updateMetadata(fd, file, callback)
    }
  }
}

function writeBuffer(file, options, onWritten) {
  const flags = getFlags({
    overwrite: resolveOption(options.overwrite, file),
    append: resolveOption(options.append, file),
  })
  const encoding = resolveOption(options.encoding, file)
  const codec = getCodec$1(encoding)

  if (encoding && !codec) {
    return onWritten(new Error(`Unsupported encoding: ${encoding}`))
  }

  const opt = {
    mode: file.stat.mode,
    flags,
  }
  let contents = file.contents

  if (encoding && codec.enc !== DEFAULT_ENCODING) {
    contents = getCodec$1(DEFAULT_ENCODING).decode(contents)
    contents = codec.encode(contents)
  }

  writeFile(file.path, contents, opt, onWriteFile)

  function onWriteFile(writeErr, fd) {
    if (writeErr) {
      return closeFd(writeErr, fd, onWritten)
    }

    updateMetadata(fd, file, onUpdate)

    function onUpdate(updateErr) {
      closeFd(updateErr, fd, onWritten)
    }
  }
}

const isWindows = process.platform === "win32"

function writeSymbolicLink(file, options, onWritten) {
  if (!file.symlink) {
    return onWritten(new Error("Missing symlink property on symbolic vinyl"))
  }

  const isRelative = resolveOption(options.relativeSymlinks, file)
  const flags = getFlags({
    overwrite: resolveOption(options.overwrite, file),
    append: resolveOption(options.append, file),
  })

  if (!isWindows) {
    return createLinkWithType("file")
  }

  reflectStat(file.symlink, file, onReflect)

  function onReflect(statErr) {
    if (statErr && statErr.code !== "ENOENT") {
      return onWritten(statErr)
    }

    const useJunctions = resolveOption(options.useJunctions, file)
    const dirType = useJunctions ? "junction" : "dir"
    const type = !statErr && file.isDirectory() ? dirType : "file"
    createLinkWithType(type)
  }

  function createLinkWithType(type) {
    if (isRelative && type !== "junction") {
      file.symlink = path.relative(file.base, file.symlink)
    }

    const opts = {
      flags,
      type,
    }
    symlink(file.symlink, file.path, opts, onSymlink)

    function onSymlink(symlinkErr) {
      if (symlinkErr) {
        return onWritten(symlinkErr)
      }

      reflectLinkStat(file.path, file, onWritten)
    }
  }
}

function writeContents(options) {
  function writeFile(file, enc, callback) {
    if (file.isSymbolic()) {
      return writeSymbolicLink(file, options, onWritten)
    }

    if (file.isDirectory()) {
      return writeDir(file, onWritten)
    }

    if (file.isStream()) {
      return writeStream(file, options, onWritten)
    }

    if (file.isBuffer()) {
      return writeBuffer(file, options, onWritten)
    }

    if (file.isNull()) {
      return onWritten(null)
    }

    function onWritten(writeErr) {
      const flags = getFlags({
        overwrite: resolveOption(options.overwrite, file),
        append: resolveOption(options.append, file),
      })

      if (isFatalOverwriteError(writeErr, flags)) {
        return callback(writeErr)
      }

      callback(null, file)
    }
  }

  return obj(writeFile)
}

function dest(outFolder, opt) {
  if (!outFolder) {
    throw Error(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
  }

  const options = resolve$1(opt)

  function dirpath(file, callback) {
    const dirMode = resolveOption(options.dirMode, file)
    callback(null, file.dirname, dirMode)
  }

  const saveStream = obj$2(
    prepareWrite(
      {
        outFolder,
      },
      options
    ),
    sourcemapStream$1(options),
    undefined(dirpath),
    writeContents(options)
  )
  return sink(saveStream)
}

function resolve$2(c) {
  return {
    cwd: process.cwd,
    overwrite: true,
    relativeSymlinks: false,
    useJunctions: true,
    ...c,
  }
}

function prepareSymlink(folderResolver, options) {
  if (!folderResolver) {
    throw Error("Invalid output folder")
  }

  function normalize(file, enc, cb) {
    if (!File.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `symlink()`"))
    }

    if (!lodash.isFunction(file.isSymbolic)) {
      file = new File(file)
    }

    const cwd = path.resolve(resolveOption(options.cwd, file))
    const outFolderPath = resolveOption(folderResolver, file)

    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }

    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)
    file.stat = file.stat || new fs.Stats()
    file.cwd = cwd
    file.base = basePath
    file.symlink = file.path
    file.path = writePath
    file.contents = null
    cb(null, file)
  }

  return obj(normalize)
}

const isWindows$1 = process.platform === "win32"

function linkStream(options) {
  function linkFile(file, _enc, callback) {
    const isRelative = resolveOption(options.relativeSymlinks, file)
    const flags = getFlags({
      overwrite: resolveOption(options.overwrite, file),
      append: false,
    })

    if (!isWindows$1) {
      return createLinkWithType("file")
    }

    reflectStat(file.symlink, file, onReflectTarget)

    function onReflectTarget(statErr) {
      if (statErr && statErr.code !== "ENOENT") {
        return callback(statErr)
      }

      const useJunctions = resolveOption(options.useJunctions, file)
      const dirType = useJunctions ? "junction" : "dir"
      const type = !statErr && file.isDirectory() ? dirType : "file"
      createLinkWithType(type)
    }

    function createLinkWithType(type) {
      if (isRelative && type !== "junction") {
        file.symlink = path.relative(file.base, file.symlink)
      }

      const opts = {
        flags,
        type,
      }
      symlink(file.symlink, file.path, opts, onSymlink)
    }

    function onSymlink(symlinkErr) {
      if (symlinkErr) {
        return callback(symlinkErr)
      }

      reflectLinkStat(file.path, file, onReflectLink)
    }

    function onReflectLink(reflectErr) {
      if (reflectErr) {
        return callback(reflectErr)
      }

      callback(null, file)
    }
  }

  return obj(linkFile)
}

function symlink$1(outFolder, opt) {
  if (!outFolder) {
    throw Error(
      "Invalid symlink() folder argument.\n Please specify a non-empty string or a function."
    )
  }

  const optResolver = resolve$2(opt)

  function dirpath(file, callback) {
    const dirMode = resolveOption(optResolver.dirMode, file)
    callback(null, file.dirname, dirMode)
  }

  const stream = obj$2(
    prepareSymlink(outFolder, optResolver),
    undefined(dirpath),
    linkStream(optResolver)
  )
  return sink(stream)
}

const POSIX_CHARS = {
  DOT_LITERAL: "\\.",
  PLUS_LITERAL: "\\+",
  QMARK_LITERAL: "\\?",
  SLASH_LITERAL: "\\/",
  ONE_CHAR: "(?=.)",
  QMARK: "[^/]",
  END_ANCHOR: "(?:\\/|$)",
  DOTS_SLASH: "\\.{1,2}(?:\\/|$)",
  NO_DOT: "(?!\\.)",
  NO_DOTS: "(?!(?:^|\\/)\\.{1,2}(?:\\/|$))",
  NO_DOT_SLASH: "(?!\\.{0,1}(?:\\/|$))",
  NO_DOTS_SLASH: "(?!\\.{1,2}(?:\\/|$))",
  QMARK_NO_DOT: "[^.\\/]",
  STAR: "[^/]*?",
  START_ANCHOR: "(?:^|\\/)",
}
const WINDOWS_CHARS = {
  ...POSIX_CHARS,
  SLASH_LITERAL: `[${"\\\\/"}]`,
  QMARK: "[^\\\\/]",
  STAR: `${"[^\\\\/]"}*?`,
  DOTS_SLASH: `${"\\."}{1,2}(?:[${"\\\\/"}]|$)`,
  NO_DOT: `(?!${"\\."})`,
  NO_DOTS: `(?!(?:^|[${"\\\\/"}])${"\\."}{1,2}(?:[${"\\\\/"}]|$))`,
  NO_DOT_SLASH: `(?!${"\\."}{0,1}(?:[${"\\\\/"}]|$))`,
  NO_DOTS_SLASH: `(?!${"\\."}{1,2}(?:[${"\\\\/"}]|$))`,
  QMARK_NO_DOT: `[^.${"\\\\/"}]`,
  START_ANCHOR: `(?:^|[${"\\\\/"}])`,
  END_ANCHOR: `(?:[${"\\\\/"}]|$)`,
}
const POSIX_REGEX_SOURCE = {
  alnum: "a-zA-Z0-9",
  alpha: "a-zA-Z",
  ascii: "\\x00-\\x7F",
  blank: " \\t",
  cntrl: "\\x00-\\x1F\\x7F",
  digit: "0-9",
  graph: "\\x21-\\x7E",
  lower: "a-z",
  print: "\\x20-\\x7E ",
  punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
  space: " \\t\\r\\n\\v\\f",
  upper: "A-Z",
  word: "A-Za-z0-9_",
  xdigit: "A-Fa-f0-9",
}
const MAX_LENGTH = 65536
const REGEX_BACKSLASH = /\\(?![*+?^${}(|)[\]])/g
const REGEX_NON_SPECIAL_CHARS = /^[^@![\].,$*+?^{}()|\\/]+/
const REGEX_SPECIAL_CHARS = /[-*+?.^${}(|)[\]]/
const REGEX_SPECIAL_CHARS_BACKREF = /(\\?)((\W)(\3*))/g
const REGEX_SPECIAL_CHARS_GLOBAL = /([-*+?.^${}(|)[\]])/g
const REPLACEMENTS = {
  "***": "*",
  "**/**": "**",
  "**/**/**": "**",
}
function extglobChars(chars) {
  return {
    "!": {
      type: "negate",
      open: "(?:(?!(?:",
      close: `))${chars.STAR})`,
    },
    "?": {
      type: "qmark",
      open: "(?:",
      close: ")?",
    },
    "+": {
      type: "plus",
      open: "(?:",
      close: ")+",
    },
    "*": {
      type: "star",
      open: "(?:",
      close: ")*",
    },
    "@": {
      type: "at",
      open: "(?:",
      close: ")",
    },
  }
}
function globChars(win32) {
  return win32 === true ? WINDOWS_CHARS : POSIX_CHARS
}

const win32 = process.platform === "win32"
function hasRegexChars(str) {
  return REGEX_SPECIAL_CHARS.test(str)
}
function escapeRegex(str) {
  return str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1")
}
function toPosixSlashes(str) {
  return str.replace(REGEX_BACKSLASH, "/")
}
function supportsLookbehinds() {
  const segs = process.version.slice(1).split(".").map(Number)

  if ((segs.length === 3 && segs[0] >= 9) || (segs[0] === 8 && segs[1] >= 10)) {
    return true
  }

  return false
}
function isWindows$2(options) {
  if (options && lodash.isBoolean(options.windows)) {
    return options.windows
  }

  return win32 === true || path.sep === "\\"
}
function escapeLast(input, char, lastIdx) {
  const idx = input.lastIndexOf(char, lastIdx)
  if (idx === -1) return input
  if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1)
  return `${input.slice(0, idx)}\\${input.slice(idx)}`
}
function removePrefix(input, state = {}) {
  let output = input

  if (output.startsWith("./")) {
    output = output.slice(2)
    state.prefix = "./"
  }

  return output
}
function wrapOutput(input, state = {}, options = {}) {
  const prepend = options.contains ? "" : "^"
  const append = options.contains ? "" : "$"
  let output = `${prepend}(?:${input})${append}`

  if (state.negated === true) {
    output = `(?:^(?!${output}).*$)`
  }

  return output
}

const expandRange = (args, options) => {
  if (lodash.isFunction(options.expandRange)) {
    return options.expandRange(...args, options)
  }

  args.sort()
  const value = `[${args.join("-")}]`

  try {
    new RegExp(value)
  } catch (ex) {
    return args.map(v => escapeRegex(v)).join("..")
  }

  return value
}

const syntaxError = (type, char) =>
  `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`

const parse$1 = (input, options) => {
  if (!lodash.isString(input)) {
    throw TypeError("Expected a string")
  }

  input = REPLACEMENTS[input] || input
  const opts = { ...options }
  const max = lodash.isNumber(opts.maxLength)
    ? Math.min(MAX_LENGTH, opts.maxLength)
    : MAX_LENGTH
  let len = input.length

  if (len > max) {
    throw SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`)
  }

  const bos = {
    type: "bos",
    value: "",
    output: opts.prepend || "",
  }
  const tokens = [bos]
  const capture = opts.capture ? "" : "?:"
  const win32 = isWindows$2(options)
  const PLATFORM_CHARS = globChars(win32)
  const EXTGLOB_CHARS = extglobChars(PLATFORM_CHARS)
  const {
    DOT_LITERAL,
    PLUS_LITERAL,
    SLASH_LITERAL,
    ONE_CHAR,
    DOTS_SLASH,
    NO_DOT,
    NO_DOT_SLASH,
    NO_DOTS_SLASH,
    QMARK,
    QMARK_NO_DOT,
    STAR,
    START_ANCHOR,
  } = PLATFORM_CHARS

  const globstar = ({ dot }) =>
    `(${capture}(?:(?!${START_ANCHOR}${dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`

  const nodot = opts.dot ? "" : NO_DOT
  const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT
  let star = opts.bash === true ? globstar(opts) : STAR

  if (opts.capture) {
    star = `(${star})`
  }

  if (lodash.isBoolean(opts.noext)) {
    opts.noextglob = opts.noext
  }

  const state = {
    input,
    index: -1,
    start: 0,
    dot: opts.dot === true,
    consumed: "",
    output: "",
    prefix: "",
    backtrack: false,
    negated: false,
    brackets: 0,
    braces: 0,
    parens: 0,
    quotes: 0,
    globstar: false,
    tokens,
  }
  input = removePrefix(input, state)
  len = input.length
  const extglobs = []
  const braces = []
  const stack = []
  let prev = bos
  let value

  const eos = () => state.index === len - 1

  const peek = (state.peek = (n = 1) => input[state.index + n])

  const advance = (state.advance = () => input[++state.index])

  const remaining = () => input.slice(state.index + 1)

  const consume = (value = "", num = 0) => {
    state.consumed += value
    state.index += num
  }

  const append = token => {
    state.output += token.output != null ? token.output : token.value
    consume(token.value)
  }

  const negate = () => {
    let count = 1

    while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
      advance()
      state.start++
      count++
    }

    if (count % 2 === 0) {
      return false
    }

    state.negated = true
    state.start++
    return true
  }

  const increment = type => {
    state[type]++
    stack.push(type)
  }

  const decrement = type => {
    state[type]--
    stack.pop()
  }

  const push = tok => {
    if (prev.type === "globstar") {
      const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace")
      const isExtglob =
        tok.extglob === true ||
        (extglobs.length && (tok.type === "pipe" || tok.type === "paren"))

      if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
        state.output = state.output.slice(0, -prev.output.length)
        prev.type = "star"
        prev.value = "*"
        prev.output = star
        state.output += prev.output
      }
    }

    if (extglobs.length && tok.type !== "paren" && !EXTGLOB_CHARS[tok.value]) {
      extglobs[extglobs.length - 1].inner += tok.value
    }

    if (tok.value || tok.output) append(tok)

    if (prev && prev.type === "text" && tok.type === "text") {
      prev.value += tok.value
      prev.output = (prev.output || "") + tok.value
      return
    }

    tok.prev = prev
    tokens.push(tok)
    prev = tok
  }

  const extglobOpen = (type, value) => {
    const token = { ...EXTGLOB_CHARS[value], conditions: 1, inner: "" }
    token.prev = prev
    token.parens = state.parens
    token.output = state.output
    const output = (opts.capture ? "(" : "") + token.open
    increment("parens")
    push({
      type,
      value,
      output: state.output ? "" : ONE_CHAR,
    })
    push({
      type: "paren",
      extglob: true,
      value: advance(),
      output,
    })
    extglobs.push(token)
  }

  const extglobClose = token => {
    let output = token.close + (opts.capture ? ")" : "")

    if (token.type === "negate") {
      let extglobStar = star

      if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
        extglobStar = globstar(opts)
      }

      if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
        output = token.close = `)$))${extglobStar}`
      }

      if (token.prev.type === "bos" && eos()) {
        state.negatedExtglob = true
      }
    }

    push({
      type: "paren",
      extglob: true,
      value,
      output,
    })
    decrement("parens")
  }

  if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
    let backslashes = false
    let output = input.replace(
      REGEX_SPECIAL_CHARS_BACKREF,
      (m, esc, { length }, first, rest, index) => {
        if (first === "\\") {
          backslashes = true
          return m
        }

        if (first === "?") {
          if (esc) {
            return esc + first + (rest ? QMARK.repeat(rest.length) : "")
          }

          if (index === 0) {
            return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "")
          }

          return QMARK.repeat(length)
        }

        if (first === ".") {
          return DOT_LITERAL.repeat(length)
        }

        if (first === "*") {
          if (esc) {
            return esc + first + (rest ? star : "")
          }

          return star
        }

        return esc ? m : `\\${m}`
      }
    )

    if (backslashes === true) {
      if (opts.unescape === true) {
        output = output.replace(/\\/g, "")
      } else {
        output = output.replace(/\\+/g, m =>
          m.length % 2 === 0 ? "\\\\" : m ? "\\" : ""
        )
      }
    }

    if (output === input && opts.contains === true) {
      state.output = input
      return state
    }

    state.output = wrapOutput(output, state, options)
    return state
  }

  while (!eos()) {
    value = advance()

    if (value === "\u0000") {
      continue
    }

    if (value === "\\") {
      const next = peek()

      if (next === "/" && opts.bash !== true) {
        continue
      }

      if (next === "." || next === ";") {
        continue
      }

      if (!next) {
        value += "\\"
        push({
          type: "text",
          value,
        })
        continue
      }

      const match = /^\\+/.exec(remaining())
      let slashes = 0

      if (match && match[0].length > 2) {
        slashes = match[0].length
        state.index += slashes

        if (slashes % 2 !== 0) {
          value += "\\"
        }
      }

      if (opts.unescape === true) {
        value = advance() || ""
      } else {
        value += advance() || ""
      }

      if (state.brackets === 0) {
        push({
          type: "text",
          value,
        })
        continue
      }
    }

    if (
      state.brackets > 0 &&
      (value !== "]" || prev.value === "[" || prev.value === "[^")
    ) {
      if (opts.posix !== false && value === ":") {
        const inner = prev.value.slice(1)

        if (inner.includes("[")) {
          prev.posix = true

          if (inner.includes(":")) {
            const idx = prev.value.lastIndexOf("[")
            const pre = prev.value.slice(0, idx)
            const rest = prev.value.slice(idx + 2)
            const posix = POSIX_REGEX_SOURCE[rest]

            if (posix) {
              prev.value = pre + posix
              state.backtrack = true
              advance()

              if (!bos.output && tokens.indexOf(prev) === 1) {
                bos.output = ONE_CHAR
              }

              continue
            }
          }
        }
      }

      if ((value === "[" && peek() !== ":") || (value === "-" && peek() === "]")) {
        value = `\\${value}`
      }

      if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
        value = `\\${value}`
      }

      if (opts.posix === true && value === "!" && prev.value === "[") {
        value = "^"
      }

      prev.value += value
      append({
        value,
      })
      continue
    }

    if (state.quotes === 1 && value !== '"') {
      value = escapeRegex(value)
      prev.value += value
      append({
        value,
      })
      continue
    }

    if (value === '"') {
      state.quotes = state.quotes === 1 ? 0 : 1

      if (opts.keepQuotes === true) {
        push({
          type: "text",
          value,
        })
      }

      continue
    }

    if (value === "(") {
      increment("parens")
      push({
        type: "paren",
        value,
      })
      continue
    }

    if (value === ")") {
      if (state.parens === 0 && opts.strictBrackets === true) {
        throw SyntaxError(syntaxError("opening", "("))
      }

      const extglob = extglobs[extglobs.length - 1]

      if (extglob && state.parens === extglob.parens + 1) {
        extglobClose(extglobs.pop())
        continue
      }

      push({
        type: "paren",
        value,
        output: state.parens ? ")" : "\\)",
      })
      decrement("parens")
      continue
    }

    if (value === "[") {
      if (opts.nobracket === true || !remaining().includes("]")) {
        if (opts.nobracket !== true && opts.strictBrackets === true) {
          throw SyntaxError(syntaxError("closing", "]"))
        }

        value = `\\${value}`
      } else {
        increment("brackets")
      }

      push({
        type: "bracket",
        value,
      })
      continue
    }

    if (value === "]") {
      if (
        opts.nobracket === true ||
        (prev && prev.type === "bracket" && prev.value.length === 1)
      ) {
        push({
          type: "text",
          value,
          output: `\\${value}`,
        })
        continue
      }

      if (state.brackets === 0) {
        if (opts.strictBrackets === true) {
          throw SyntaxError(syntaxError("opening", "["))
        }

        push({
          type: "text",
          value,
          output: `\\${value}`,
        })
        continue
      }

      decrement("brackets")
      const prevValue = prev.value.slice(1)

      if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
        value = `/${value}`
      }

      prev.value += value
      append({
        value,
      })

      if (opts.literalBrackets === false || hasRegexChars(prevValue)) {
        continue
      }

      const escaped = escapeRegex(prev.value)
      state.output = state.output.slice(0, -prev.value.length)

      if (opts.literalBrackets === true) {
        state.output += escaped
        prev.value = escaped
        continue
      }

      prev.value = `(${capture}${escaped}|${prev.value})`
      state.output += prev.value
      continue
    }

    if (value === "{" && opts.nobrace !== true) {
      increment("braces")
      const open = {
        type: "brace",
        value,
        output: "(",
        outputIndex: state.output.length,
        tokensIndex: state.tokens.length,
      }
      braces.push(open)
      push(open)
      continue
    }

    if (value === "}") {
      const brace = braces[braces.length - 1]

      if (opts.nobrace === true || !brace) {
        push({
          type: "text",
          value,
          output: value,
        })
        continue
      }

      let output = ")"

      if (brace.dots === true) {
        const arr = tokens.slice()
        const range = []

        for (let i = arr.length - 1; i >= 0; i--) {
          tokens.pop()

          if (arr[i].type === "brace") {
            break
          }

          if (arr[i].type !== "dots") {
            range.unshift(arr[i].value)
          }
        }

        output = expandRange(range, opts)
        state.backtrack = true
      }

      if (brace.comma !== true && brace.dots !== true) {
        const out = state.output.slice(0, brace.outputIndex)
        const toks = state.tokens.slice(brace.tokensIndex)
        brace.value = brace.output = "\\{"
        value = output = "\\}"
        state.output = out

        for (const t of toks) {
          state.output += t.output || t.value
        }
      }

      push({
        type: "brace",
        value,
        output,
      })
      decrement("braces")
      braces.pop()
      continue
    }

    if (value === "|") {
      if (extglobs.length > 0) {
        extglobs[extglobs.length - 1].conditions++
      }

      push({
        type: "text",
        value,
      })
      continue
    }

    if (value === ",") {
      let output = value
      const brace = braces[braces.length - 1]

      if (brace && stack[stack.length - 1] === "braces") {
        brace.comma = true
        output = "|"
      }

      push({
        type: "comma",
        value,
        output,
      })
      continue
    }

    if (value === "/") {
      if (prev.type === "dot" && state.index === state.start + 1) {
        state.start = state.index + 1
        state.consumed = ""
        state.output = ""
        tokens.pop()
        prev = bos
        continue
      }

      push({
        type: "slash",
        value,
        output: SLASH_LITERAL,
      })
      continue
    }

    if (value === ".") {
      if (state.braces > 0 && prev.type === "dot") {
        if (prev.value === ".") prev.output = DOT_LITERAL
        const brace = braces[braces.length - 1]
        prev.type = "dots"
        prev.output += value
        prev.value += value
        brace.dots = true
        continue
      }

      if (
        state.braces + state.parens === 0 &&
        prev.type !== "bos" &&
        prev.type !== "slash"
      ) {
        push({
          type: "text",
          value,
          output: DOT_LITERAL,
        })
        continue
      }

      push({
        type: "dot",
        value,
        output: DOT_LITERAL,
      })
      continue
    }

    if (value === "?") {
      const isGroup = prev && prev.value === "("

      if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("qmark", value)
        continue
      }

      if (prev && prev.type === "paren") {
        const next = peek()
        let output = value

        if (next === "<" && !supportsLookbehinds()) {
          throw Error("Node.js v10 or higher is required for regex lookbehinds")
        }

        if (
          (prev.value === "(" && !/[!=<:]/.test(next)) ||
          (next === "<" && !/<([!=]|\w+>)/.test(remaining()))
        ) {
          output = `\\${value}`
        }

        push({
          type: "text",
          value,
          output,
        })
        continue
      }

      if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
        push({
          type: "qmark",
          value,
          output: QMARK_NO_DOT,
        })
        continue
      }

      push({
        type: "qmark",
        value,
        output: QMARK,
      })
      continue
    }

    if (value === "!") {
      if (opts.noextglob !== true && peek() === "(") {
        if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
          extglobOpen("negate", value)
          continue
        }
      }

      if (opts.nonegate !== true && state.index === 0) {
        negate()
        continue
      }
    }

    if (value === "+") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("plus", value)
        continue
      }

      if ((prev && prev.value === "(") || opts.regex === false) {
        push({
          type: "plus",
          value,
          output: PLUS_LITERAL,
        })
        continue
      }

      if (
        (prev &&
          (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace")) ||
        state.parens > 0
      ) {
        push({
          type: "plus",
          value,
        })
        continue
      }

      push({
        type: "plus",
        value: PLUS_LITERAL,
      })
      continue
    }

    if (value === "@") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        push({
          type: "at",
          extglob: true,
          value,
          output: "",
        })
        continue
      }

      push({
        type: "text",
        value,
      })
      continue
    }

    if (value !== "*") {
      if (value === "$" || value === "^") {
        value = `\\${value}`
      }

      const match = REGEX_NON_SPECIAL_CHARS.exec(remaining())

      if (match) {
        value += match[0]
        state.index += match[0].length
      }

      push({
        type: "text",
        value,
      })
      continue
    }

    if (prev && (prev.type === "globstar" || prev.star === true)) {
      prev.type = "star"
      prev.star = true
      prev.value += value
      prev.output = star
      state.backtrack = true
      state.globstar = true
      consume(value)
      continue
    }

    let rest = remaining()

    if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
      extglobOpen("star", value)
      continue
    }

    if (prev.type === "star") {
      if (opts.noglobstar === true) {
        consume(value)
        continue
      }

      const prior = prev.prev
      const before = prior.prev
      const isStart = prior.type === "slash" || prior.type === "bos"
      const afterStar = before && (before.type === "star" || before.type === "globstar")

      if (opts.bash === true && (!isStart || (rest[0] && rest[0] !== "/"))) {
        push({
          type: "star",
          value,
          output: "",
        })
        continue
      }

      const isBrace =
        state.braces > 0 && (prior.type === "comma" || prior.type === "brace")
      const isExtglob =
        extglobs.length && (prior.type === "pipe" || prior.type === "paren")

      if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
        push({
          type: "star",
          value,
          output: "",
        })
        continue
      }

      while (rest.slice(0, 3) === "/**") {
        const after = input[state.index + 4]

        if (after && after !== "/") {
          break
        }

        rest = rest.slice(3)
        consume("/**", 3)
      }

      if (prior.type === "bos" && eos()) {
        prev.type = "globstar"
        prev.value += value
        prev.output = globstar(opts)
        state.output = prev.output
        state.globstar = true
        consume(value)
        continue
      }

      if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
        state.output = state.output.slice(0, -(prior.output + prev.output).length)
        prior.output = `(?:${prior.output}`
        prev.type = "globstar"
        prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)")
        prev.value += value
        state.globstar = true
        state.output += prior.output + prev.output
        consume(value)
        continue
      }

      if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
        const end = rest[1] !== void 0 ? "|$" : ""
        state.output = state.output.slice(0, -(prior.output + prev.output).length)
        prior.output = `(?:${prior.output}`
        prev.type = "globstar"
        prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`
        prev.value += value
        state.output += prior.output + prev.output
        state.globstar = true
        consume(value + advance())
        push({
          type: "slash",
          value: "/",
          output: "",
        })
        continue
      }

      if (prior.type === "bos" && rest[0] === "/") {
        prev.type = "globstar"
        prev.value += value
        prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`
        state.output = prev.output
        state.globstar = true
        consume(value + advance())
        push({
          type: "slash",
          value: "/",
          output: "",
        })
        continue
      }

      state.output = state.output.slice(0, -prev.output.length)
      prev.type = "globstar"
      prev.output = globstar(opts)
      prev.value += value
      state.output += prev.output
      state.globstar = true
      consume(value)
      continue
    }

    const token = {
      type: "star",
      value,
      output: star,
    }

    if (opts.bash === true) {
      token.output = ".*?"

      if (prev.type === "bos" || prev.type === "slash") {
        token.output = nodot + token.output
      }

      push(token)
      continue
    }

    if (
      prev &&
      (prev.type === "bracket" || prev.type === "paren") &&
      opts.regex === true
    ) {
      token.output = value
      push(token)
      continue
    }

    if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
      if (prev.type === "dot") {
        state.output += NO_DOT_SLASH
        prev.output += NO_DOT_SLASH
      } else if (opts.dot === true) {
        state.output += NO_DOTS_SLASH
        prev.output += NO_DOTS_SLASH
      } else {
        state.output += nodot
        prev.output += nodot
      }

      if (peek() !== "*") {
        state.output += ONE_CHAR
        prev.output += ONE_CHAR
      }
    }

    push(token)
  }

  while (state.brackets > 0) {
    if (opts.strictBrackets === true) throw SyntaxError(syntaxError("closing", "]"))
    state.output = escapeLast(state.output, "[")
    decrement("brackets")
  }

  while (state.parens > 0) {
    if (opts.strictBrackets === true) throw SyntaxError(syntaxError("closing", ")"))
    state.output = escapeLast(state.output, "(")
    decrement("parens")
  }

  while (state.braces > 0) {
    if (opts.strictBrackets === true) throw SyntaxError(syntaxError("closing", "}"))
    state.output = escapeLast(state.output, "{")
    decrement("braces")
  }

  if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
    push({
      type: "maybe_slash",
      value: "",
      output: `${SLASH_LITERAL}?`,
    })
  }

  if (state.backtrack === true) {
    state.output = ""

    for (const token of state.tokens) {
      state.output += token.output != null ? token.output : token.value

      if (token.suffix) {
        state.output += token.suffix
      }
    }
  }

  return state
}

parse$1.fastpaths = (input, options) => {
  const opts = { ...options }
  const max = lodash.isNumber(opts.maxLength)
    ? Math.min(MAX_LENGTH, opts.maxLength)
    : MAX_LENGTH
  const len = input.length

  if (len > max) {
    throw SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`)
  }

  input = REPLACEMENTS[input] || input
  const win32 = isWindows$2(options)
  const {
    DOT_LITERAL,
    SLASH_LITERAL,
    ONE_CHAR,
    DOTS_SLASH,
    NO_DOT,
    NO_DOTS,
    NO_DOTS_SLASH,
    STAR,
    START_ANCHOR,
  } = globChars(win32)
  const nodot = opts.dot ? NO_DOTS : NO_DOT
  const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT
  const capture = opts.capture ? "" : "?:"
  const state = {
    negated: false,
    prefix: "",
  }
  let star = opts.bash === true ? ".*?" : STAR

  if (opts.capture) {
    star = `(${star})`
  }

  const globstar = ({ noglobstar, dot }) => {
    if (noglobstar === true) return star
    return `(${capture}(?:(?!${START_ANCHOR}${dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`
  }

  const create = str => {
    switch (str) {
      case "*":
        return `${nodot}${ONE_CHAR}${star}`

      case ".*":
        return `${DOT_LITERAL}${ONE_CHAR}${star}`

      case "*.*":
        return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`

      case "*/*":
        return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`

      case "**":
        return nodot + globstar(opts)

      case "**/*":
        return `(?:${nodot}${globstar(
          opts
        )}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`

      case "**/*.*":
        return `(?:${nodot}${globstar(
          opts
        )}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`

      case "**/.*":
        return `(?:${nodot}${globstar(
          opts
        )}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`

      default: {
        const match = /^(.*?)\.(\w+)$/.exec(str)
        if (!match) return
        const source = create(match[1])
        if (!source) return
        return source + DOT_LITERAL + match[2]
      }
    }
  }

  const output = removePrefix(input, state)
  let source = create(output)

  if (source && opts.strictSlashes !== true) {
    source += `${SLASH_LITERAL}?`
  }

  return source
}

const isObject = val => val && typeof val === "object" && !Array.isArray(val)

const picomatch = (glob, options, returnState = false) => {
  if (Array.isArray(glob)) {
    const fns = glob.map(input => picomatch(input, options, returnState))

    const arrayMatcher = str => {
      for (const isMatch of fns) {
        const state = isMatch(str)
        if (state) return state
      }

      return false
    }

    return arrayMatcher
  }

  const isState = isObject(glob) && glob.tokens && glob.input

  if (glob === "" || (!lodash.isString(glob) && !isState)) {
    throw TypeError("Expected pattern to be a non-empty string")
  }

  const opts = options || {}
  const posix = isWindows$2(options)
  const regex = isState ? compileRe(glob, options) : makeRe(glob, options, false, true)
  const state = regex.state
  delete regex.state

  let isIgnored = (...args) => false

  if (opts.ignore) {
    const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null }
    isIgnored = picomatch(opts.ignore, ignoreOpts, returnState)
  }

  const matcher = (input, returnObject = false) => {
    const { isMatch, match, output } = test(input, regex, options, {
      glob,
      posix,
    })
    const result = {
      glob,
      state,
      regex,
      posix,
      input,
      output,
      match,
      isMatch,
    }

    if (lodash.isFunction(opts.onResult)) {
      opts.onResult(result)
    }

    if (isMatch === false) {
      result.isMatch = false
      return returnObject ? result : false
    }

    if (isIgnored(input)) {
      if (lodash.isFunction(opts.onIgnore)) {
        opts.onIgnore(result)
      }

      result.isMatch = false
      return returnObject ? result : false
    }

    if (lodash.isFunction(opts.onMatch)) {
      opts.onMatch(result)
    }

    return returnObject ? result : true
  }

  if (returnState) {
    matcher.state = state
  }

  return matcher
}

function test(input, regex, options, { glob, posix } = {}) {
  if (!lodash.isString(input)) {
    throw TypeError("Expected input to be a string")
  }

  if (input === "") {
    return {
      isMatch: false,
      output: "",
    }
  }

  const opts = options || {}
  const format = opts.format || (posix ? toPosixSlashes : null)
  let match = input === glob
  let output = match && format ? format(input) : input

  if (match === false) {
    output = format ? format(input) : input
    match = output === glob
  }

  if (match === false || opts.capture === true) {
    if (opts.matchBase === true || opts.basename === true) {
      match = matchBase(input, regex, options, posix)
    } else {
      match = regex.exec(output)
    }
  }

  return {
    isMatch: Boolean(match),
    match,
    output,
  }
}

function matchBase(input, glob, options, posix = isWindows$2(options)) {
  const regex = glob instanceof RegExp ? glob : makeRe(glob, options)
  return regex.test(path.basename(input))
}

function compileRe(parsed, options, returnOutput = false, returnState = false) {
  if (returnOutput === true) {
    return parsed.output
  }

  const opts = options || {}
  const prepend = opts.contains ? "" : "^"
  const append = opts.contains ? "" : "$"
  let source = `${prepend}(?:${parsed.output})${append}`

  if (parsed && parsed.negated === true) {
    source = `^(?!${source}).*$`
  }

  const regex = toRegex(source, options)

  if (returnState === true) {
    regex.state = parsed
  }

  return regex
}

function makeRe(input, options, returnOutput = false, returnState = false) {
  if (!input || !lodash.isString(input)) {
    throw TypeError("Expected a non-empty string")
  }

  const opts = options || {}
  let parsed = {
    negated: false,
    fastpaths: true,
  }
  let prefix = ""
  let output

  if (input.startsWith("./")) {
    input = input.slice(2)
    prefix = parsed.prefix = "./"
  }

  if (opts.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
    output = parse$1.fastpaths(input, options)
  }

  if (output === undefined) {
    parsed = parse$1(input, options)
    parsed.prefix = prefix + (parsed.prefix || "")
  } else {
    parsed.output = output
  }

  return compileRe(parsed, options, returnOutput, returnState)
}

function toRegex(source, options) {
  try {
    const opts = options || {}
    return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""))
  } catch (err) {
    if (options && options.debug === true) throw err
    return /$^/
  }
}

const BANG = "!"
const DEFAULT_OPTIONS = {
  returnIndex: false,
}

const arrify = item => (Array.isArray(item) ? item : [item])

const createPattern = (matcher, options) => {
  if (lodash.isFunction(matcher)) {
    return matcher
  }

  if (lodash.isString(matcher)) {
    const glob = picomatch(matcher, options)
    return string => matcher === string || glob(string)
  }

  if (matcher instanceof RegExp) {
    return string => matcher.test(string)
  }

  return string => false
}

const matchPatterns = (patterns, negPatterns, args, returnIndex) => {
  const isList = Array.isArray(args)

  const _path = isList ? args[0] : args

  if (!isList && !lodash.isString(_path)) {
    throw TypeError(
      `anymatch: second argument must be a string: got ${Object.prototype.toString.call(
        _path
      )}`
    )
  }

  const path$1 = path.normalize(_path)

  for (const nglob of negPatterns) {
    if (nglob(path$1)) {
      return returnIndex ? -1 : false
    }
  }

  const applied = isList && [path$1].concat(args.slice(1))

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index]

    if (isList ? pattern(...applied) : pattern(path$1)) {
      return returnIndex ? index : true
    }
  }

  return returnIndex ? -1 : false
}

const anymatch = (matchers, testString, options = DEFAULT_OPTIONS) => {
  if (matchers == null) {
    throw TypeError("anymatch: specify first argument")
  }

  const opts = lodash.isBoolean(options)
    ? {
        returnIndex: options,
      }
    : options
  const returnIndex = opts.returnIndex || false
  const mtchers = arrify(matchers)
  const negatedGlobs = mtchers
    .filter(item => lodash.isString(item) && item.charAt(0) === BANG)
    .map(item => item.slice(1))
    .map(item => picomatch(item, opts))
  const patterns = mtchers.map(matcher => createPattern(matcher, opts))

  if (testString == null) {
    return (testString, ri = false) => {
      const returnIndex = lodash.isBoolean(ri) ? ri : false
      return matchPatterns(patterns, negatedGlobs, testString, returnIndex)
    }
  }

  return matchPatterns(patterns, negatedGlobs, testString, returnIndex)
}

const defaultOpts = {
  delay: 200,
  events: ["add", "change", "unlink"],
  ignored: [],
  ignoreInitial: true,
  queue: true,
}

function listenerCount$1(ee, evtName) {
  if (lodash.isFunction(ee.listenerCount)) {
    return ee.listenerCount(evtName)
  }

  return ee.listeners(evtName).length
}

function hasErrorListener(ee) {
  return listenerCount$1(ee, "error") !== 0
}

function exists(val) {
  return val != null
}

function watch(glob, options, cb) {
  if (lodash.isFunction(options)) {
    cb = options
    options = {}
  }

  const opt = lodash.defaults(options, defaultOpts)

  if (!Array.isArray(opt.events)) {
    opt.events = [opt.events]
  }

  if (Array.isArray(glob)) {
    glob = glob.slice()
  } else {
    glob = [glob]
  }

  let queued = false
  let running = false
  const positives = new Array(glob.length)
  const negatives = new Array(glob.length)
  glob.reverse().forEach(sortGlobs)

  function sortGlobs(globString, index) {
    const result = isNegatedGlob(globString)

    if (result.negated) {
      negatives[index] = result.pattern
    } else {
      positives[index] = result.pattern
    }
  }

  function shouldBeIgnored(path) {
    const positiveMatch = anymatch(positives, path, true)
    const negativeMatch = anymatch(negatives, path, true)

    if (negativeMatch === -1) {
      return false
    }

    return negativeMatch < positiveMatch
  }

  const toWatch = positives.filter(exists)

  if (negatives.some(exists)) {
    opt.ignored = [].concat(opt.ignored, shouldBeIgnored)
  }

  const watcher = chokidar.watch(toWatch, opt)

  function runComplete(err) {
    running = false

    if (err && hasErrorListener(watcher)) {
      watcher.emit("error", err)
    }

    if (queued) {
      queued = false
      onChange()
    }
  }

  function onChange() {
    if (running) {
      if (opt.queue) {
        queued = true
      }

      return
    }

    running = true
    asyncDone(cb, runComplete)
  }

  let fn

  if (lodash.isFunction(cb)) {
    fn = lodash.debounce(onChange, opt.delay)
  }

  function watchEvent(eventName) {
    watcher.on(eventName, fn)
  }

  if (fn) {
    opt.events.forEach(watchEvent)
  }

  return watcher
}

class Gulp extends Undertaker {
  constructor() {
    super()

    this.src = (globs, options) => {
      return src(globs, options)
    }

    this.dest = (globs, options) => {
      return dest(globs, options)
    }

    this.symlink = (folder, options) => {
      return symlink$1(folder, options)
    }

    this.Gulp = Gulp
    this.watch = this.watch.bind(this)
    this.task = this.task.bind(this)
    this.series = this.series.bind(this)
    this.parallel = this.parallel.bind(this)
    this.registry = this.registry.bind(this)
    this.tree = this.tree.bind(this)
    this.lastRun = this.lastRun.bind(this)
  }

  watch(glob, opt, task) {
    if (
      lodash.isString(opt) ||
      lodash.isString(task) ||
      Array.isArray(opt) ||
      Array.isArray(task)
    ) {
      throw Error(
        `watching ${glob}: watch task has to be a function (optionally generated by using gulp.parallel or gulp.series)`
      )
    }

    if (lodash.isFunction(opt)) {
      task = opt
      opt = undefined
    }

    const fn = lodash.isFunction(task) ? this.parallel(task) : undefined
    return watch(glob, opt || {}, fn)
  }
}

const inst = new Gulp()

module.exports = inst
