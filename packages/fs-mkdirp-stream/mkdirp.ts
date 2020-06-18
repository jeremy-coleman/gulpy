import * as path from "path"
import * as fs from "fs"
import { isFunction, isString } from "lodash"

const MASK_MODE = parseInt("7777", 8)

export function mkdirp(dirpath, mode, callback) {
  if (isFunction(mode)) {
    callback = mode
    mode = undefined
  }

  if (isString(mode)) {
    mode = parseInt(mode, 8)
  }

  dirpath = path.resolve(dirpath)

  fs.mkdir(dirpath, mode, onMkdir)

  function onMkdir(mkdirErr) {
    if (!mkdirErr) {
      return fs.stat(dirpath, onStat)
    }

    switch (mkdirErr.code) {
      case "ENOENT": {
        return mkdirp(path.dirname(dirpath), onRecurse)
      }

      case "EEXIST": {
        return fs.stat(dirpath, onStat)
      }

      default: {
        return callback(mkdirErr)
      }
    }

    function onStat(statErr, stats) {
      if (statErr) {
        return callback(statErr)
      }

      if (!stats.isDirectory()) {
        return callback(mkdirErr)
      }

      if (!mode) {
        return callback()
      }

      if ((stats.mode & MASK_MODE) === mode) {
        return callback()
      }

      fs.chmod(dirpath, mode, callback)
    }
  }

  function onRecurse(recurseErr) {
    if (recurseErr) {
      return callback(recurseErr)
    }

    mkdirp(dirpath, mode, callback)
  }
}

export default mkdirp
