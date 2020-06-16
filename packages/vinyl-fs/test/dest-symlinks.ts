import * as path from "path"
import * as fs from "fs"
import File from "vinyl"
import { expect } from "chai"
import * as vfs from "../"
import cleanup from "./utils/cleanup"
import isWindows from "./utils/is-windows"
import always from "./utils/always"
import testConstants from "./utils/test-constants"

import from from "from2"
import concat from "concat-stream"
import pipe from "pump"

const inputBase = testConstants.inputBase
const outputBase = testConstants.outputBase
const inputPath = testConstants.inputPath
const outputPath = testConstants.outputPath
const inputDirpath = testConstants.inputDirpath
const outputDirpath = testConstants.outputDirpath
const contents = testConstants.contents
// For not-exists tests
const neInputBase = testConstants.neInputBase
const neOutputBase = testConstants.neOutputBase
const neInputDirpath = testConstants.neInputDirpath
const neOutputDirpath = testConstants.neOutputDirpath

const clean = cleanup(outputBase)

describe(".dest() with symlinks", () => {
  beforeEach(clean)
  afterEach(clean)

  it("creates symlinks when `file.isSymbolic()` is true", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert(files) {
      const symlink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(file.symlink).toEqual(symlink)
      expect(files[0].symlink).toEqual(symlink)
      expect(files[0].isSymbolic()).to.be.true
      expect(files[0].path).toEqual(outputPath)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("does not create symlinks when `file.isSymbolic()` is false", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(false),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert({ length }) {
      const symlinkExists = fs.existsSync(outputPath)

      expect(length).to.equal(1)
      expect(symlinkExists).toBe(false)
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("errors if missing a `.symlink` property", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    function assert(err) {
      expect(err).to.exist
      expect(err.message).to.equal("Missing symlink property on symbolic vinyl")
      done()
    }

    pipe([from.obj([file]), vfs.dest(outputBase)], assert)
  })

  it("emits Vinyl files that are (still) symbolic", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert(files) {
      expect(files.length).to.equal(1)
      expect(files[0].isSymbolic()).to.be.true
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("can create relative links", done => {
    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert(files) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(files.length).to.equal(1)
      expect(outputLink).toEqual(path.normalize("../fixtures/test.txt"))
      expect(files[0].isSymbolic()).to.be.true
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(*nix) creates a link for a directory", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("(windows) creates a junction for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      // When creating a junction, it seems Windows appends a separator
      expect(outputLink).toEqual(inputDirpath + path.sep)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe([from.obj([file]), vfs.dest(outputBase), concat(assert)], done)
  })

  it("(windows) options can disable junctions for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { useJunctions: false }), concat(assert)],
      done
    )
  })

  it("(windows) options can disable junctions for a directory (as a function)", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function useJunctions(f) {
      expect(f).to.exist
      expect(f).toBe(file)
      return false
    }

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(inputDirpath)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe([from.obj([file]), vfs.dest(outputBase, { useJunctions }), concat(assert)], done)
  })

  it("(*nix) can create relative links for directories", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(path.normalize("../fixtures/foo"))
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(*nix) receives a virtual symbolic directory and creates a symlink", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: neInputBase,
      path: neInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = neInputDirpath

    function assert({ length }) {
      const lstats = fs.lstatSync(neOutputDirpath)
      const outputLink = fs.readlinkSync(neOutputDirpath)
      const linkTargetExists = fs.existsSync(outputLink)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(neInputDirpath)
      expect(linkTargetExists).to.be.false
      expect(lstats.isSymbolicLink()).to.be.true
    }

    pipe(
      [
        // This could also be from a different Vinyl adapter
        from.obj([file]),
        vfs.dest(neOutputBase),
        concat(assert),
      ],
      done
    )
  })

  // There's no way to determine the proper type of link to create with a dangling link
  // So we just create a 'file' type symlink
  // There's also no real way to test the type that was created
  it("(windows) receives a virtual symbolic directory and creates a symlink", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: neInputBase,
      path: neInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = neInputDirpath

    function assert({ length }) {
      const lstats = fs.lstatSync(neOutputDirpath)
      const outputLink = fs.readlinkSync(neOutputDirpath)
      const linkTargetExists = fs.existsSync(outputLink)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(neInputDirpath)
      expect(linkTargetExists).to.be.false
      expect(lstats.isSymbolicLink()).to.be.true
    }

    pipe(
      [
        // This could also be from a different Vinyl adapter
        from.obj([file]),
        vfs.dest(neOutputBase),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) relativeSymlinks option is ignored when junctions are used", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert({ length }) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(length).to.equal(1)
      // When creating a junction, it seems Windows appends a separator
      expect(outputLink).toEqual(inputDirpath + path.sep)
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { useJunctions: true, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) supports relativeSymlinks option when link is not for a directory", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert({ length }) {
      const outputLink = fs.readlinkSync(outputPath)

      expect(length).to.equal(1)
      expect(outputLink).toEqual(path.normalize("../fixtures/test.txt"))
    }

    pipe(
      [
        from.obj([file]),
        // The useJunctions option is ignored when file is not a directory
        vfs.dest(outputBase, { useJunctions: true, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("(windows) can create relative links for directories when junctions are disabled", function (done) {
    if (!isWindows) {
      this.skip()
      return
    }

    const file = new File({
      base: inputBase,
      path: inputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputDirpath

    function assert(files) {
      const stats = fs.statSync(outputDirpath)
      const lstats = fs.lstatSync(outputDirpath)
      const outputLink = fs.readlinkSync(outputDirpath)

      expect(files.length).to.equal(1)
      expect(files).toInclude(file)
      expect(files[0].base).toEqual(outputBase, "base should have changed")
      expect(files[0].path).toEqual(outputDirpath, "path should have changed")
      expect(outputLink).toEqual(path.normalize("../fixtures/foo"))
      expect(stats.isDirectory()).to.be.true
      expect(lstats.isDirectory()).to.be.false
    }

    pipe(
      [
        from.obj([file]),
        vfs.dest(outputBase, { useJunctions: false, relativeSymlinks: true }),
        concat(assert),
      ],
      done
    )
  })

  it("does not overwrite links with overwrite option set to false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents)
    }

    // Write expected file which should not be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { overwrite: false }), concat(assert)],
      done
    )
  })

  it("overwrites links with overwrite option set to true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe(
      [from.obj([file]), vfs.dest(outputBase, { overwrite: true }), concat(assert)],
      done
    )
  })

  it("does not overwrite links with overwrite option set to a function that returns false", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function overwrite(f) {
      expect(f).toEqual(file)
      return false
    }

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(existingContents)
    }

    // Write expected file which should not be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { overwrite }), concat(assert)], done)
  })

  it("overwrites links with overwrite option set to a function that returns true", done => {
    const existingContents = "Lorem Ipsum"

    const file = new File({
      base: inputBase,
      path: inputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    })

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = inputPath

    function overwrite(f) {
      expect(f).toEqual(file)
      return true
    }

    function assert({ length }) {
      const outputContents = fs.readFileSync(outputPath, "utf8")

      expect(length).to.equal(1)
      expect(outputContents).toEqual(contents)
    }

    // This should be overwritten
    fs.mkdirSync(outputBase)
    fs.writeFileSync(outputPath, existingContents)

    pipe([from.obj([file]), vfs.dest(outputBase, { overwrite }), concat(assert)], done)
  })
})
