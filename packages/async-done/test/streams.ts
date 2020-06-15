import expect from "expect"
import fs from "fs"
import path from "path"
import through from "through2"
import pumpify from "pumpify"
import { asyncDone } from "../"

const exists = path.join(__dirname, "../.gitignore")
const notExists = path.join(__dirname, "../not_exists")

const EndStream = through.ctor(
  function (chunk, enc, cb) {
    this.push(chunk)
    cb()
  },
  function (cb) {
    this.emit("end", 2)
    cb()
  }
)

function success() {
  const read = fs.createReadStream(exists)
  return read.pipe(new EndStream())
}

function failure() {
  const read = fs.createReadStream(notExists)
  return read.pipe(new EndStream())
}

function withErr(chunk, _, cb) {
  cb(new Error("Fail"))
}

function pumpifyError() {
  const read = fs.createReadStream(exists)
  const pipeline = pumpify(through(), through(withErr), through())

  return read.pipe(pipeline)
}

function unpiped() {
  return fs.createReadStream(exists)
}

describe("streams", () => {
  it("should handle a successful stream", done => {
    asyncDone(success, err => {
      expect(err).toNotBeAn(Error)
      done()
    })
  })

  it("should handle an errored stream", done => {
    asyncDone(failure, err => {
      expect(err).toBeAn(Error)
      done()
    })
  })

  it("should handle an errored pipeline", done => {
    asyncDone(pumpifyError, err => {
      expect(err).toBeAn(Error)
      expect(err.message).toNotBe("premature close")
      done()
    })
  })

  it("handle a returned stream and cb by only calling callback once", done => {
    asyncDone(
      cb =>
        success().on("end", () => {
          cb(null, 3)
        }),
      (err, result) => {
        expect(err).toNotBeAn(Error)
        expect(result).toEqual(3) // To know we called the callback
        done()
      }
    )
  })

  it("consumes an unpiped readable stream", done => {
    asyncDone(unpiped, err => {
      expect(err).toNotBeAn(Error)
      done()
    })
  })
})
