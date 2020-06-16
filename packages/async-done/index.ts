import * as domain from "domain"
import eos from "end-of-stream"
import { once, isFunction } from "lodash"
import exhaust from "stream-exhaust"

import type { ChildProcess } from "child_process"
import type { EventEmitter } from "events"
import type { Stream } from "stream"

/**
 * Represents a callback function used to signal the completion of a
 * task without any result value.
 */
export type VoidCallback = (err: Error | null) => void

/**
 * Represents a callback function used to signal the completion of a
 * task with a single result value.
 */
export interface Callback<T> {
  (err: null, result: T): void

  // Use `result?: T` or `result: undefined` to require the consumer to assert the existence of the result
  // (even in case of success). See comment at the top of the file.
  (err: Error, result?: any): void
}

/**
 * Minimal `Observable` interface compatible with `async-done`.
 *
 * @see https://github.com/ReactiveX/rxjs/blob/c3c56867eaf93f302ac7cd588034c7d8712f2834/src/internal/Observable.ts#L77
 */
interface Observable<T = any> {
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): any
}

/**
 * Represents an async operation.
 */
export type AsyncTask<R = any> =
  | ((done: VoidCallback) => void)
  | ((done: Callback<R>) => void)
  | (() => ChildProcess | EventEmitter | Observable<R> | PromiseLike<R> | Stream)

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

/**
 * Takes a function to execute (`fn`) and a function to call on completion (`callback`).
 *
 * @param fn Function to execute.
 * @param callback Function to call on completion.
 */
export function asyncDone<R = any>(fn: AsyncTask<R>, cb: Callback<R>): void {
  cb = once(cb)

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
    const result = domainBoundFn(done) as any

    function onNext(state) {
      onNext.state = state
    }
    onNext.state = null

    function onCompleted() {
      onSuccess(onNext.state)
    }

    if (result && isFunction(result.on)) {
      // Assume node stream
      d.add(result)
      eos(exhaust(result), eosConfig, done)
      return
    }

    if (result && isFunction(result.subscribe)) {
      // Assume RxJS observable
      result.subscribe(onNext, onError, onCompleted)
      return
    }

    if (result && isFunction(result.then)) {
      // Assume promise
      result.then(onSuccess, onError)
      return
    }
  }

  process.nextTick(asyncRunner)
}
