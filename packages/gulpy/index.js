"use strict"

function _interopDefault(ex) {
  return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex
}

var assert = require("assert")
var events = require("events")
var lodash = require("lodash")
var domain = require("domain")
var stream = require("stream")
var gs = _interopDefault(require("glob-stream"))
var pumpify = _interopDefault(require("pumpify"))
var toThrough = _interopDefault(require("to-through"))
var isValidGlob = _interopDefault(require("is-valid-glob"))
var createResolver = _interopDefault(require("resolve-options"))
var through = _interopDefault(require("through2"))
var Vinyl = _interopDefault(require("vinyl"))
var sourcemap = _interopDefault(require("vinyl-sourcemap"))
var fs = require("fs")
var removeBomStream = _interopDefault(require("remove-bom-stream"))
var lazystream = _interopDefault(require("lazystream"))
var iconv = _interopDefault(require("iconv-lite"))
var removeBomBuffer = _interopDefault(require("remove-bom-buffer"))
var assign = _interopDefault(require("object.assign"))
var valueOrFunction = require("value-or-function")
var readableStream = require("readable-stream")
var lead = _interopDefault(require("lead"))
var mkdirpStream = _interopDefault(require("fs-mkdirp-stream"))
var path = require("path")
var mkdirp = _interopDefault(require("fs-mkdirp-stream/mkdirp"))
var os = require("os")
var watch = _interopDefault(require("glob-watcher"))

function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === "function"
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

  if (typeof stream.resume === "function") {
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

  return through.obj(normalize)
}

function wrapVinyl() {
  function wrapFile(globFile, enc, callback) {
    const file = new Vinyl(globFile)
    callback(null, file)
  }

  return through.obj(wrapFile)
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

  return through.obj(addSourcemap)
}

function readDir(file, optResolver, onRead) {
  onRead()
}

class Codec {
  constructor(codec, encoding) {
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
    return through(
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
    return through(
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

  return through.obj(readFile)
}

const APPEND_MODE_REGEXP = /a/

function closeFd(propagatedErr, fd, callback) {
  if (typeof fd !== "number") {
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
  if (typeof id !== "number") {
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

  if (typeof vinylMode === "number") {
    modeDiff = (vinylMode ^ fsMode) & MASK_MODE
  }

  return modeDiff
}

function getTimesDiff(fsStat, vinylStat) {
  const mtime = valueOrFunction.date(vinylStat.mtime) || 0

  if (!mtime) {
    return
  }

  let atime = valueOrFunction.date(vinylStat.atime) || 0

  if (+mtime === +fsStat.mtime && +atime === +fsStat.atime) {
    return
  }

  if (!atime) {
    atime = valueOrFunction.date(fsStat.atime) || undefined
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
  const hasGetuid = typeof process.getuid === "function"
  const hasGeteuid = typeof process.geteuid === "function"

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
    assign(file.stat, stat)

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
  if (typeof options === "function") {
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

class WriteStream extends readableStream.Writable {
  constructor(path, options, flush) {
    if (typeof options === "function") {
      flush = options
      options = null
    }

    options = options || {}
    super(options)
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
    const self = this
    fs.open(this.path, this.flags, this.mode, onOpen)

    function onOpen(openErr, fd) {
      if (openErr) {
        self.destroy()
        self.emit("error", openErr)
        return
      }

      self.fd = fd
      self.emit("open", fd)
    }
  }

  _destroy(err, cb) {
    this.close(err2 => {
      cb(err || err2)
    })
  }

  close(cb) {
    const that = this

    if (cb) {
      this.once("close", cb)
    }

    if (this.closed || typeof this.fd !== "number") {
      if (typeof this.fd !== "number") {
        this.once("open", closeOnOpen)
        return
      }

      return process.nextTick(() => {
        that.emit("close")
      })
    }

    this.closed = true
    fs.close(this.fd, er => {
      if (er) {
        that.emit("error", er)
      } else {
        that.emit("close")
      }
    })
    this.fd = null
  }

  _final(callback) {
    if (typeof this.flush !== "function") {
      return callback()
    }

    this.flush(this.fd, callback)
  }

  _write(data, encoding, callback) {
    const self = this

    if (!Buffer.isBuffer(data)) {
      return this.emit("error", new Error("Invalid data"))
    }

    if (typeof this.fd !== "number") {
      return this.once("open", onOpen)
    }

    fs.write(this.fd, data, 0, data.length, null, onWrite)

    function onOpen() {
      self._write(data, encoding, callback)
    }

    function onWrite(writeErr) {
      if (writeErr) {
        self.destroy()
        callback(writeErr)
        return
      }

      callback()
    }
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

  return through.obj(resolveFile)
}

function src(glob, opt) {
  const optResolver = createResolver(config, opt)

  if (!isValidGlob(glob)) {
    throw new Error(`Invalid glob argument: ${glob}`)
  }

  const streams = [
    gs(glob, opt),
    wrapVinyl(),
    resolveSymlinks(optResolver),
    prepareRead(optResolver),
    readContents(optResolver),
    sourcemapStream(optResolver),
  ]
  const outputStream = pumpify.obj(streams)
  return toThrough(outputStream)
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
    if (!Vinyl.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `dest()`"))
    }

    if (typeof file.isSymbolic !== "function") {
      file = new Vinyl(file)
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

  return through.obj(normalize)
}

function sourcemapStream$1(optResolver) {
  function saveSourcemap(file, enc, callback) {
    const self = this
    const srcMap = optResolver.resolve("sourcemaps", file)

    if (!srcMap) {
      return callback(null, file)
    }

    const srcMapLocation = typeof srcMap === "string" ? srcMap : undefined
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

  return through.obj(saveSourcemap)
}

function writeDir(file, optResolver, onWritten) {
  mkdirp(file.path, file.stat.mode, onMkdirp)

  function onMkdirp(mkdirpErr) {
    if (mkdirpErr) {
      return onWritten(mkdirpErr)
    }

    fs.open(file.path, "r", onOpen)
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
      if (typeof fd !== "number") {
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

  return through.obj(writeFile)
}

const folderConfig = {
  outFolder: {
    type: "string",
  },
}
function dest(outFolder, opt) {
  if (!outFolder) {
    throw new Error(
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

  const saveStream = pumpify.obj(
    prepareWrite(folderResolver, optResolver),
    sourcemapStream$1(optResolver),
    mkdirpStream.obj(dirpath),
    writeContents(optResolver)
  )
  return lead(saveStream)
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
    if (!Vinyl.isVinyl(file)) {
      return cb(new Error("Received a non-Vinyl object in `symlink()`"))
    }

    if (typeof file.isSymbolic !== "function") {
      file = new Vinyl(file)
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

  return through.obj(normalize)
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

  return through.obj(linkFile)
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
  return lead(stream)
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
