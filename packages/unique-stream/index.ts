import { obj as filter } from "through2-filter"
import { isString, isFunction } from "lodash"

export default unique

export function unique(by?: string | Function, keyStore = new Set()) {
  const keyfn = isString(by) ? data => data[by] : isFunction(by) ? by : JSON.stringify

  return filter(data => {
    const key = keyfn(data)

    if (keyStore.has(key)) {
      return false
    }

    keyStore.add(key)
    return true
  })
}
