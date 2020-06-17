import * as through2 from "through2"
import type { DuplexOptions } from "stream"
import type { Through2Constructor, TransformFunction } from "through2"

interface Options extends DuplexOptions {
  wantStrings?: boolean
}
interface Predicate<T = any> {
  (value: T, index: number): boolean
}

export function ctor(fn: Predicate, options?: Options) {
  interface Filter extends Through2Constructor {
    _index: number
  }

  const Filter = through2.ctor<Filter>(options, function (chunk, _encoding, callback) {
    if (options?.wantStrings) chunk = chunk.toString()
    try {
      if (fn.call(this, chunk, this._index++)) this.push(chunk)
      return callback()
    } catch (e) {
      return callback(e)
    }
  } as TransformFunction<Filter>)

  Filter.prototype._index = 0
  return Filter
}

export function objCtor(fn: Predicate, options?: Options) {
  return ctor(fn, { objectMode: true, highWaterMark: 16, ...options })
}

export function make(fn: Predicate, options?: Options) {
  return ctor(fn, options)()
}

export function obj(fn: Predicate, options?: Options) {
  return make(fn, { objectMode: true, highWaterMark: 16, ...options })
}
