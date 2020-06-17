import { inherits } from "util"
import { Transform, DuplexOptions } from "stream"
import { isFunction } from "lodash"

// Type definitions for through2 v 2.0
// Project: https://github.com/rvagg/through2
// Definitions by: Bart van der Schoor <https://github.com/Bartvds>,
//                 jedmao <https://github.com/jedmao>,
//                 Georgios Valotasios <https://github.com/valotas>,
//                 Ben Chauvette < https://github.com/bdchauvette>,
//                 TeamworkGuy2 <https://github.com/TeamworkGuy2>,
//                 Alorel <https://github.com/Alorel>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
class DestroyableTransform extends Transform {
  private _destroyed = false

  destroy(err?: Error) {
    if (this._destroyed) return
    this._destroyed = true

    process.nextTick(() => {
      if (err) this.emit("error", err)
      this.emit("close")
    })
  }
}

// a noop _transform function
const noop: TransformFunction = (chunk, _enc, callback) => {
  callback(null, chunk)
}

type TransformCallback = (err?: any, data?: any) => void
export type TransformFunction<T extends Transform = Transform> = (
  this: T,
  chunk: any,
  enc: BufferEncoding,
  callback: TransformCallback
) => void
type FlushCallback = (this: Transform, flushCallback: () => void) => void

// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
function through2<T extends Transform>(
  construct: (
    options: DuplexOptions | undefined,
    transform: TransformFunction,
    flush?: FlushCallback
  ) => T
) {
  const fn: {
    <T1 extends Transform = T>(
      transform?: TransformFunction<T1>,
      flush?: FlushCallback
    ): T1
    <T1 extends Transform = T>(
      opts?: DuplexOptions,
      transform?: TransformFunction<T1>,
      flush?: FlushCallback
    ): T1
  } = (
    options?: TransformFunction | DuplexOptions,
    transform?: FlushCallback | TransformFunction,
    flush?: FlushCallback
  ) => {
    if (isFunction(options)) {
      flush = transform as FlushCallback
      transform = options
      options = {}
    }
    if (!isFunction(transform)) transform = noop
    if (!isFunction(flush)) flush = undefined

    return construct(options, transform, flush)
  }
  return fn
}

// main export, just make me a transform stream!
export const main = through2<Transform>((options, transform, flush) => {
  const t2 = new DestroyableTransform(options)
  t2._transform = transform
  if (flush) t2._flush = flush
  return t2
})

export default main

export interface Through2Constructor extends Transform {
  new (opts?: DuplexOptions): Transform
  (opts?: DuplexOptions): Transform
  options: DuplexOptions
}

// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
export const ctor = through2<Through2Constructor>((options, transform, flush) => {
  function Through2(override?: DuplexOptions) {
    if (!(this instanceof Through2)) {
      return new (Through2 as any)(override)
    }
    this.options = { ...options, ...override }
    Transform.call(this, this.options)
  }

  inherits(Through2, DestroyableTransform)

  Through2.prototype._transform = transform

  if (flush) Through2.prototype._flush = flush
  return Through2 as Through2Constructor
})

export const obj = through2<Transform>((options, transform, flush) => {
  const t2 = new DestroyableTransform({ objectMode: true, highWaterMark: 16, ...options })
  t2._transform = transform
  if (flush) t2._flush = flush
  return t2
})
