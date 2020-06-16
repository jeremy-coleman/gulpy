import Combine from "ordered-read-streams"
import unique from "unique-stream"
import pumpify from "pumpify"
import isNegatedGlob from "is-negated-glob"
import GlobStream from "./readable"

function globStream(globs, opt) {
  if (!opt) {
    opt = {}
  }

  const ourOpt = Object.assign({}, opt)
  let ignore = ourOpt.ignore

  ourOpt.cwd = typeof ourOpt.cwd === "string" ? ourOpt.cwd : process.cwd()
  ourOpt.dot = typeof ourOpt.dot === "boolean" ? ourOpt.dot : false
  ourOpt.silent = typeof ourOpt.silent === "boolean" ? ourOpt.silent : true
  ourOpt.cwdbase = typeof ourOpt.cwdbase === "boolean" ? ourOpt.cwdbase : false
  ourOpt.uniqueBy =
    typeof ourOpt.uniqueBy === "string" || typeof ourOpt.uniqueBy === "function"
      ? ourOpt.uniqueBy
      : "path"

  if (ourOpt.cwdbase) {
    ourOpt.base = ourOpt.cwd
  }
  // Normalize string `ignore` to array
  if (typeof ignore === "string") {
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
    if (typeof globString !== "string") {
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

function indexGreaterThan(index) {
  return obj => obj.index > index
}

function toGlob({ glob }) {
  return glob
}

export default globStream
