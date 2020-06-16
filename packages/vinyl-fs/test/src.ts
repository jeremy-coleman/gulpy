import * as path from "path"
import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump"
import through from "through2"

const inputBase = testConstants.inputBase
const inputPath = testConstants.inputPath
const inputDirpath = testConstants.inputDirpath
const bomInputPath = testConstants.bomInputPath
const beBomInputPath = testConstants.beBomInputPath
const leBomInputPath = testConstants.leBomInputPath
const beNotBomInputPath = testConstants.beNotBomInputPath
const leNotBomInputPath = testConstants.leNotBomInputPath
const ranBomInputPath = testConstants.ranBomInputPath
const encodedInputPath = testConstants.encodedInputPath
const encodedContents = testConstants.encodedContents
const bomContents = testConstants.bomContents
const contents = testConstants.contents

describe(".src()", () => {
  it("throws on invalid glob (empty)", done => {
    let stream
    try {
      stream = vfs.src()
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      done()
    }
  })

  it("throws on invalid glob (empty string)", done => {
    let stream
    try {
      stream = vfs.src("")
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      done()
    }
  })

  it("throws on invalid glob (number)", done => {
    let stream
    try {
      stream = vfs.src(123)
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      done()
    }
  })

  it("throws on invalid glob (nested array)", done => {
    let stream
    try {
      stream = vfs.src([["./fixtures/*.coffee"]])
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      expect(err.message).toInclude("Invalid glob argument")
      done()
    }
  })

  it("throws on invalid glob (empty string in array)", done => {
    let stream
    try {
      stream = vfs.src([""])
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      done()
    }
  })

  it("throws on invalid glob (empty array)", done => {
    let stream
    try {
      stream = vfs.src([])
    } catch (err) {
      expect(err).to.exist
      expect(stream).to.not.exist
      done()
    }
  })

  it("emits an error on file not existing", done => {
    function assert(err) {
      expect(err).to.exist
      done()
    }

    pipe([vfs.src("./fixtures/noexist.coffee"), concat()], assert)
  })

  it("passes through writes", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: new Buffer(contents),
      stat: fs.statSync(inputPath),
    })

    const srcStream = vfs.src(inputPath)

    function assert(files) {
      expect(files.length).to.equal(2)
      expect(files[0]).toEqual(file)
    }

    srcStream.write(file)

    pipe([srcStream, concat(assert)], done)
  })

  it("removes BOM from utf8-encoded files by default (buffer)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "8"))

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(bomInputPath), concat(assert)], done)
  })

  it("removes BOM from utf8-encoded files by default (stream)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "8"))

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(bomInputPath, { buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove BOM from utf8-encoded files if option is false (buffer)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "8")}`)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(bomInputPath, { removeBOM: false }), concat(assert)], done)
  })

  it("does not remove BOM from utf8-encoded files if option is false (stream)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "8")}`)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(bomInputPath, { removeBOM: false, buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("removes BOM from utf16be-encoded files by default (buffer)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "16-BE"))

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(beBomInputPath, { encoding: "utf16be" }), concat(assert)], done)
  })

  it("removes BOM from utf16be-encoded files by default (stream)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "16-BE"))

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(beBomInputPath, { encoding: "utf16be", buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove BOM from utf16be-encoded files if option is false (buffer)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "16-BE")}`)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe(
      [
        vfs.src(beBomInputPath, { encoding: "utf16be", removeBOM: false }),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove BOM from utf16be-encoded files if option is false (stream)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "16-BE")}`)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(beBomInputPath, { encoding: "utf16be", removeBOM: false, buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("removes BOM from utf16le-encoded files by default (buffer)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "16-LE"))

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(leBomInputPath, { encoding: "utf16le" }), concat(assert)], done)
  })

  it("removes BOM from utf16le-encoded files by default (stream)", done => {
    const expectedContent = new Buffer(bomContents.replace("X", "16-LE"))

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(leBomInputPath, { encoding: "utf16le", buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove BOM from utf16le-encoded files if option is false (buffer)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "16-LE")}`)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe(
      [
        vfs.src(leBomInputPath, { encoding: "utf16le", removeBOM: false }),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove BOM from utf16le-encoded files if option is false (stream)", done => {
    const expectedContent = new Buffer(`\ufeff${bomContents.replace("X", "16-LE")}`)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(leBomInputPath, { encoding: "utf16le", removeBOM: false, buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  // This goes for any non-UTF-8 encoding.
  // UTF-16-BE is enough to demonstrate this is done properly.
  it("does not remove anything that looks like a utf8-encoded BOM from utf16be-encoded files (buffer)", done => {
    const expectedContent = fs.readFileSync(beNotBomInputPath)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(beNotBomInputPath), concat(assert)], done)
  })

  it("does not remove anything that looks like a utf8-encoded BOM from utf16be-encoded files (stream)", done => {
    const expectedContent = fs.readFileSync(beNotBomInputPath)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(beNotBomInputPath, { buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  // This goes for any non-UTF-8 encoding.
  // UTF-16-LE is enough to demonstrate this is done properly.
  it("does not remove anything that looks like a utf8-encoded BOM from utf16le-encoded files (buffer)", done => {
    const expectedContent = fs.readFileSync(leNotBomInputPath)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContent)
    }

    pipe([vfs.src(leNotBomInputPath), concat(assert)], done)
  })

  it("does not remove anything that looks like a utf8-encoded BOM from utf16le-encoded files (stream)", done => {
    const expectedContent = fs.readFileSync(leNotBomInputPath)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(leNotBomInputPath, { buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("does not do any transcoding with encoding option set to false (buffer)", done => {
    const expectedContents = fs.readFileSync(ranBomInputPath)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContents)
    }

    pipe([vfs.src(ranBomInputPath, { encoding: false }), concat(assert)], done)
  })

  it("does not do any transcoding with encoding option set to false (stream)", done => {
    const expectedContents = fs.readFileSync(ranBomInputPath)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContents)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(ranBomInputPath, { encoding: false, buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("does not remove utf8 BOM with encoding option set to false (buffer)", done => {
    const expectedContents = fs.readFileSync(bomInputPath)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContents)
    }

    pipe([vfs.src(bomInputPath, { encoding: false }), concat(assert)], done)
  })

  it("does not remove utf8 BOM with encoding option set to false (stream)", done => {
    const expectedContents = fs.readFileSync(bomInputPath)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContents)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(bomInputPath, { encoding: false, buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("transcodes gb2312 to utf8 with encoding option (buffer)", done => {
    const expectedContents = new Buffer(encodedContents)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].contents).toMatch(expectedContents)
    }

    pipe([vfs.src(encodedInputPath, { encoding: "gb2312" }), concat(assert)], done)
  })

  it("transcodes gb2312 to utf8 with encoding option (stream)", done => {
    const expectedContents = new Buffer(encodedContents)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContents)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(encodedInputPath, { encoding: "gb2312", buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("reports unsupported encoding errors (buffer)", done => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    function finish(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Unsupported encoding: fubar42")
      done()
    }

    pipe([vfs.src(inputPath, { encoding: "fubar42" }), concat(assert)], finish)
  })

  it("reports unsupported encoding errors (stream)", done => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    function finish(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Unsupported encoding: fubar42")
      done()
    }

    pipe(
      [vfs.src(inputPath, { encoding: "fubar42", buffer: false }), concat(assert)],
      finish
    )
  })

  it("globs files with default settings", done => {
    function assert({ length }) {
      expect(length).to.equal(7)
    }

    pipe([vfs.src("./fixtures/*.txt", { cwd: __dirname }), concat(assert)], done)
  })

  it("globs files with default settings and relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    function assert({ length }) {
      expect(length).to.equal(7)
    }

    pipe([vfs.src("./fixtures/*.txt", { cwd }), concat(assert)], done)
  })

  // TODO: need to normalize the path of a directory vinyl object
  it("globs a directory with default settings", done => {
    const inputDirGlob = path.join(inputBase, "./f*/")

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isNull()).to.be.true
      expect(files[0].isDirectory()).to.be.true
    }

    pipe([vfs.src(inputDirGlob), concat(assert)], done)
  })

  it("globs a directory with default settings and relative cwd", done => {
    const cwd = path.relative(process.cwd(), __dirname)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isNull()).to.be.true
      expect(files[0].isDirectory()).to.be.true
    }

    pipe([vfs.src("./fixtures/f*/", { cwd }), concat(assert)], done)
  })

  it("streams a directory with default settings", done => {
    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].path).toEqual(inputDirpath)
      expect(files[0].isNull()).to.be.true
      expect(files[0].isDirectory()).to.be.true
    }

    pipe([vfs.src(inputDirpath), concat(assert)], done)
  })

  it("streams file with with no contents using read: false option", done => {
    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].path).toEqual(inputPath)
      expect(files[0].isNull()).to.be.true
      expect(files[0].contents).to.not.exist
    }

    pipe([vfs.src(inputPath, { read: false }), concat(assert)], done)
  })

  it("streams a file changed after since", done => {
    const lastUpdateDate = new Date(+fs.statSync(inputPath).mtime - 1000)

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].path).toEqual(inputPath)
    }

    pipe([vfs.src(inputPath, { since: lastUpdateDate }), concat(assert)], done)
  })

  it("does not stream a file changed before since", done => {
    const lastUpdateDate = new Date(+fs.statSync(inputPath).mtime + 1000)

    function assert({ length }) {
      expect(length).to.equal(0)
    }

    pipe([vfs.src(inputPath, { since: lastUpdateDate }), concat(assert)], done)
  })

  it("streams a file with streaming contents", done => {
    const expectedContent = fs.readFileSync(inputPath)

    function assertContent(contents) {
      expect(contents).toMatch(expectedContent)
    }

    function compareContents(file, cb) {
      pipe([file.contents, concat(assertContent)], err => {
        cb(err, file)
      })
    }

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].path).toEqual(inputPath)
      expect(files[0].isStream()).to.be.true
    }

    pipe(
      [
        vfs.src(inputPath, { buffer: false }),
        through.obj(compareContents),
        concat(assert),
      ],
      done
    )
  })

  it("can be used as a through stream and adds new files to the end", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: fs.readFileSync(inputPath),
      stat: fs.statSync(inputPath),
    })

    function assert(files) {
      expect(files.length).to.equal(2)
      expect(files[0]).toEqual(file)
    }

    pipe([from.obj([file]), vfs.src(inputPath), concat(assert)], done)
  })

  it("can be used at beginning and in the middle", done => {
    function assert({ length }) {
      expect(length).to.equal(2)
    }

    pipe([vfs.src(inputPath), vfs.src(inputPath), concat(assert)], done)
  })

  it("does not pass options on to through2", done => {
    // Reference: https://github.com/gulpjs/vinyl-fs/issues/153
    const read = expect.createSpy().andReturn(false)

    function assert() {
      // Called once to resolve the option
      expect(read.calls.length).to.equal(1)
    }

    pipe([vfs.src(inputPath, { read }), concat(assert)], done)
  })
})
