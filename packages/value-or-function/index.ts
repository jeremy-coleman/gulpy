// Built-in types
const types = [
  "object",
  "number",
  "string",
  "symbol",
  "boolean",
  "date",
  "function", // Weird to expose this
]

export function normalize(coercer, value) {
  if (typeof value === "function") {
    if (coercer === "function") {
      return value
    }
    value = value.apply(this, slice(arguments, 2))
  }
  return coerce(this, coercer, value)
}

function coerce(ctx, coercer, value) {
  // Handle built-in types
  if (typeof coercer === "string") {
    if (coerce[coercer]) {
      return coerce[coercer].call(ctx, value)
    }
    return typeOf(coercer, value)
  }

  // Handle custom coercer
  if (typeof coercer === "function") {
    return coercer.call(ctx, value)
  }

  // Array of coercers, try in order until one returns a non-null value
  let result
  coercer.some(coercer => {
    result = coerce(ctx, coercer, value)
    return result != null
  })

  return result
}

coerce.string = value => {
  if (
    value != null &&
    typeof value === "object" &&
    typeof value.toString === "function"
  ) {
    value = value.toString()
  }
  return typeOf("string", primitive(value))
}

coerce.number = value => typeOf("number", primitive(value))

coerce.boolean = value => typeOf("boolean", primitive(value))

coerce.date = value => {
  value = primitive(value)
  if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
    return new Date(value)
  }
}

function typeOf(type, value) {
  if (typeof value === type) {
    return value
  }
}

function primitive(value) {
  if (value != null && typeof value === "object" && typeof value.valueOf === "function") {
    value = value.valueOf()
  }
  return value
}

function slice(value, from) {
  return Array.prototype.slice.call(value, from)
}

// Add methods for each type
types.forEach(type => {
  // Make it an array for easier concat
  const typeArg = [type]

  normalize[type] = function () {
    const args = slice(arguments)
    return normalize.apply(this, typeArg.concat(args))
  }
})

export default normalize
