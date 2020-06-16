import { once, noop, isFunction } from "lodash"
import * as helpers from "./helpers"

export function map(values, iterator, extensions?, done?) {
  // Allow for extensions to not be specified
  if (isFunction(extensions)) {
    done = extensions
    extensions = {}
  }

  // Handle no callback case
  if (!isFunction(done)) {
    done = noop
  }

  done = once(done)

  // Will throw if non-object
  const keys = Object.keys(values)
  const length = keys.length
  let count = length
  let idx = 0
  // Return the same type as passed in
  const results = helpers.initializeResults(values)

  const exts = helpers.defaultExtensions(extensions)

  if (length === 0) {
    return done(null, results)
  }

  for (idx = 0; idx < length; idx++) {
    const key = keys[idx]
    next(key)
  }

  function next(key) {
    const value = values[key]

    const storage = (exts.create(value, key) as any) || {}

    exts.before(storage)
    iterator(value, key, once(handler))

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
