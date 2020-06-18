import normalize from "@local/value-or-function"

const slice = Array.prototype.slice

function createResolver(config = {}, options = {}) {
  const resolver = {
    resolve,
  }

  // Keep constants separately
  const constants = {}

  function resolveConstant(key) {
    if (constants.hasOwnProperty(key)) {
      return constants[key]
    }

    const definition = config[key]
    // Ignore options that are not defined
    if (!definition) {
      return
    }

    let option = options[key]

    if (option != null) {
      if (typeof option === "function") {
        return
      }
      option = normalize.call(resolver, definition.type, option)
      if (option != null) {
        constants[key] = option
        return option
      }
    }

    const fallback = definition.default
    if (option == null && typeof fallback !== "function") {
      constants[key] = fallback
      return fallback
    }
  }

  // Keep requested keys to detect (and disallow) recursive resolution
  const stack = []

  function resolve(key) {
    let option = resolveConstant(key)
    if (option != null) {
      return option
    }

    const definition = config[key]
    // Ignore options that are not defined
    if (!definition) {
      return
    }

    if (stack.includes(key)) {
      throw new Error("Recursive resolution denied.")
    }

    option = options[key]
    const fallback = definition.default
    const appliedArgs = slice.call(arguments, 1)
    const args = [definition.type, option].concat(appliedArgs)

    function toResolve() {
      stack.push(key)
      let option = normalize.apply(resolver, args)

      if (option == null) {
        option = fallback
        if (typeof option === "function") {
          option = option.apply(resolver, appliedArgs)
        }
      }

      return option
    }

    function onResolve() {
      stack.pop()
    }

    return tryResolve(toResolve, onResolve)
  }

  return resolver
}

function tryResolve(toResolve, onResolve) {
  try {
    return toResolve()
  } finally {
    onResolve()
  }
}

export default createResolver
