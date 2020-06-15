import { noop, isFunction } from "lodash-es"
import { ok as assert } from "assert"

export function getExtensions(lastArg) {
  if (!isFunction(lastArg)) {
    return lastArg
  }
}

function filterSuccess({ state }) {
  return state === "success"
}

function filterError({ state }) {
  return state === "error"
}

export function onSettled(done?) {
  if (!isFunction(done)) {
    done = noop
  }

  function onSettled(error, result?) {
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

export function verifyArguments(args: any[]) {
  args = args.flat(Infinity)
  const lastIdx = args.length - 1

  assert(args.length, "A set of functions to combine is required")

  args.forEach((arg, argIdx) => {
    const _isFunction = isFunction(arg)
    if (_isFunction) {
      return
    }

    if (argIdx === lastIdx) {
      // Last arg can be an object of extension points
      return
    }

    const msg = `Only functions can be combined, got ${typeof arg} for argument ${argIdx}`
    assert(_isFunction, msg)
  })

  return args
}
