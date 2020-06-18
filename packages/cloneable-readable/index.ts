import { PassThrough } from "stream"

export class Cloneable extends PassThrough {
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

    // the events added by the clone should not count
    // for starting the flow
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

class Clone extends PassThrough {
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

    // the events added by the clone should not count
    // for starting the flow
    // so we add the newListener handle after we are done
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
  // We start the flow once all clones are piped or destroyed
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

export default Cloneable
