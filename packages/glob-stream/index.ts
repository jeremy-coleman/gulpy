import Combine from "ordered-read-streams"
import unique from "unique-stream"
import * as pumpify from "pumpify"
import isNegatedGlob from "is-negated-glob"
import GlobStream from "./readable"
import { isString, isBoolean, isFunction } from "lodash"
import type * as glob from "glob"

export interface Entry {
  cwd: string
  base: string
  path: string
}

export type UniqueByStringPredicate = "cwd" | "base" | "path"
export type UniqueByFunctionPredicate = (entry: Entry) => string

export interface Options extends glob.IOptions {
  /**
   * Whether or not to error upon an empty singular glob.
   */
  allowEmpty?: boolean
  /**
   * The absolute segment of the glob path that isn't a glob. This value is attached
   * to each globObject and is useful for relative pathing.
   */
  base?: string
  /**
   * Whether or not the `cwd` and `base` should be the same.
   */
  cwdbase?: boolean
  /**
   * Filters stream to remove duplicates based on the string property name or the result of function.
   * When using a function, the function receives the streamed
   * data (objects containing `cwd`, `base`, `path` properties) to compare against.
   */
  uniqueBy?: UniqueByStringPredicate | UniqueByFunctionPredicate
}

// Type definitions for glob-stream v6.1.0
// Project: https://github.com/wearefractal/glob-stream
// Definitions by: Bart van der Schoor <https://github.com/Bartvds>
//                 mrmlnc <https://github.com/mrmlnc>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

function globStream(globs: string | string[], opt?: Options) {
  if (!opt) {
    opt = {}
  }

  const ourOpt = Object.assign({}, opt)
  let ignore = ourOpt.ignore

  ourOpt.cwd = isString(ourOpt.cwd) ? ourOpt.cwd : process.cwd()
  ourOpt.dot = isBoolean(ourOpt.dot) ? ourOpt.dot : false
  ourOpt.silent = isBoolean(ourOpt.silent) ? ourOpt.silent : true
  ourOpt.cwdbase = isBoolean(ourOpt.cwdbase) ? ourOpt.cwdbase : false
  ourOpt.uniqueBy =
    isString(ourOpt.uniqueBy) || isFunction(ourOpt.uniqueBy) ? ourOpt.uniqueBy : "path"

  if (ourOpt.cwdbase) {
    ourOpt.base = ourOpt.cwd
  }
  // Normalize string `ignore` to array
  if (isString(ignore)) {
    ignore = [ignore]
  }
  // Ensure `ignore` is an array
  if (!Array.isArray(ignore)) {
    ignore = []
  }

  // Only one glob no need to aggregate
  if (!Array.isArray(globs)) {
    globs = [globs]
  }

  const positives = []
  const negatives = []

  globs.forEach(sortGlobs)

  function sortGlobs(globString, index) {
    if (!isString(globString)) {
      throw new Error(`Invalid glob at index ${index}`)
    }

    const glob = isNegatedGlob(globString)
    const globArray = glob.negated ? negatives : positives

    globArray.push({
      index,
      glob: glob.pattern,
    })
  }

  if (positives.length === 0) {
    throw new Error("Missing positive glob")
  }

  // Create all individual streams
  const streams = positives.map(streamFromPositive)

  // Then just pipe them to a single unique stream and return it
  const aggregate = new Combine(streams)
  const uniqueStream = unique(ourOpt.uniqueBy)

  return pumpify.obj(aggregate, uniqueStream)

  function streamFromPositive({ index, glob }) {
    const negativeGlobs = negatives
      .filter(indexGreaterThan(index))
      .map(toGlob)
      .concat(ignore)
    return new GlobStream(glob, negativeGlobs, ourOpt)
  }
}

function indexGreaterThan(index: number) {
  return obj => obj.index > index
}

function toGlob({ glob }) {
  return glob
}

export default globStream
