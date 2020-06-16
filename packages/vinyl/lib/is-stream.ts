import { isFunction } from "lodash-es"

export function isStream(stream) {
  if (!stream) {
    return false
  }

  if (!isFunction(stream.pipe)) {
    return false
  }

  return true
}

export default isStream
