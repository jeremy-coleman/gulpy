import { noop } from "lodash-es"

const defaultExts = {
  create: noop,
  before: noop,
  after: noop,
  error: noop,
}

export function defaultExtensions(extensions: Partial<typeof defaultExts> = {}) {
  return {
    create: extensions.create || defaultExts.create,
    before: extensions.before || defaultExts.before,
    after: extensions.after || defaultExts.after,
    error: extensions.error || defaultExts.error,
  }
}

export function initializeResults(values) {
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
