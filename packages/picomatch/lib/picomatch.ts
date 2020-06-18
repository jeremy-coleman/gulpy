import * as path from "path"
import _scan from "./scan"
import _parse from "./parse"
import * as utils from "./utils"
import { isString, isFunction } from "lodash"

const isObject = val => val && typeof val === "object" && !Array.isArray(val)

/**
 * Creates a matcher function from one or more glob patterns. The
 * returned function takes a string to match as its first argument,
 * and returns true if the string is a match. The returned matcher
 * function also takes a boolean as the second argument that, when true,
 * returns an object with additional information.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch(glob[, options]);
 *
 * const isMatch = picomatch('*.!(*a)');
 * console.log(isMatch('a.a')); //=> false
 * console.log(isMatch('a.b')); //=> true
 * ```
 * @name picomatch
 * @param {String|Array} `globs` One or more glob patterns.
 * @param {Object=} `options`
 * @return {Function=} Returns a matcher function.
 * @api public
 */

export const picomatch = (glob, options, returnState = false) => {
  if (Array.isArray(glob)) {
    const fns = glob.map(input => picomatch(input, options, returnState))
    const arrayMatcher = str => {
      for (const isMatch of fns) {
        const state = isMatch(str)
        if (state) return state
      }
      return false
    }
    return arrayMatcher
  }

  const isState = isObject(glob) && glob.tokens && glob.input

  if (glob === "" || (!isString(glob) && !isState)) {
    throw TypeError("Expected pattern to be a non-empty string")
  }

  const opts = options || {}
  const posix = utils.isWindows(options)
  const regex = isState ? compileRe(glob, options) : makeRe(glob, options, false, true)

  const state = regex.state
  delete regex.state

  let isIgnored = (...args) => false
  if (opts.ignore) {
    const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null }
    isIgnored = picomatch(opts.ignore, ignoreOpts, returnState)
  }

  const matcher = (input, returnObject = false): false => {
    const { isMatch, match, output } = test(input, regex, options, {
      glob,
      posix,
    })
    const result = { glob, state, regex, posix, input, output, match, isMatch }

    if (isFunction(opts.onResult)) {
      opts.onResult(result)
    }

    if (isMatch === false) {
      result.isMatch = false
      return returnObject ? result : false
    }

    if (isIgnored(input)) {
      if (isFunction(opts.onIgnore)) {
        opts.onIgnore(result)
      }
      result.isMatch = false
      return returnObject ? result : false
    }

    if (isFunction(opts.onMatch)) {
      opts.onMatch(result)
    }
    return returnObject ? result : true
  }

  if (returnState) {
    matcher.state = state
  }

  return matcher
}

/**
 * Test `input` with the given `regex`. This is used by the main
 * `picomatch()` function to test the input string.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.test(input, regex[, options]);
 *
 * console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
 * // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
 * ```
 * @param {String} `input` String to test.
 * @param {RegExp} `regex`
 * @return {Object} Returns an object with matching info.
 * @api public
 */

function test(input, regex, options, { glob, posix } = {}) {
  if (!isString(input)) {
    throw TypeError("Expected input to be a string")
  }

  if (input === "") {
    return { isMatch: false, output: "" }
  }

  const opts = options || {}
  const format = opts.format || (posix ? utils.toPosixSlashes : null)
  let match = input === glob
  let output = match && format ? format(input) : input

  if (match === false) {
    output = format ? format(input) : input
    match = output === glob
  }

  if (match === false || opts.capture === true) {
    if (opts.matchBase === true || opts.basename === true) {
      match = matchBase(input, regex, options, posix)
    } else {
      match = regex.exec(output)
    }
  }

  return { isMatch: Boolean(match), match, output }
}

/**
 * Match the basename of a filepath.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.matchBase(input, glob[, options]);
 * console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
 * ```
 * @param {String} `input` String to test.
 * @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
 * @return {Boolean}
 * @api public
 */

export function matchBase(input, glob, options, posix = utils.isWindows(options)) {
  const regex = glob instanceof RegExp ? glob : makeRe(glob, options)
  return regex.test(path.basename(input))
}

/**
 * Returns true if **any** of the given glob `patterns` match the specified `string`.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.isMatch(string, patterns[, options]);
 *
 * console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
 * console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
 * ```
 * @param {String|Array} str The string to test.
 * @param {String|Array} patterns One or more glob patterns to use for matching.
 * @param {Object} [options] See available [options](#options).
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */

export function isMatch(str, patterns, options) {
  return picomatch(patterns, options)(str)
}

/**
 * Parse a glob pattern to create the source string for a regular
 * expression.
 *
 * ```js
 * const picomatch = require('picomatch');
 * const result = picomatch.parse(pattern[, options]);
 * ```
 * @param {String} `pattern`
 * @param {Object} `options`
 * @return {Object} Returns an object with useful properties and output to be used as a regex source string.
 * @api public
 */

function parse(pattern, options) {
  if (Array.isArray(pattern)) return pattern.map(p => parse(p, options))
  return _parse(pattern, { ...options, fastpaths: false })
}

/**
 * Scan a glob pattern to separate the pattern into segments.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.scan(input[, options]);
 *
 * const result = picomatch.scan('!./foo/*.js');
 * console.log(result);
 * { prefix: '!./',
 *   input: '!./foo/*.js',
 *   start: 3,
 *   base: 'foo',
 *   glob: '*.js',
 *   isBrace: false,
 *   isBracket: false,
 *   isGlob: true,
 *   isExtglob: false,
 *   isGlobstar: false,
 *   negated: true }
 * ```
 * @param {String} `input` Glob pattern to scan.
 * @param {Object} `options`
 * @return {Object} Returns an object with
 * @api public
 */

export function scan(input, options) {
  return _scan(input, options)
}

/**
 * Create a regular expression from a parsed glob pattern.
 *
 * ```js
 * const picomatch = require('picomatch');
 * const state = picomatch.parse('*.js');
 * // picomatch.compileRe(state[, options]);
 *
 * console.log(picomatch.compileRe(state));
 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
 * ```
 * @param {String} `state` The object returned from the `.parse` method.
 * @param {Object} `options`
 * @return {RegExp} Returns a regex created from the given pattern.
 * @api public
 */

function compileRe(parsed, options, returnOutput = false, returnState = false) {
  if (returnOutput === true) {
    return parsed.output
  }

  const opts = options || {}
  const prepend = opts.contains ? "" : "^"
  const append = opts.contains ? "" : "$"

  let source = `${prepend}(?:${parsed.output})${append}`
  if (parsed && parsed.negated === true) {
    source = `^(?!${source}).*$`
  }

  const regex = toRegex(source, options)
  if (returnState === true) {
    regex.state = parsed
  }

  return regex
}

export function makeRe(input, options, returnOutput = false, returnState = false) {
  if (!input || !isString(input)) {
    throw TypeError("Expected a non-empty string")
  }

  const opts = options || {}
  let parsed = { negated: false, fastpaths: true }
  let prefix = ""
  let output

  if (input.startsWith("./")) {
    input = input.slice(2)
    prefix = parsed.prefix = "./"
  }

  if (opts.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
    output = _parse.fastpaths(input, options)
  }

  if (output === undefined) {
    parsed = _parse(input, options)
    parsed.prefix = prefix + (parsed.prefix || "")
  } else {
    parsed.output = output
  }

  return compileRe(parsed, options, returnOutput, returnState)
}

/**
 * Create a regular expression from the given regex source string.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.toRegex(source[, options]);
 *
 * const { output } = picomatch.parse('*.js');
 * console.log(picomatch.toRegex(output));
 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
 * ```
 * @param {String} `source` Regular expression source string.
 * @param {Object} `options`
 * @return {RegExp}
 * @api public
 */
function toRegex(source, options) {
  try {
    const opts = options || {}
    return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""))
  } catch (err) {
    if (options && options.debug === true) throw err
    return /$^/
  }
}

/**
 * Expose "picomatch"
 */

export default picomatch
