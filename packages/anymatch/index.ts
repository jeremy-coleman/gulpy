import { picomatch } from "@local/picomatch"
import { normalize } from "path"
import { isFunction, isString, isBoolean } from "lodash"

/**
 * @typedef {(testString: string) => boolean} AnymatchFn
 * @typedef {string|RegExp|AnymatchFn} AnymatchPattern
 * @typedef {AnymatchPattern|AnymatchPattern[]} AnymatchMatcher
 */
const BANG = "!"
const DEFAULT_OPTIONS = { returnIndex: false }
const arrify = item => (Array.isArray(item) ? item : [item])

/**
 * @param {AnymatchPattern} matcher
 * @param {object} options
 * @returns {AnymatchFn}
 */
const createPattern = (matcher, options) => {
  if (isFunction(matcher)) {
    return matcher
  }
  if (isString(matcher)) {
    const glob = picomatch(matcher, options)
    return string => matcher === string || glob(string)
  }
  if (matcher instanceof RegExp) {
    return string => matcher.test(string)
  }
  return string => false
}

/**
 * @param {Array<Function>} patterns
 * @param {Array<Function>} negPatterns
 * @param {String|Array} args
 * @param {Boolean} returnIndex
 * @returns {boolean|number}
 */
const matchPatterns = (patterns, negPatterns, args, returnIndex) => {
  const isList = Array.isArray(args)
  const _path = isList ? args[0] : args
  if (!isList && !isString(_path)) {
    throw TypeError(
      `anymatch: second argument must be a string: got ${Object.prototype.toString.call(
        _path
      )}`
    )
  }
  const path = normalize(_path)

  for (const nglob of negPatterns) {
    if (nglob(path)) {
      return returnIndex ? -1 : false
    }
  }

  const applied = isList && [path].concat(args.slice(1))
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index]
    if (isList ? pattern(...applied) : pattern(path)) {
      return returnIndex ? index : true
    }
  }

  return returnIndex ? -1 : false
}

/**
 * @param {AnymatchMatcher} matchers
 * @param {Array|string} testString
 * @param {object} options
 * @returns {boolean|number|Function}
 */
const anymatch = (matchers, testString, options = DEFAULT_OPTIONS) => {
  if (matchers == null) {
    throw TypeError("anymatch: specify first argument")
  }
  const opts = isBoolean(options) ? { returnIndex: options } : options
  const returnIndex = opts.returnIndex || false

  // Early cache for matchers.
  const mtchers = arrify(matchers)
  const negatedGlobs = mtchers
    .filter(item => isString(item) && item.charAt(0) === BANG)
    .map(item => item.slice(1))
    .map(item => picomatch(item, opts))
  const patterns = mtchers.map(matcher => createPattern(matcher, opts))

  if (testString == null) {
    return (testString, ri = false) => {
      const returnIndex = isBoolean(ri) ? ri : false
      return matchPatterns(patterns, negatedGlobs, testString, returnIndex)
    }
  }

  return matchPatterns(patterns, negatedGlobs, testString, returnIndex)
}

export default anymatch
