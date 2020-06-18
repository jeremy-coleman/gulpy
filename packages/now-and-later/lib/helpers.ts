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
