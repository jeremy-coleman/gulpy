import glob from "glob"
import { Readable } from "stream"
import globParent from "glob-parent"
import toAbsoluteGlob from "to-absolute-glob"
import removeTrailingSeparator from "remove-trailing-separator"
import { isString } from "lodash"

const globErrMessage1 = "File not found with singular glob: "
const globErrMessage2 = " (if this was purposeful, use `allowEmpty` option)"

function getBasePath(ourGlob, opt) {
  return globParent(toAbsoluteGlob(ourGlob, opt))
}

function globIsSingular({ minimatch }) {
  const globSet = minimatch.set
  if (globSet.length !== 1) {
    return false
  }

  return globSet[0].every(isString)
}

class GlobStream extends Readable {
  constructor(ourGlob, negatives, opt) {
    const ourOpt = Object.assign({}, opt)

    super({
      objectMode: true,
      highWaterMark: ourOpt.highWaterMark || 16,
    })

    // Delete `highWaterMark` after inheriting from Readable
    delete ourOpt.highWaterMark

    const self = this

    function resolveNegatives(negative) {
      return toAbsoluteGlob(negative, ourOpt)
    }

    const ourNegatives = negatives.map(resolveNegatives)
    ourOpt.ignore = ourNegatives

    const cwd = ourOpt.cwd
    const allowEmpty = ourOpt.allowEmpty || false

    // Extract base path from glob
    const basePath = ourOpt.base || getBasePath(ourGlob, ourOpt)

    // Remove path relativity to make globs make sense
    ourGlob = toAbsoluteGlob(ourGlob, ourOpt)
    // Delete `root` after all resolving done
    delete ourOpt.root

    const globber = new glob.Glob(ourGlob, ourOpt)
    this._globber = globber

    let found = false

    globber.on("match", filepath => {
      found = true
      const obj = {
        cwd,
        base: basePath,
        path: removeTrailingSeparator(filepath),
      }
      if (!self.push(obj)) {
        globber.pause()
      }
    })

    globber.once("end", () => {
      if (allowEmpty !== true && !found && globIsSingular(globber)) {
        const err = new Error(globErrMessage1 + ourGlob + globErrMessage2)

        return self.destroy(err)
      }

      self.push(null)
    })

    function onError(err) {
      self.destroy(err)
    }

    globber.once("error", onError)
  }

  _read() {
    this._globber.resume()
  }

  destroy(err) {
    const self = this

    this._globber.abort()

    process.nextTick(() => {
      if (err) {
        self.emit("error", err)
      }
      self.emit("close")
    })
  }
}

export default GlobStream
