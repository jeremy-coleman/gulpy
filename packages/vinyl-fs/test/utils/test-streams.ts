import { expect } from "chai"

import from from "from2"
import through from "through2"
import to from "flush-write-stream"

function string(length) {
  return from((size, next) => {
    if (length <= 0) {
      next(null, null)
      return
    }

    const chunkSize = size <= length ? size : length

    length -= size

    let chunk = ""
    for (let x = 0; x < chunkSize; x++) {
      chunk += "a"
    }

    next(null, chunk)
  })
}

function rename(filepath) {
  return through.obj((file, enc, cb) => {
    file.path = filepath
    cb(null, file)
  })
}

function includes(obj) {
  return through.obj((file, enc, cb) => {
    expect(file).toInclude(obj)
    cb(null, file)
  })
}

function count(value) {
  let count = 0
  return through.obj(
    (file, enc, cb) => {
      count++
      cb(null, file)
    },
    cb => {
      expect(count).toEqual(value)
      cb()
    }
  )
}

function slowCount(value) {
  let count = 0
  return to.obj(
    (file, enc, cb) => {
      count++

      setTimeout(() => {
        cb(null, file)
      }, 250)
    },
    cb => {
      expect(count).toEqual(value)
      cb()
    }
  )
}

export default {
  string,
  rename,
  includes,
  count,
  slowCount,
}
