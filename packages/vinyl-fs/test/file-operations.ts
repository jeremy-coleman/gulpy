import * as path from "path"
import * as buffer from "buffer"
import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import mkdirp from "fs-mkdirp-stream/mkdirp"
import * as fo from "../lib/file-operations"
import * as constants from "../lib/constants"
import from from "from2"
import pipe from "@local/pump"

const DEFAULT_FILE_MODE = constants.DEFAULT_FILE_MODE

import cleanup from "./utils/cleanup"
import statMode from "./utils/stat-mode"
import mockError from "./utils/mock-error"
import isWindows from "./utils/is-windows"
import applyUmask from "./utils/apply-umask"
import testStreams from "./utils/test-streams"
import testConstants from "./utils/test-constants"
import { isFunction } from "lodash"

const closeFd = fo.closeFd
const isOwner = fo.isOwner
const writeFile = fo.writeFile as any
const getModeDiff = fo.getModeDiff
const getTimesDiff = fo.getTimesDiff
const getOwnerDiff = fo.getOwnerDiff
const isValidUnixId = fo.isValidUnixId
const getFlags = fo.getFlags
const isFatalOverwriteError = fo.isFatalOverwriteError
const isFatalUnlinkError = fo.isFatalUnlinkError
const reflectStat = fo.reflectStat
const reflectLinkStat = fo.reflectLinkStat
const updateMetadata = fo.updateMetadata
const createWriteStream = fo.createWriteStream

const string = testStreams.string

const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const neInputDirpath = testConstants.neInputDirpath
const outputPath = testConstants.outputPath
const symlinkPath = testConstants.symlinkDirpath
const contents = testConstants.contents

const clean = cleanup(outputBase)

function noop() {}

describe("isOwner", () => {
  const ownerStat = {
    uid: 9001,
  }

  const nonOwnerStat = {
    uid: 9002,
  }

  let getuidSpy
  let geteuidSpy

  beforeEach(done => {
    if (!isFunction(process.geteuid)) {
      process.geteuid = noop
    }

    // Windows :(
    if (!isFunction(process.getuid)) {
      process.getuid = noop
    }

    getuidSpy = expect.spyOn(process, "getuid").andReturn(ownerStat.uid)
    geteuidSpy = expect.spyOn(process, "geteuid").andReturn(ownerStat.uid)

    done()
  })

  afterEach(done => {
    expect.restoreSpies()

    if (process.geteuid === noop) {
      delete process.geteuid
    }

    // Windows :(
    if (process.getuid === noop) {
      delete process.getuid
    }

    done()
  })

  // TODO: test for having neither

  it("uses process.geteuid() when available", done => {
    isOwner(ownerStat)

    expect(getuidSpy.calls.length).to.equal(0)
    expect(geteuidSpy.calls.length).to.equal(1)

    done()
  })

  it("uses process.getuid() when geteuid() is not available", done => {
    delete process.geteuid

    isOwner(ownerStat)

    expect(getuidSpy.calls.length).to.equal(1)

    done()
  })

  it("returns false when non-root and non-owner", done => {
    const result = isOwner(nonOwnerStat)

    expect(result).to.be.false

    done()
  })

  it("returns true when owner and non-root", done => {
    const result = isOwner(ownerStat)

    expect(result).to.be.true

    done()
  })

  it("returns true when non-owner but root", done => {
    expect.spyOn(process, "geteuid").andReturn(0) // 0 is root uid

    const result = isOwner(nonOwnerStat)

    expect(result).to.be.true

    done()
  })
})

describe("isValidUnixId", () => {
  it("returns true if the given id is a valid unix id", done => {
    const result = isValidUnixId(1000)

    expect(result).to.be.true

    done()
  })

  it("returns false if the given id is not a number", done => {
    const result = isValidUnixId("root")

    expect(result).to.be.false

    done()
  })

  it("returns false when the given id is less than 0", done => {
    const result = isValidUnixId(-1)

    expect(result).to.be.false

    done()
  })
})

describe("getFlags", () => {
  it("returns wx if overwrite is false and append is false", done => {
    const result = getFlags({
      overwrite: false,
      append: false,
    })

    expect(result).to.equal("wx")

    done()
  })

  it("returns w if overwrite is true and append is false", done => {
    const result = getFlags({
      overwrite: true,
      append: false,
    })

    expect(result).to.equal("w")

    done()
  })

  it("returns ax if overwrite is false and append is true", done => {
    const result = getFlags({
      overwrite: false,
      append: true,
    })

    expect(result).to.equal("ax")

    done()
  })

  it("returns a if overwrite is true and append is true", done => {
    const result = getFlags({
      overwrite: true,
      append: true,
    })

    expect(result).to.equal("a")

    done()
  })
})

describe("isFatalOverwriteError", () => {
  it("returns false if not given any error", done => {
    const result = isFatalOverwriteError(null)

    expect(result).to.be.false

    done()
  })

  it("returns true if code != EEXIST", done => {
    const result = isFatalOverwriteError({ code: "EOTHER" })

    expect(result).to.be.true

    done()
  })

  it("returns false if code == EEXIST and flags == wx", done => {
    const result = isFatalOverwriteError({ code: "EEXIST" }, "wx")

    expect(result).to.be.false

    done()
  })

  it("returns false if code == EEXIST and flags == ax", done => {
    const result = isFatalOverwriteError({ code: "EEXIST" }, "ax")

    expect(result).to.be.false

    done()
  })

  it("returns true if error.code == EEXIST and flags == w", done => {
    const result = isFatalOverwriteError({ code: "EEXIST" }, "w")

    expect(result).to.be.true

    done()
  })

  it("returns true if error.code == EEXIST and flags == a", done => {
    const result = isFatalOverwriteError({ code: "EEXIST" }, "a")

    expect(result).to.be.true

    done()
  })
})

describe("isFatalUnlinkError", () => {
  it("returns false if not given any error", done => {
    const result = isFatalUnlinkError(null)

    expect(result).to.be.false

    done()
  })

  it("returns false if code == ENOENT", done => {
    const result = isFatalUnlinkError({ code: "ENOENT" }, "wx")

    expect(result).to.be.false

    done()
  })

  it("returns true if code != ENOENT", done => {
    const result = isFatalUnlinkError({ code: "EOTHER" })

    expect(result).to.be.true

    done()
  })
})

describe("getModeDiff", () => {
  it("returns 0 if both modes are the same", done => {
    const fsMode = applyUmask("777")
    const vfsMode = applyUmask("777")

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).to.equal(0)

    done()
  })

  it("returns 0 if vinyl mode is not a number", done => {
    const fsMode = applyUmask("777")
    const vfsMode = undefined

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).to.equal(0)

    done()
  })

  it("returns a value greater than 0 if modes are different", done => {
    const fsMode = applyUmask("777")
    const vfsMode = applyUmask("744")

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).toBeGreaterThan(0)

    done()
  })

  it("returns the proper diff", done => {
    const fsMode = applyUmask("777")
    const vfsMode = applyUmask("744")
    const expectedDiff = applyUmask("33")

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).toEqual(expectedDiff)

    done()
  })

  it("does not matter the order of diffing", done => {
    const fsMode = applyUmask("655")
    const vfsMode = applyUmask("777")
    const expectedDiff = applyUmask("122")

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).toEqual(expectedDiff)

    done()
  })

  it("includes the sticky/setuid/setgid bits", done => {
    const fsMode = applyUmask("1777")
    const vfsMode = applyUmask("4777")
    const expectedDiff = applyUmask("5000")

    const result = getModeDiff(fsMode, vfsMode)

    expect(result).toEqual(expectedDiff)

    done()
  })
})

describe("getTimesDiff", () => {
  it("returns undefined if vinyl mtime is not a valid date", done => {
    const fsStat = {
      mtime: new Date(),
    }
    const vfsStat = {
      mtime: new Date(undefined),
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  it("returns undefined if vinyl mtime & atime are both equal to counterparts", done => {
    const now = Date.now()
    const fsStat = {
      mtime: new Date(now),
      atime: new Date(now),
    }
    const vfsStat = {
      mtime: new Date(now),
      atime: new Date(now),
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  // TODO: is this proper/expected?
  it("returns undefined if vinyl mtimes equals the counterpart and atimes are null", done => {
    const now = Date.now()
    const fsStat = {
      mtime: new Date(now),
      atime: null,
    }
    const vfsStat = {
      mtime: new Date(now),
      atime: null,
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  it("returns a diff object if mtimes do not match", done => {
    const now = Date.now()
    const then = now - 1000
    const fsStat = {
      mtime: new Date(now),
    }
    const vfsStat = {
      mtime: new Date(then),
    }
    const expected = {
      mtime: new Date(then),
      atime: undefined,
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  it("returns a diff object if atimes do not match", done => {
    const now = Date.now()
    const then = now - 1000
    const fsStat = {
      mtime: new Date(now),
      atime: new Date(now),
    }
    const vfsStat = {
      mtime: new Date(now),
      atime: new Date(then),
    }
    const expected = {
      mtime: new Date(now),
      atime: new Date(then),
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  it("returns the fs atime if the vinyl atime is invalid", done => {
    const now = Date.now()
    const fsStat = {
      mtime: new Date(now),
      atime: new Date(now),
    }
    const vfsStat = {
      mtime: new Date(now),
      atime: new Date(undefined),
    }
    const expected = {
      mtime: new Date(now),
      atime: new Date(now),
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  // TODO: is this proper/expected?
  it("makes atime diff undefined if fs and vinyl atime are invalid", done => {
    const now = Date.now()
    const fsStat = {
      mtime: new Date(now),
      atime: new Date(undefined),
    }
    const vfsStat = {
      mtime: new Date(now),
      atime: new Date(undefined),
    }
    const expected = {
      mtime: new Date(now),
      atime: undefined,
    }

    const result = getTimesDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })
})

describe("getOwnerDiff", () => {
  it("returns undefined if vinyl uid & gid are invalid", done => {
    const fsStat = {
      uid: 1000,
      gid: 1000,
    }
    const vfsStat = {
      uid: undefined,
      gid: undefined,
    }

    const result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  it("returns undefined if vinyl uid & gid are both equal to counterparts", done => {
    const fsStat = {
      uid: 1000,
      gid: 1000,
    }
    const vfsStat = {
      uid: 1000,
      gid: 1000,
    }

    const result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  it("returns a diff object if uid or gid do not match", done => {
    const fsStat = {
      uid: 1000,
      gid: 1000,
    }
    let vfsStat = {
      uid: 1001,
      gid: 1000,
    }
    let expected = {
      uid: 1001,
      gid: 1000,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    vfsStat = {
      uid: 1000,
      gid: 1001,
    }
    expected = {
      uid: 1000,
      gid: 1001,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  it("returns the fs uid if the vinyl uid is invalid", done => {
    const fsStat = {
      uid: 1000,
      gid: 1000,
    }
    var vfsStat = {
      uid: undefined,
      gid: 1001,
    }
    const expected = {
      uid: 1000,
      gid: 1001,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    var vfsStat = {
      uid: -1,
      gid: 1001,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  it("returns the fs gid if the vinyl gid is invalid", done => {
    const fsStat = {
      uid: 1000,
      gid: 1000,
    }
    var vfsStat = {
      uid: 1001,
      gid: undefined,
    }
    const expected = {
      uid: 1001,
      gid: 1000,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    var vfsStat = {
      uid: 1001,
      gid: -1,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).toEqual(expected)

    done()
  })

  it("returns undefined if fs and vinyl uid are invalid", done => {
    var fsStat = {
      uid: undefined,
      gid: 1000,
    }
    var vfsStat = {
      uid: undefined,
      gid: 1001,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    var fsStat = {
      uid: -1,
      gid: 1000,
    }
    var vfsStat = {
      uid: -1,
      gid: 1001,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })

  it("returns undefined if fs and vinyl gid are invalid", done => {
    let fsStat = {
      uid: 1000,
      gid: undefined,
    }
    let vfsStat = {
      uid: 1001,
      gid: undefined,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    fsStat = {
      uid: 1000,
      gid: -1,
    }
    vfsStat = {
      uid: 1001,
      gid: -1,
    }

    var result = getOwnerDiff(fsStat, vfsStat)

    expect(result).to.be.undefined

    done()
  })
})

describe("closeFd", () => {
  // This is just a very large number since node broke our tests by disallowing -1
  // We're also doing some hacky version matching because node 0.12 accepts 10000 on Windows (and fails the test)
  const invalidFd = process.version[1] === "0" ? -1 : 10000

  it("calls the callback with propagated error if fd is not a number", done => {
    const propagatedError = new Error()

    closeFd(propagatedError, null, err => {
      expect(err).toEqual(propagatedError)

      done()
    })
  })

  it("calls the callback with close error if no error to propagate", done => {
    closeFd(null, invalidFd, err => {
      expect(err).to.exist

      done()
    })
  })

  it("calls the callback with propagated error if close errors", done => {
    const propagatedError = new Error()

    closeFd(propagatedError, invalidFd, err => {
      expect(err).toEqual(propagatedError)

      done()
    })
  })

  it("calls the callback with propagated error if close succeeds", done => {
    const propagatedError = new Error()

    const fd = fs.openSync(inputPath, "r")

    const closeSpy = expect.spyOn(fs, "close").andCallThrough()

    closeFd(propagatedError, fd, err => {
      closeSpy.restore()

      expect(closeSpy.calls.length).to.equal(1)
      expect(err).toEqual(propagatedError)

      done()
    })
  })

  it("calls the callback with no error if close succeeds & no propagated error", done => {
    const fd = fs.openSync(inputPath, "r")

    const spy = expect.spyOn(fs, "close").andCallThrough()

    closeFd(null, fd, err => {
      spy.restore()

      expect(spy.calls.length).to.equal(1)
      expect(err).to.be.undefined

      done()
    })
  })
})

describe("writeFile", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    mkdirp(outputBase, done)
  })

  it("writes a file to the filesystem, does not close and returns the fd", done => {
    writeFile(outputPath, new Buffer(contents), (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, () => {
        const written = fs.readFileSync(outputPath, "utf8")

        expect(written).toEqual(contents)

        done()
      })
    })
  })

  it("defaults to writing files with 0666 mode", done => {
    const expected = applyUmask("666")

    writeFile(outputPath, new Buffer(contents), (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, () => {
        expect(statMode(outputPath)).toEqual(expected)

        done()
      })
    })
  })

  it("accepts a different mode in options", function (done) {
    // Changing the mode of a file is not supported by node.js in Windows.
    if (isWindows) {
      this.skip()
      return
    }

    const expected = applyUmask("777")
    const options = {
      mode: expected,
    }

    writeFile(outputPath, new Buffer(contents), options, (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, () => {
        expect(statMode(outputPath)).toEqual(expected)

        done()
      })
    })
  })

  it("defaults to opening files with write flag", done => {
    const length = contents.length

    writeFile(outputPath, new Buffer(contents), (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.read(fd, new Buffer(length), 0, length, 0, readErr => {
        expect(readErr).to.exist

        fs.close(fd, done)
      })
    })
  })

  it("accepts a different flags in options", done => {
    const length = contents.length
    const options = {
      flags: "w+",
    }

    writeFile(outputPath, new Buffer(contents), options, (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.read(fd, new Buffer(length), 0, length, 0, (readErr, _, written) => {
        expect(readErr).to.not.exist

        expect(written.toString()).toEqual(contents)

        fs.close(fd, done)
      })
    })
  })

  it("appends to a file if append flag is given", done => {
    const initial = "test"
    const toWrite = "-a-thing"

    fs.writeFileSync(outputPath, initial, "utf8")

    const expected = initial + toWrite

    const options = {
      flags: "a",
    }

    writeFile(outputPath, new Buffer(toWrite), options, (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, () => {
        const written = fs.readFileSync(outputPath, "utf8")

        expect(written).toEqual(expected)

        done()
      })
    })
  })

  it("does not pass a file descriptor if open call errors", done => {
    const notExistDir = path.join(__dirname, "./not-exist-dir/writeFile.txt")

    writeFile(notExistDir, new Buffer(contents), (err, fd) => {
      expect(err).to.exist
      expect(fd === "number").to.not.be.a("number")

      done()
    })
  })

  it("passes a file descriptor if write call errors", done => {
    const options = {
      flags: "r",
    }

    writeFile(inputPath, new Buffer(contents), options, (err, fd) => {
      expect(err).to.exist
      expect(fd).to.be.a("number")

      fs.close(fd, done)
    })
  })

  it("passes an error if called with string as data", done => {
    writeFile(outputPath, contents, err => {
      expect(err).to.exist

      done()
    })
  })

  it("does not error on SlowBuffer", function (done) {
    if (!buffer.SlowBuffer) {
      this.skip()
      return
    }

    const length = contents.length
    const buf = new Buffer(contents)
    const content = new buffer.SlowBuffer(length)
    buf.copy(content, 0, 0, length)

    writeFile(outputPath, content, (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, () => {
        const written = fs.readFileSync(outputPath, "utf8")

        expect(written).toEqual(contents)

        done()
      })
    })
  })

  it("does not error if options is falsey", done => {
    writeFile(outputPath, new Buffer(contents), null, (err, fd) => {
      expect(err).to.not.exist
      expect(fd).to.be.a("number")

      fs.close(fd, done)
    })
  })
})

describe("reflectStat", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    mkdirp(outputBase, done)
  })

  it("passes the error if stat fails", done => {
    const file = new File()

    reflectStat(neInputDirpath, file, err => {
      expect(err).to.exist

      done()
    })
  })

  it("updates the vinyl with filesystem stats", done => {
    const file = new File()

    fs.symlinkSync(inputPath, symlinkPath)

    reflectStat(symlinkPath, file, () => {
      // There appears to be a bug in the Windows implementation which causes
      // the sync versions of stat and lstat to return unsigned 32-bit ints
      // whilst the async versions returns signed 32-bit ints... This affects
      // dev but possibly others as well?
      fs.stat(symlinkPath, (err, stat) => {
        expect(file.stat).toEqual(stat)

        done()
      })
    })
  })
})

describe("reflectLinkStat", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    mkdirp(outputBase, done)
  })

  it("passes the error if lstat fails", done => {
    const file = new File()

    reflectLinkStat(neInputDirpath, file, err => {
      expect(err).to.exist

      done()
    })
  })

  it("updates the vinyl with filesystem symbolic stats", done => {
    const file = new File()

    fs.symlinkSync(inputPath, symlinkPath)

    reflectLinkStat(symlinkPath, file, () => {
      // There appears to be a bug in the Windows implementation which causes
      // the sync versions of stat and lstat to return unsigned 32-bit ints
      // whilst the async versions returns signed 32-bit ints... This affects
      // dev but possibly others as well?
      fs.lstat(symlinkPath, (err, stat) => {
        expect(file.stat).toEqual(stat)

        done()
      })
    })
  })
})

describe("updateMetadata", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    mkdirp(outputBase, done)
  })

  afterEach(done => {
    if (process.geteuid === noop) {
      delete process.geteuid
    }

    done()
  })

  it("passes the error if fstat fails", function (done) {
    // Changing the time of a directory errors in Windows.
    // Changing the mode of a file is not supported by node.js in Windows.
    // Windows is treated as though it does not have permission to make these operations.
    if (isWindows) {
      this.skip()
      return
    }

    const fd = 9001

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {},
    })

    updateMetadata(fd, file, err => {
      expect(err).to.exist

      done()
    })
  })

  it("updates the vinyl object with fs stats", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {},
    })

    const fd = fs.openSync(outputPath, "w+")
    const stats = fs.fstatSync(fd)

    updateMetadata(fd, file, () => {
      // Not sure why .toEqual doesn't match these
      Object.keys(file.stat).forEach(key => {
        expect(file.stat[key]).toEqual(stats[key])
      })

      fs.close(fd, done)
    })
  })

  it("does not touch the fs if nothing to update", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {},
    })

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()
    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, () => {
      expect(fchmodSpy.calls.length).to.equal(0)
      expect(futimesSpy.calls.length).to.equal(0)

      fs.close(fd, done)
    })
  })

  it("does not touch the fs if process is not owner of the file", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    if (!isFunction(process.geteuid)) {
      process.geteuid = noop
    }

    const earlier = Date.now() - 1000

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mtime: new Date(earlier),
      },
    })

    expect.spyOn(process, "geteuid").andReturn(9002)
    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()
    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, () => {
      expect(fchmodSpy.calls.length).to.equal(0)
      expect(futimesSpy.calls.length).to.equal(0)

      fs.close(fd, done)
    })
  })

  it("updates times on fs and vinyl object if there is a diff", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    // Use new atime/mtime
    const atime = new Date(Date.now() - 2048)
    const mtime = new Date(Date.now() - 1024)
    const mtimeEarlier = mtime.getTime() - 1000
    const atimeEarlier = atime.getTime() - 1000

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mtime: new Date(mtimeEarlier),
        atime: new Date(atimeEarlier),
      },
    })

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, function () {
      expect(futimesSpy.calls.length).to.equal(1)
      // Var stats = fs.fstatSync(fd);

      const atimeSpy = futimesSpy.calls[0].arguments[1]
      const mtimeSpy = futimesSpy.calls[0].arguments[2]

      expect(file.stat.mtime).toEqual(new Date(mtimeEarlier))
      expect(mtimeSpy.getTime()).toEqual(mtimeEarlier)
      expect(file.stat.atime).toEqual(new Date(atimeEarlier))
      expect(atimeSpy.getTime()).toEqual(atimeEarlier)

      fs.close(fd, done)
    })
  })

  it("forwards futimes error and descriptor upon error", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const futimesSpy = expect.spyOn(fs, "futimes").andCall(mockError)

    const now = Date.now()
    const then = now - 1000

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mtime: new Date(then),
        atime: new Date(then),
      },
    })

    const fd = fs.openSync(outputPath, "w+")
    expect(fd).to.be.a("number")

    updateMetadata(fd, file, err => {
      expect(err).to.exist
      expect(futimesSpy.calls.length).to.equal(1)

      fs.close(fd, done)
    })
  })

  it("updates the mode on fs and vinyl object if there is a diff", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()

    const mode = applyUmask("777")

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mode,
      },
    })

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, () => {
      expect(fchmodSpy.calls.length).to.equal(1)
      const stats = fs.fstatSync(fd)
      expect(file.stat.mode).toEqual(stats.mode)

      fs.close(fd, done)
    })
  })

  it("updates the sticky bit on mode on fs and vinyl object if there is a diff", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()

    const mode = applyUmask("1777")

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mode,
      },
    })

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, () => {
      expect(fchmodSpy.calls.length).to.equal(1)
      const stats = fs.fstatSync(fd)
      expect(file.stat.mode).toEqual(stats.mode)

      fs.close(fd, done)
    })
  })

  it("forwards fchmod error and descriptor upon error", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = applyUmask("777")

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mode,
      },
    })

    const fd = fs.openSync(outputPath, "w+")

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCall(mockError)

    updateMetadata(fd, file, err => {
      expect(err).to.exist
      expect(fchmodSpy.calls.length).to.equal(1)

      fs.close(fd, done)
    })
  })

  it("updates the mode & times on fs and vinyl object if there is a diff", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCallThrough()
    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    // Use new atime/mtime
    const atime = new Date(Date.now() - 2048)
    const mtime = new Date(Date.now() - 1024)
    const mtimeEarlier = mtime.getTime() - 1000
    const atimeEarlier = atime.getTime() - 1000

    const mode = applyUmask("777")

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mtime: new Date(mtimeEarlier),
        atime: new Date(atimeEarlier),
        mode,
      },
    })

    const fd = fs.openSync(outputPath, "w+")

    updateMetadata(fd, file, function () {
      expect(fchmodSpy.calls.length).to.equal(1)
      expect(futimesSpy.calls.length).to.equal(1)

      const atimeSpy = futimesSpy.calls[0].arguments[1]
      const mtimeSpy = futimesSpy.calls[0].arguments[2]

      expect(file.stat.mtime).toEqual(new Date(mtimeEarlier))
      expect(mtimeSpy.getTime()).toEqual(mtimeEarlier)
      expect(file.stat.atime).toEqual(new Date(atimeEarlier))
      expect(atimeSpy.getTime()).toEqual(atimeEarlier)

      fs.close(fd, done)
    })
  })

  it("forwards fchmod error and descriptor through futimes if there is a time diff", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mockedErr = new Error("mocked error")

    const fchmodSpy = expect.spyOn(fs, "fchmod").andCall((fd, mode, cb) => {
      cb(mockedErr)
    })
    const futimesSpy = expect.spyOn(fs, "futimes").andCallThrough()

    const now = Date.now()
    const then = now - 1000
    const mode = applyUmask("777")

    const file = new File({
      base: outputBase,
      path: outputPath,
      contents: null,
      stat: {
        mtime: new Date(then),
        atime: new Date(then),
        mode,
      },
    })

    const fd = fs.openSync(outputPath, "w")

    updateMetadata(fd, file, err => {
      expect(err).to.exist
      expect(err).toEqual(mockedErr)
      expect(fchmodSpy.calls.length).to.equal(1)
      expect(futimesSpy.calls.length).to.equal(1)

      fs.close(fd, done)
    })
  })

  // TODO: forward fchown error tests
})

describe("createWriteStream", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    // For some reason, the outputDir sometimes exists on Windows
    // So we use our mkdirp to create it
    mkdirp(outputBase, done)
  })

  it("accepts just a file path and writes to it", done => {
    function assert(err) {
      const outputContents = fs.readFileSync(outputPath, "utf8")
      expect(outputContents).toEqual(contents)
      done(err)
    }

    pipe([from([contents]), createWriteStream(outputPath)], assert)
  })

  it("accepts just a file path and writes a large file to it", done => {
    const size = 40000

    function assert(err) {
      const stats = fs.lstatSync(outputPath)

      expect(stats.size).toEqual(size)
      done(err)
    }

    pipe([string(size), createWriteStream(outputPath)], assert)
  })

  it("accepts flags option", done => {
    // Write 13 stars then 12345 because the length of expected is 13
    fs.writeFileSync(outputPath, "*************12345")

    function assert(err) {
      const outputContents = fs.readFileSync(outputPath, "utf8")
      expect(outputContents).toEqual(`${contents}12345`)
      done(err)
    }

    pipe(
      [
        from([contents]),
        // Replaces from the beginning of the file
        createWriteStream(outputPath, { flags: "r+" }),
      ],
      assert
    )
  })

  it("accepts append flag as option & places cursor at the end", done => {
    fs.writeFileSync(outputPath, "12345")

    function assert(err) {
      const outputContents = fs.readFileSync(outputPath, "utf8")
      expect(outputContents).toEqual(`12345${contents}`)
      done(err)
    }

    pipe(
      [
        from([contents]),
        // Appends to the end of the file
        createWriteStream(outputPath, { flags: "a" }),
      ],
      assert
    )
  })

  it("accepts mode option", function (done) {
    if (isWindows) {
      console.log("Changing the mode of a file is not supported by node.js in Windows.")
      this.skip()
      return
    }

    const mode = applyUmask("777")

    function assert(err) {
      expect(statMode(outputPath)).toEqual(mode)
      done(err)
    }

    pipe([from([contents]), createWriteStream(outputPath, { mode })], assert)
  })

  it("uses default file mode if no mode options", done => {
    const defaultMode = applyUmask(DEFAULT_FILE_MODE)

    function assert(err) {
      expect(statMode(outputPath)).toEqual(defaultMode)
      done(err)
    }

    pipe([from([contents]), createWriteStream(outputPath)], assert)
  })

  it("accepts a flush function that is called before close emitted", done => {
    let flushCalled = false

    const outStream = createWriteStream(outputPath, {}, (fd, cb) => {
      flushCalled = true
      cb()
    })

    function assert(err) {
      expect(flushCalled).to.be.true
      done(err)
    }

    pipe([from([contents]), outStream], assert)
  })

  it("can specify flush without options argument", done => {
    let flushCalled = false

    const outStream = createWriteStream(outputPath, (fd, cb) => {
      flushCalled = true
      cb()
    })

    function assert(err) {
      expect(flushCalled).to.be.true
      done(err)
    }

    pipe([from([contents]), outStream], assert)
  })

  it("passes the file descriptor to flush", done => {
    let flushCalled = false

    const outStream = createWriteStream(outputPath, (fd, cb) => {
      expect(fd).to.be.a("number")
      flushCalled = true
      cb()
    })

    function assert(err) {
      expect(flushCalled).to.be.true
      done(err)
    }

    pipe([from([contents]), outStream], assert)
  })

  it("passes a callback to flush to call when work is done", done => {
    let flushCalled = false
    let timeoutCalled = false

    const outStream = createWriteStream(outputPath, (fd, cb) => {
      flushCalled = true
      setTimeout(() => {
        timeoutCalled = true
        cb()
      }, 250)
    })

    function assert(err) {
      expect(flushCalled).to.be.true
      expect(timeoutCalled).to.be.true
      done(err)
    }

    pipe([from([contents]), outStream], assert)
  })

  it("emits an error if open fails", done => {
    const badOutputPath = path.join(outputBase, "./non-exist/test.coffee")

    function assert(err) {
      expect(err).to.be.an(Error)
      done()
    }

    pipe([from([contents]), createWriteStream(badOutputPath)], assert)
  })

  it("emits an error if write fails", done => {
    // Create the file so it can be opened with `r`
    fs.writeFileSync(outputPath, contents)

    function assert(err) {
      expect(err).to.be.an(Error)
      done()
    }

    pipe([from([contents]), createWriteStream(outputPath, { flags: "r" })], assert)
  })
})
