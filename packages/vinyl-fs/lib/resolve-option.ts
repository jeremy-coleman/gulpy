import { isFunction } from "lodash"

export function resolveOption<T, A>(provider: T | ((value: A) => T), arg: A): T {
  return isFunction(provider) ? provider(arg) : provider
}
