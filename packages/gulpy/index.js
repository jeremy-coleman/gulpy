"use strict"

function _interopDefault(ex) {
  return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex
}

var assert = require("assert")
var events = require("events")
var lodash = require("lodash")
var domain = _interopDefault(require("domain"))
var eos = _interopDefault(require("end-of-stream"))
var p = _interopDefault(require("process-nextick-args"))
var exhaust = _interopDefault(require("stream-exhaust"))
var vfs = _interopDefault(require("vinyl-fs"))
var watch = _interopDefault(require("glob-watcher"))

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

    if (result && typeof result.on === "function") {
      d.add(result)
      eos(exhaust(result), eosConfig, done)
      return
    }

    if (result && typeof result.subscribe === "function") {
      result.subscribe(onNext, onError, onCompleted)
      return
    }

    if (result && typeof result.then === "function") {
      result.then(onSuccess, onError)
      return
    }
  }

  p.nextTick(asyncRunner)
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
  if (typeof extensions === "function") {
    done = extensions
    extensions = {}
  }

  if (typeof done !== "function") {
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
  if (typeof extensions === "function") {
    done = extensions
    extensions = {}
  }

  if (typeof done !== "function") {
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
    const name = "<series>"
    metadata.set(fn, {
      name,
      branch: true,
      tree: {
        label: name,
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
    const name = "<parallel>"
    metadata.set(fn, {
      name,
      branch: true,
      tree: {
        label: name,
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
    this.src = vfs.src.bind(this)
    this.dest = vfs.dest.bind(this)
    this.symlink = vfs.symlink.bind(this)
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
