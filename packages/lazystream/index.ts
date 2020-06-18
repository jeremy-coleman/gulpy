import { PassThrough } from "stream"

// Patch the given method of instance so that the callback
// is executed once, before the actual method is called the
// first time.
function beforeFirstCall(instance, method, callback) {
  instance[method] = function (...args) {
    delete instance[method]
    callback.apply(this, args)
    return this[method].apply(this, args)
  }
}

export class Readable extends PassThrough {
  constructor(fn, options?) {
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

export class Writable extends PassThrough {
  constructor(fn, options) {
    super(options)

    beforeFirstCall(this, "_write", function () {
      const destination = fn.call(this, options)
      const emit = this.emit.bind(this, "error")
      destination.on("error", emit)
      this.pipe(destination)
    })

    this.emit("writable")
  }
}
