"use strict"

function _interopDefault(ex) {
  return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex
}

var assert = require("assert")
var events = require("events")
var lodash = require("lodash")
var domain = require("domain")
var stream = require("stream")
var util = require("util")
var glob = require("glob")
var path = require("path")
var normalize$1 = _interopDefault(require("value-or-function"))
var sourcemap = _interopDefault(require("vinyl-sourcemap"))
var fs = require("fs")
var removeBomStream = _interopDefault(require("remove-bom-stream"))
var lazystream = _interopDefault(require("lazystream"))
var iconv = _interopDefault(require("iconv-lite"))
var removeBomBuffer = _interopDefault(require("remove-bom-buffer"))
var fs$1 = require("fs-extra")
var os = require("os")
var chokidar = require("chokidar")
var anymatch = _interopDefault(require("anymatch"))

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

var eosConfig = {
  error: false,
}

function rethrowAsync(err) {
  process.nextTick(rethrow)

  function rethrow() {
    throw err
  }
}

function tryCatch(fn, args) {
  try {
    return fn.apply(null, args)
  } catch (err) {
    rethrowAsync(err)
  }
}

function asyncDone(fn, cb) {
  cb = lodash.once(cb)
  const d = domain.create()
  d.once("error", onError)
  const domainBoundFn = d.bind(fn)

  function done(...rest) {
    d.removeListener("error", onError)
    d.exit()
    return tryCatch(cb, rest)
  }

  function onSuccess(result) {
    done(null, result)
  }

  function onError(error) {
    if (!error) {
      error = new Error("Promise rejected without Error")
    }

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

const defaultExts = {
  create: lodash.noop,
  before: lodash.noop,
  after: lodash.noop,
  error: lodash.noop,
}
function defaultExtensions(extensions = {}) {
  return {
    create: extensions.create || defaultExts.create,
    before: extensions.before || defaultExts.before,
    after: extensions.after || defaultExts.after,
    error: extensions.error || defaultExts.error,
  }
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
  const exts = defaultExtensions(extensions)

  if (length === 0) {
    return done(null, results)
  }

  for (idx = 0; idx < length; idx++) {
    const key = keys[idx]
    next(key)
  }

  function next(key) {
    const value = values[key]
    const storage = exts.create(value, key) || {}
    exts.before(storage)
    iterator(value, key, lodash.once(handler))

    function handler(err, result) {
      if (err) {
        exts.error(err, storage)
        return done(err, results)
      }

      exts.after(result, storage)
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
  const exts = defaultExtensions(extensions)

  if (length === 0) {
    return done(null, results)
  }

  const key = keys[idx]
  next(key)

  function next(key) {
    const value = values[key]
    const storage = exts.create(value, key) || {}
    exts.before(storage)
    iterator(value, key, lodash.once(handler))

    function handler(err, result) {
      if (err) {
        exts.error(err, storage)
        return done(err, results)
      }

      exts.after(result, storage)
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

function iterator(fn, _key, cb) {
  return asyncDone(fn, cb)
}

function series(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function series(done) {
    mapSeries(args, iterator, extensions, done)
  }

  return series
}

function iterator$1(fn, _key, cb) {
  return asyncDone(fn, cb)
}

function parallel(...rest) {
  let args = verifyArguments(rest)
  const extensions = getExtensions(lodash.last(args))

  if (extensions) {
    args = lodash.initial(args)
  }

  function parallel(done) {
    map(args, iterator$1, extensions, done)
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

function iterator$2(fn, _key, cb) {
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
    mapSeries(args, iterator$2, extensions, onSettled$1)
  }

  return settleSeries
}

function iterator$3(fn, _key, cb) {
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
    map(args, iterator$3, extensions, onSettled$1)
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
    throw new Error("All input streams must be readable")
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
function obj(fn, options) {
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
  return obj(data => {
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
const obj$1 = define({
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

var toAbsoluteGlob = (glob, options) => {
  const opts = options || {}
  let cwd = path.resolve(opts.cwd ? opts.cwd : process.cwd())
  cwd = unixify(cwd)
  let rootDir = opts.root

  if (rootDir) {
    rootDir = unixify(rootDir)

    if (process.platform === "win32" || !path.isAbsolute(rootDir)) {
      rootDir = unixify(path.resolve(rootDir))
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

function unixify(filepath) {
  return filepath.replace(/\\/g, "/")
}

function join(dir, glob) {
  if (dir.charAt(dir.length - 1) === "/") {
    dir = dir.slice(0, -1)
  }

  if (glob.charAt(0) === "/") {
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
      throw new Error(`Invalid glob at index ${index}`)
    }

    const glob = isNegatedGlob(globString)
    const globArray = glob.negated ? negatives : positives
    globArray.push({
      index,
      glob: glob.pattern,
    })
  }

  if (positives.length === 0) {
    throw new Error("Missing positive glob")
  }

  const streams = positives.map(streamFromPositive)
  const aggregate = new OrderedStreams(streams)
  const uniqueStream = unique(ourOpt.uniqueBy)
  return obj$1(aggregate, uniqueStream)

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

const slice = Array.prototype.slice

function createResolver(config = {}, options = {}) {
  const resolver = {
    resolve,
  }
  const constants = {}

  function resolveConstant(key) {
    if (constants.hasOwnProperty(key)) {
      return constants[key]
    }

    const definition = config[key]

    if (!definition) {
      return
    }

    let option = options[key]

    if (option != null) {
      if (typeof option === "function") {
        return
      }

      option = normalize$1.call(resolver, definition.type, option)

      if (option != null) {
        constants[key] = option
        return option
      }
    }

    const fallback = definition.default

    if (option == null && typeof fallback !== "function") {
      constants[key] = fallback
      return fallback
    }
  }

  const stack = []

  function resolve(key) {
    let option = resolveConstant(key)

    if (option != null) {
      return option
    }

    const definition = config[key]

    if (!definition) {
      return
    }

    if (stack.includes(key)) {
      throw new Error("Recursive resolution denied.")
    }

    option = options[key]
    const fallback = definition.default
    const appliedArgs = slice.call(arguments, 1)
    const args = [definition.type, option].concat(appliedArgs)

    function toResolve() {
      stack.push(key)
      let option = normalize$1.apply(resolver, args)

      if (option == null) {
        option = fallback

        if (typeof option === "function") {
          option = option.apply(resolver, appliedArgs)
        }
      }

      return option
    }

    function onResolve() {
      stack.pop()
    }

    return tryResolve(toResolve, onResolve)
  }

  return resolver
}

function tryResolve(toResolve, onResolve) {
  try {
    return toResolve()
  } finally {
    onResolve()
  }
}

const MASK_MODE = parseInt("7777", 8)
const DEFAULT_FILE_MODE = parseInt("0666", 8)
const DEFAULT_ENCODING = "utf8"

const config = {
  buffer: {
    type: "boolean",
    default: true,
  },
  read: {
    type: "boolean",
    default: true,
  },
  since: {
    type: "date",
  },
  removeBOM: {
    type: "boolean",
    default: true,
  },
  encoding: {
    type: ["string", "boolean"],
    default: DEFAULT_ENCODING,
  },
  sourcemaps: {
    type: "boolean",
    default: false,
  },
  resolveSymlinks: {
    type: "boolean",
    default: true,
  },
}

function prepareRead(optResolver) {
  function normalize(file, enc, callback) {
    const since = optResolver.resolve("since", file)

    if (file.stat && file.stat.mtime <= since) {
      return callback()
    }

    return callback(null, file)
  }

  return main.obj(normalize)
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
      throw new Error("already started")
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

function sourcemapStream(optResolver) {
  function addSourcemap(file, enc, callback) {
    const srcMap = optResolver.resolve("sourcemaps", file)

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

  return main.obj(addSourcemap)
}

function readDir(file, optResolver, onRead) {
  onRead()
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

function getCodec(encoding) {
  let codec = cache[encoding]

  if (!!codec || !encoding || cache.hasOwnProperty(encoding)) {
    return codec
  }

  try {
    codec = new Codec(iconv.getCodec(encoding), encoding)
  } catch (err) {}

  cache[encoding] = codec
  return codec
}

getCodec(DEFAULT_ENCODING)

function streamFile(file, optResolver, onRead) {
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)

  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  const filePath = file.path
  file.contents = new lazystream.Readable(() => {
    let contents = fs.createReadStream(filePath)

    if (encoding) {
      const removeBOM = codec.bomAware && optResolver.resolve("removeBOM", file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = contents
          .pipe(codec.decodeStream())
          .pipe(getCodec(DEFAULT_ENCODING).encodeStream())
      }

      if (removeBOM) {
        contents = contents.pipe(removeBomStream())
      }
    }

    return contents
  })
  onRead()
}

function bufferFile(file, optResolver, onRead) {
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)

  if (encoding && !codec) {
    return onRead(new Error(`Unsupported encoding: ${encoding}`))
  }

  fs.readFile(file.path, onReadFile)

  function onReadFile(readErr, contents) {
    if (readErr) {
      return onRead(readErr)
    }

    if (encoding) {
      let removeBOM = codec.bomAware && optResolver.resolve("removeBOM", file)

      if (codec.enc !== DEFAULT_ENCODING) {
        contents = codec.decode(contents)
        removeBOM = removeBOM && contents[0] === "\ufeff"
        contents = getCodec(DEFAULT_ENCODING).encode(contents)
      }

      if (removeBOM) {
        contents = removeBomBuffer(contents)
      }
    }

    file.contents = contents
    onRead()
  }
}

function readLink(file, optResolver, onRead) {
  fs.readlink(file.path, onReadlink)

  function onReadlink(readErr, target) {
    if (readErr) {
      return onRead(readErr)
    }

    file.symlink = target
    onRead()
  }
}

function readContents(optResolver) {
  function readFile(file, enc, callback) {
    const read = optResolver.resolve("read", file)

    if (!read) {
      return callback(null, file)
    }

    if (file.isDirectory()) {
      return readDir(file, optResolver, onRead)
    }

    if (file.stat && file.stat.isSymbolicLink()) {
      return readLink(file, optResolver, onRead)
    }

    const buffer = optResolver.resolve("buffer", file)

    if (buffer) {
      return bufferFile(file, optResolver, onRead)
    }

    return streamFile(file, optResolver, onRead)

    function onRead(readErr) {
      if (readErr) {
        return callback(readErr)
      }

      callback(null, file)
    }
  }

  return main.obj(readFile)
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

function resolveSymlinks(optResolver) {
  function resolveFile(file, _enc, callback) {
    reflectLinkStat(file.path, file, onReflect)

    function onReflect(statErr) {
      if (statErr) {
        return callback(statErr)
      }

      if (!file.stat.isSymbolicLink()) {
        return callback(null, file)
      }

      const resolveSymlinks = optResolver.resolve("resolveSymlinks", file)

      if (!resolveSymlinks) {
        return callback(null, file)
      }

      reflectStat(file.path, file, onReflect)
    }
  }

  return main.obj(resolveFile)
}

function isValidGlob(glob) {
  return Array.isArray(glob) ? glob.every(isValidGlob) : lodash.isString(glob)
}

function src(glob, opt) {
  const optResolver = createResolver(config, opt)

  if (!isValidGlob(glob)) {
    throw new Error(`Invalid glob argument: ${glob}`)
  }

  const streams = [
    globStream(glob, opt),
    wrapVinyl(),
    resolveSymlinks(optResolver),
    prepareRead(optResolver),
    readContents(optResolver),
    sourcemapStream(optResolver),
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

const config$1 = {
  cwd: {
    type: "string",
    default: process.cwd,
  },
  mode: {
    type: "number",

    default({ stat }) {
      return stat ? stat.mode : null
    },
  },
  dirMode: {
    type: "number",
  },
  overwrite: {
    type: "boolean",
    default: true,
  },
  append: {
    type: "boolean",
    default: false,
  },
  encoding: {
    type: ["string", "boolean"],
    default: DEFAULT_ENCODING,
  },
  sourcemaps: {
    type: ["string", "boolean"],
    default: false,
  },
  relativeSymlinks: {
    type: "boolean",
    default: false,
  },
  useJunctions: {
    type: "boolean",
    default: true,
  },
}

function prepareWrite(folderResolver, optResolver) {
  if (!folderResolver) {
    throw new Error("Invalid output folder")
  }

  function normalize(file, _enc, cb) {
    if (!File.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `dest()`"))
    }

    if (!lodash.isFunction(file.isSymbolic)) {
      file = new File(file)
    }

    const outFolderPath = folderResolver.resolve("outFolder", file)

    if (!outFolderPath) {
      return cb(new Error("Invalid output folder"))
    }

    const cwd = path.resolve(optResolver.resolve("cwd", file))
    const basePath = path.resolve(cwd, outFolderPath)
    const writePath = path.resolve(basePath, file.relative)
    file.cwd = cwd
    file.base = basePath
    file.path = writePath

    if (!file.isSymbolic()) {
      const mode = optResolver.resolve("mode", file)
      file.stat = file.stat || new fs.Stats()
      file.stat.mode = mode
    }

    cb(null, file)
  }

  return main.obj(normalize)
}

function sourcemapStream$1(optResolver) {
  function saveSourcemap(file, enc, callback) {
    const self = this
    const srcMap = optResolver.resolve("sourcemaps", file)

    if (!srcMap) {
      return callback(null, file)
    }

    const srcMapLocation = lodash.isString(srcMap) ? srcMap : undefined
    sourcemap.write(file, srcMapLocation, onWrite)

    function onWrite(sourcemapErr, updatedFile, sourcemapFile) {
      if (sourcemapErr) {
        return callback(sourcemapErr)
      }

      self.push(updatedFile)

      if (sourcemapFile) {
        self.push(sourcemapFile)
      }

      callback()
    }
  }

  return main.obj(saveSourcemap)
}

function writeDir(file, optResolver, onWritten) {
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

function writeStream(file, optResolver, onWritten) {
  const flags = getFlags({
    overwrite: optResolver.resolve("overwrite", file),
    append: optResolver.resolve("append", file),
  })
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)

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
      .pipe(getCodec(DEFAULT_ENCODING).decodeStream())
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
        resolve,
      },
      complete
    )

    function resolve(key) {
      if (key === "encoding") {
        return encoding
      }

      if (key === "removeBOM") {
        return false
      }

      throw new Error(`Eek! stub resolver doesn't have ${key}`)
    }

    function complete() {
      if (!lodash.isNumber(fd)) {
        return callback()
      }

      updateMetadata(fd, file, callback)
    }
  }
}

function writeBuffer(file, optResolver, onWritten) {
  const flags = getFlags({
    overwrite: optResolver.resolve("overwrite", file),
    append: optResolver.resolve("append", file),
  })
  const encoding = optResolver.resolve("encoding", file)
  const codec = getCodec(encoding)

  if (encoding && !codec) {
    return onWritten(new Error(`Unsupported encoding: ${encoding}`))
  }

  const opt = {
    mode: file.stat.mode,
    flags,
  }
  let contents = file.contents

  if (encoding && codec.enc !== DEFAULT_ENCODING) {
    contents = getCodec(DEFAULT_ENCODING).decode(contents)
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

const isWindows = os.platform() === "win32"

function writeSymbolicLink(file, optResolver, onWritten) {
  if (!file.symlink) {
    return onWritten(new Error("Missing symlink property on symbolic vinyl"))
  }

  const isRelative = optResolver.resolve("relativeSymlinks", file)
  const flags = getFlags({
    overwrite: optResolver.resolve("overwrite", file),
    append: optResolver.resolve("append", file),
  })

  if (!isWindows) {
    return createLinkWithType("file")
  }

  reflectStat(file.symlink, file, onReflect)

  function onReflect(statErr) {
    if (statErr && statErr.code !== "ENOENT") {
      return onWritten(statErr)
    }

    const useJunctions = optResolver.resolve("useJunctions", file)
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

function writeContents(optResolver) {
  function writeFile(file, enc, callback) {
    if (file.isSymbolic()) {
      return writeSymbolicLink(file, optResolver, onWritten)
    }

    if (file.isDirectory()) {
      return writeDir(file, optResolver, onWritten)
    }

    if (file.isStream()) {
      return writeStream(file, optResolver, onWritten)
    }

    if (file.isBuffer()) {
      return writeBuffer(file, optResolver, onWritten)
    }

    if (file.isNull()) {
      return onWritten()
    }

    function onWritten(writeErr) {
      const flags = getFlags({
        overwrite: optResolver.resolve("overwrite", file),
        append: optResolver.resolve("append", file),
      })

      if (isFatalOverwriteError(writeErr, flags)) {
        return callback(writeErr)
      }

      callback(null, file)
    }
  }

  return main.obj(writeFile)
}

const folderConfig = {
  outFolder: {
    type: "string",
  },
}
function dest(outFolder, opt) {
  if (!outFolder) {
    throw Error(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
  }

  const optResolver = createResolver(config$1, opt)
  const folderResolver = createResolver(folderConfig, {
    outFolder,
  })

  function dirpath(file, callback) {
    const dirMode = optResolver.resolve("dirMode", file)
    callback(null, file.dirname, dirMode)
  }

  const saveStream = obj$1(
    prepareWrite(folderResolver, optResolver),
    sourcemapStream$1(optResolver),
    mkdirpStream.obj(dirpath),
    writeContents(optResolver)
  )
  return sink(saveStream)
}

const config$2 = {
  cwd: {
    type: "string",
    default: process.cwd,
  },
  dirMode: {
    type: "number",
  },
  overwrite: {
    type: "boolean",
    default: true,
  },
  relativeSymlinks: {
    type: "boolean",
    default: false,
  },
  useJunctions: {
    type: "boolean",
    default: true,
  },
}

function prepareSymlink(folderResolver, optResolver) {
  if (!folderResolver) {
    throw new Error("Invalid output folder")
  }

  function normalize(file, enc, cb) {
    if (!File.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `symlink()`"))
    }

    if (!lodash.isFunction(file.isSymbolic)) {
      file = new File(file)
    }

    const cwd = path.resolve(optResolver.resolve("cwd", file))
    const outFolderPath = folderResolver.resolve("outFolder", file)

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

  return main.obj(normalize)
}

const isWindows$1 = os.platform() === "win32"

function linkStream(optResolver) {
  function linkFile(file, _enc, callback) {
    const isRelative = optResolver.resolve("relativeSymlinks", file)
    const flags = getFlags({
      overwrite: optResolver.resolve("overwrite", file),
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

      const useJunctions = optResolver.resolve("useJunctions", file)
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

  return main.obj(linkFile)
}

const folderConfig$1 = {
  outFolder: {
    type: "string",
  },
}
function symlink$1(outFolder, opt) {
  if (!outFolder) {
    throw new Error(
      "Invalid symlink() folder argument. Please specify a non-empty string or a function."
    )
  }

  const optResolver = createResolver(config$2, opt)
  const folderResolver = createResolver(folderConfig$1, {
    outFolder,
  })

  function dirpath(file, callback) {
    const dirMode = optResolver.resolve("dirMode", file)
    callback(null, file.dirname, dirMode)
  }

  const stream = pumpify.obj(
    prepareSymlink(folderResolver, optResolver),
    mkdirpStream.obj(dirpath),
    linkStream(optResolver)
  )
  return sink(stream)
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
    this.Gulp = Gulp
    this.watch = this.watch.bind(this)
    this.task = this.task.bind(this)
    this.series = this.series.bind(this)
    this.parallel = this.parallel.bind(this)
    this.registry = this.registry.bind(this)
    this.tree = this.tree.bind(this)
    this.lastRun = this.lastRun.bind(this)
    this.src = src.bind(this)
    this.dest = dest.bind(this)
    this.symlink = symlink$1.bind(this)
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
