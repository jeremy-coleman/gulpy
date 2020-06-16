import * as fs from "fs"
import expect from "expect"
import miss from "mississippi"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import testConstants from "./utils/test-constants"

const pipe = miss.pipe
const concat = miss.concat

const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const inputDirpath = testConstants.inputDirpath
const outputDirpath = testConstants.outputDirpath
const symlinkNestedTarget = testConstants.symlinkNestedTarget
const symlinkPath = testConstants.symlinkPath
const symlinkDirpath = testConstants.symlinkDirpath
const symlinkMultiDirpath = testConstants.symlinkMultiDirpath
const symlinkMultiDirpathSecond = testConstants.symlinkMultiDirpathSecond
const symlinkNestedFirst = testConstants.symlinkNestedFirst
const symlinkNestedSecond = testConstants.symlinkNestedSecond

const clean = cleanup(outputBase)

describe(".src() with symlinks", () => {
  beforeEach(clean)
  afterEach(clean)

  beforeEach(done => {
    fs.mkdirSync(outputBase)
    fs.mkdirSync(outputDirpath)
    fs.symlinkSync(inputDirpath, symlinkDirpath)
    fs.symlinkSync(symlinkDirpath, symlinkMultiDirpath)
    fs.symlinkSync(symlinkMultiDirpath, symlinkMultiDirpathSecond)
    fs.symlinkSync(inputPath, symlinkPath)
    fs.symlinkSync(symlinkNestedTarget, symlinkNestedSecond)
    fs.symlinkSync(symlinkNestedSecond, symlinkNestedFirst)
    done()
  })

  it("resolves symlinks correctly", done => {
    function assert(files) {
      expect(files.length).toEqual(1)
      // The path should be the symlink itself
      expect(files[0].path).toEqual(symlinkNestedFirst)
      // But the content should be what's in the actual file
      expect(files[0].contents.toString()).toEqual("symlink works\n")
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toEqual(false)
      expect(files[0].stat.isFile()).toEqual(true)
    }

    pipe([vfs.src(symlinkNestedFirst), concat(assert)], done)
  })

  it("resolves directory symlinks correctly", done => {
    function assert(files) {
      expect(files.length).toEqual(1)
      // The path should be the symlink itself
      expect(files[0].path).toEqual(symlinkDirpath)
      // But the contents should be null
      expect(files[0].contents).toEqual(null)
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toEqual(false)
      expect(files[0].stat.isDirectory()).toEqual(true)
    }

    pipe([vfs.src(symlinkDirpath), concat(assert)], done)
  })

  it("resolves nested symlinks to directories correctly", done => {
    function assert(files) {
      expect(files.length).toEqual(1)
      // The path should be the symlink itself
      expect(files[0].path).toEqual(symlinkMultiDirpathSecond)
      // But the contents should be null
      expect(files[0].contents).toEqual(null)
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toEqual(false)
      expect(files[0].stat.isDirectory()).toEqual(true)
    }

    pipe([vfs.src(symlinkMultiDirpathSecond), concat(assert)], done)
  })

  it("preserves file symlinks with resolveSymlinks option set to false", done => {
    const expectedRelativeSymlinkPath = fs.readlinkSync(symlinkPath)

    function assert(files) {
      expect(files.length).toEqual(1)
      expect(files[0].path).toEqual(symlinkPath)
      expect(files[0].symlink).toEqual(expectedRelativeSymlinkPath)
    }

    pipe([vfs.src(symlinkPath, { resolveSymlinks: false }), concat(assert)], done)
  })

  it("preserves directory symlinks with resolveSymlinks option set to false", done => {
    const expectedRelativeSymlinkPath = fs.readlinkSync(symlinkDirpath)

    function assert(files) {
      expect(files.length).toEqual(1)
      expect(files[0].path).toEqual(symlinkDirpath)
      expect(files[0].symlink).toEqual(expectedRelativeSymlinkPath)
    }

    pipe([vfs.src(symlinkDirpath, { resolveSymlinks: false }), concat(assert)], done)
  })

  it("receives a file with symbolic link stats when resolveSymlinks is a function", done => {
    function resolveSymlinks(file) {
      expect(file).toExist()
      expect(file.stat).toExist()
      expect(file.stat.isSymbolicLink()).toEqual(true)

      return true
    }

    function assert(files) {
      expect(files.length).toEqual(1)
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toEqual(false)
      expect(files[0].stat.isFile()).toEqual(true)
    }

    pipe([vfs.src(symlinkNestedFirst, { resolveSymlinks }), concat(assert)], done)
  })

  it("only calls resolveSymlinks once-per-file if it is a function", done => {
    const spy = expect.createSpy().andReturn(true)

    function assert() {
      expect(spy.calls.length).toEqual(1)
    }

    pipe([vfs.src(symlinkNestedFirst, { resolveSymlinks: spy }), concat(assert)], done)
  })
})
