import * as path from "path"
import * as fs from "fs"
import miss from "mississippi"
import expect from "expect"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import isWindows from "./utils/is-windows"
import testStreams from "./utils/test-streams"
import testConstants from "./utils/test-constants"

const pipe = miss.pipe
const concat = miss.concat

const count = testStreams.count

const base = testConstants.outputBase
var inputDirpath = testConstants.inputDirpath
var outputDirpath = testConstants.outputDirpath
var symlinkDirpath = testConstants.symlinkDirpath
const inputBase = path.join(base, "./in/")
var inputDirpath = testConstants.inputDirpath
var outputDirpath = testConstants.outputDirpath
var symlinkDirpath = testConstants.symlinkDirpath
const inputGlob = path.join(inputBase, "./*.txt")
const outputBase = path.join(base, "./out/")
const outputSymlink = path.join(symlinkDirpath, "./foo")
const outputDirpathSymlink = path.join(outputDirpath, "./foo")
const content = testConstants.contents

const clean = cleanup(base)

describe("integrations", () => {
  beforeEach(clean)
  afterEach(clean)

  it("does not exhaust available file descriptors when streaming thousands of files", function (done) {
    // This can be a very slow test on boxes with slow disk i/o
    this.timeout(0)

    // Make a ton of files. Changed from hard links due to Windows failures
    const expectedCount = 6000

    fs.mkdirSync(base)
    fs.mkdirSync(inputBase)

    for (let idx = 0; idx < expectedCount; idx++) {
      const filepath = path.join(inputBase, `./test${idx}.txt`)
      fs.writeFileSync(filepath, content)
    }

    pipe(
      [vfs.src(inputGlob, { buffer: false }), count(expectedCount), vfs.dest(outputBase)],
      done
    )
  })

  it("(*nix) sources a directory, creates a symlink and copies it", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    function assert(files) {
      const symlinkResult = fs.readlinkSync(outputSymlink)
      const destResult = fs.readlinkSync(outputDirpathSymlink)

      expect(symlinkResult).toEqual(inputDirpath)
      expect(destResult).toEqual(inputDirpath)
      expect(files[0].isSymbolic()).toBe(true)
      expect(files[0].symlink).toEqual(inputDirpath)
    }

    pipe(
      [
        vfs.src(inputDirpath),
        vfs.symlink(symlinkDirpath),
        vfs.dest(outputDirpath),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) sources a directory, creates a junction and copies it", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    function assert(files) {
      // Junctions add an ending separator
      const expected = inputDirpath + path.sep
      const symlinkResult = fs.readlinkSync(outputSymlink)
      const destResult = fs.readlinkSync(outputDirpathSymlink)

      expect(symlinkResult).toEqual(expected)
      expect(destResult).toEqual(expected)
      expect(files[0].isSymbolic()).toBe(true)
      expect(files[0].symlink).toEqual(inputDirpath)
    }

    pipe(
      [
        vfs.src(inputDirpath),
        vfs.symlink(symlinkDirpath),
        vfs.dest(outputDirpath),
        concat(assert),
      ],
      done
    )
  })

  it("(*nix) sources a symlink and copies it", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    fs.mkdirSync(base)
    fs.mkdirSync(symlinkDirpath)
    fs.symlinkSync(inputDirpath, outputSymlink)

    function assert(files) {
      const destResult = fs.readlinkSync(outputDirpathSymlink)

      expect(destResult).toEqual(inputDirpath)
      expect(files[0].isSymbolic()).toEqual(true)
      expect(files[0].symlink).toEqual(inputDirpath)
    }

    pipe(
      [
        vfs.src(outputSymlink, { resolveSymlinks: false }),
        vfs.dest(outputDirpath),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) sources a directory symlink and copies it", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    fs.mkdirSync(base)
    fs.mkdirSync(symlinkDirpath)
    fs.symlinkSync(inputDirpath, outputSymlink, "dir")

    function assert(files) {
      // 'dir' symlinks add an ending separator
      const expected = inputDirpath + path.sep
      const destResult = fs.readlinkSync(outputDirpathSymlink)

      expect(destResult).toEqual(expected)
      expect(files[0].isSymbolic()).toEqual(true)
      expect(files[0].symlink).toEqual(inputDirpath)
    }

    pipe(
      [
        vfs.src(outputSymlink, { resolveSymlinks: false }),
        vfs.dest(outputDirpath),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) sources a junction and copies it", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    fs.mkdirSync(base)
    fs.mkdirSync(symlinkDirpath)
    fs.symlinkSync(inputDirpath, outputSymlink, "junction")

    function assert(files) {
      // Junctions add an ending separator
      const expected = inputDirpath + path.sep
      const destResult = fs.readlinkSync(outputDirpathSymlink)

      expect(destResult).toEqual(expected)
      expect(files[0].isSymbolic()).toEqual(true)
      expect(files[0].symlink).toEqual(inputDirpath)
    }

    pipe(
      [
        vfs.src(outputSymlink, { resolveSymlinks: false }),
        vfs.dest(outputDirpath),
        concat(assert),
      ],
      done
    )
  })
})
