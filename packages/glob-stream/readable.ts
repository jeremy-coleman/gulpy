import { Glob, IGlob } from "glob"
import { Readable } from "stream"
import { globParent } from "@local/glob-parent"
import { removeTrailingSeparator } from "@local/shared"
import toAbsoluteGlob from "@local/to-absolute-glob"
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
  #glob: IGlob

  constructor(ourGlob: string, negatives, opt) {
    super({
      objectMode: true,
      highWaterMark: opt.highWaterMark || 16,
    })

    const ourOpt = { ...opt }

    // Delete `highWaterMark` after inheriting from Readable
    delete ourOpt.highWaterMark

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

    const glob = new Glob(ourGlob, ourOpt)
    this.#glob = glob

    let found = false

    glob.on("match", filepath => {
      found = true
      const obj = {
        cwd,
        base: basePath,
        path: removeTrailingSeparator(filepath),
      }
      if (!this.push(obj)) {
        glob.pause()
      }
    })

    glob.once("end", () => {
      if (allowEmpty !== true && !found && globIsSingular(glob)) {
        const err = new Error(globErrMessage1 + ourGlob + globErrMessage2)

        return this.destroy(err)
      }

      this.push(null)
    })

    const onError = err => {
      this.destroy(err)
    }

    glob.once("error", onError)
  }

  _read() {
    this.#glob.resume()
  }

  destroy(err) {
    const self = this

    this.#glob.abort()

    process.nextTick(() => {
      if (err) {
        self.emit("error", err)
      }
      self.emit("close")
    })
  }
}

export default GlobStream
