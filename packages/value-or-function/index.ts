import { isFunction, isString, isNumber } from "lodash"

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
  if (isFunction(value)) {
    if (coercer === "function") {
      return value
    }
    value = value.apply(this, slice(arguments, 2))
  }
  return coerce(this, coercer, value)
}

function coerce(ctx, coercer, value) {
  // Handle built-in types
  if (isString(coercer)) {
    if (coerce[coercer]) {
      return coerce[coercer].call(ctx, value)
    }
    return typeOf(coercer, value)
  }

  // Handle custom coercer
  if (isFunction(coercer)) {
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
  if (isFunction(value?.toString)) {
    value = value.toString()
  }
  return typeOf("string", primitive(value))
}

coerce.number = value => typeOf("number", primitive(value))

coerce.boolean = value => typeOf("boolean", primitive(value))

coerce.date = value => {
  value = primitive(value)
  if (isNumber(value) && !isNaN(value) && isFinite(value)) {
    return new Date(value)
  }
}

function typeOf(type, value) {
  if (typeof value === type) {
    return value
  }
}

function primitive(value) {
  if (isFunction(value?.valueOf)) {
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

  normalize[type] = function (...args) {
    return normalize.apply(this, typeArg.concat(args))
  }
})

export default normalize
