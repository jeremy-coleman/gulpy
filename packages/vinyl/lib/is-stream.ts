import { isFunction } from "lodash"

export function isStream(stream) {
  if (!stream) {
    return false
  }

  if (!isFunction(stream.pipe)) {
    return false
  }

  return true
}
