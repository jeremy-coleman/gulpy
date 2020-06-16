import { isString } from "lodash"

const runtimes = new WeakMap()

export function lastRun(fn: (...args: any[]) => void, timeResolution?: number | string) {
  const time = runtimes.get(fn)
  if (time == null) return
  const resolution = defaultResolution(timeResolution)
  return time - (time % resolution)
}

export function capture(fn: (...args: any[]) => void, timestamp = Date.now()) {
  runtimes.set(fn, timestamp)
}

export function release(fn: (...args: any[]) => void) {
  runtimes.delete(fn)
}

export function defaultResolution(customResolution?: number | string): number {
  return (
    (isString(customResolution) ? parseInt(customResolution, 10) : customResolution) || 1
  )
}
