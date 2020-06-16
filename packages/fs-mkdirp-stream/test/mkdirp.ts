import * as os from "os"
import * as path from "path"
import * as fs from "fs"
import mock from "jest-mock"
import expect from "expect"
import rimraf from "rimraf"
import mkdirp from "../mkdirp"

const log = {
  expected(expected) {
    if (process.env.VERBOSE) {
      console.log("Expected mode:", expected.toString(8))
    }
  },
  found(found) {
    if (process.env.VERBOSE) {
      console.log("Found mode", found.toString(8))
    }
  },
}

function suite() {
  const MASK_MODE = parseInt("7777", 8)
  const DEFAULT_DIR_MODE = parseInt("0777", 8)
  const isWindows = os.platform() === "win32"

  const outputBase = path.join(__dirname, "./out-fixtures")
  const outputDirpath = path.join(outputBase, "./foo")
  const outputNestedPath = path.join(outputDirpath, "./test.txt")
  const outputNestedDirpath = path.join(outputDirpath, "./bar/baz/")
  const contents = "Hello World!\n"

  function cleanup(done) {
    this.timeout(20000)

    mock.restoreAllMocks()

    // Async del to get sort-of-fix for https://github.com/isaacs/rimraf/issues/72
    rimraf(outputBase, done)
  }

  function masked(mode) {
    return mode & MASK_MODE
  }

  function createdMode(outputPath) {
    const mode = masked(fs.lstatSync(outputPath).mode)
    log.found(mode)
    return mode
  }

  function expectedMode(mode) {
    if (typeof mode !== "number") {
      mode = parseInt(mode, 8)
    }

    log.expected(mode)
    return mode
  }

  function expectedDefaultMode() {
    // Set to use to "get" it
    const current = process.umask(0)
    // Then set it back for the next test
    process.umask(current)

    const mode = DEFAULT_DIR_MODE & ~current
    log.expected(mode)
    return mode
  }

  beforeEach(cleanup)
  afterEach(cleanup)

  beforeEach(done => {
    fs.mkdir(outputBase, err => {
      if (err) {
        return done(err)
      }

      // Linux inherits the setgid of the directory and it messes up our assertions
      // So we explixitly set the mode to 777 before each test
      fs.chmod(outputBase, "777", done)
    })
  })

  it("makes a single directory", done => {
    mkdirp(outputDirpath, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toBeDefined()

      done()
    })
  })

  it("makes single directory w/ default mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    mkdirp(outputDirpath, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedDefaultMode())

      done()
    })
  })

  it("makes multiple directories", done => {
    mkdirp(outputNestedDirpath, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputNestedDirpath)).toBeDefined()

      done()
    })
  })

  it("makes multiple directories w/ default mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    mkdirp(outputNestedDirpath, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputNestedDirpath)).toEqual(expectedDefaultMode())

      done()
    })
  })

  it("makes directory with custom mode as string", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedMode(mode))

      done()
    })
  })

  it("makes directory with custom mode as octal", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = parseInt("777", 8)

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedMode(mode))

      done()
    })
  })

  it("does not mask a custom mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = parseInt("777", 8)

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(mode)

      done()
    })
  })

  it("can create a directory with setgid permission", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "2700"

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedMode(mode))

      done()
    })
  })

  it("does not change directory mode if exists and no mode given", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()

      mkdirp(outputDirpath, err2 => {
        expect(err2).toBeFalsy()
        expect(createdMode(outputDirpath)).toEqual(expectedMode(mode))

        done()
      })
    })
  })

  it("makes multiple directories with custom mode", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputNestedDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputNestedDirpath)).toEqual(expectedMode(mode))

      done()
    })
  })

  it("uses default mode on intermediate directories", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const intermediateDirpath = path.dirname(outputNestedDirpath)
    const mode = "777"

    mkdirp(outputNestedDirpath, mode, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedDefaultMode())
      expect(createdMode(intermediateDirpath)).toEqual(expectedDefaultMode())
      expect(createdMode(outputNestedDirpath)).toEqual(expectedMode(mode))

      done()
    })
  })

  it("changes mode of existing directory", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputDirpath, err => {
      expect(err).toBeFalsy()
      expect(createdMode(outputDirpath)).toEqual(expectedDefaultMode())

      mkdirp(outputDirpath, mode, err2 => {
        expect(err2).toBeFalsy()
        expect(createdMode(outputDirpath)).toEqual(expectedMode(mode))

        done()
      })
    })
  })

  it("errors with EEXIST if file in path", done => {
    mkdirp(outputDirpath, err => {
      expect(err).toBeFalsy()

      fs.writeFile(outputNestedPath, contents, err2 => {
        expect(err2).toBeFalsy()

        mkdirp(outputNestedPath, err3 => {
          expect(err3).toBeDefined()
          expect(err3.code).toEqual("EEXIST")

          done()
        })
      })
    })
  })

  it("does not change mode of existing file", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputDirpath, err => {
      expect(err).toBeFalsy()

      fs.writeFile(outputNestedPath, contents, err2 => {
        expect(err2).toBeFalsy()

        const existingMode = createdMode(outputNestedPath)
        expect(existingMode).not.toEqual(mode)

        mkdirp(outputNestedPath, mode, err3 => {
          expect(err3).toBeDefined()
          expect(createdMode(outputNestedPath)).toEqual(existingMode)

          done()
        })
      })
    })
  })

  it("surfaces mkdir errors that happening during recursion", done => {
    const ogMkdir = fs.mkdir

    const spy = mock.spyOn(fs, "mkdir").mockImplementation((dirpath, mode, cb) => {
      if (spy.mock.calls.length === 1) {
        return ogMkdir(dirpath, mode, cb)
      }
      cb(new Error("boom"))
    })

    mkdirp(outputNestedDirpath, err => {
      expect(err).toBeDefined()

      done()
    })
  })

  it("surfaces fs.stat errors", done => {
    mock.spyOn(fs, "stat").mockImplementation((dirpath, cb) => {
      cb(new Error("boom"))
    })

    mkdirp(outputDirpath, err => {
      expect(err).toBeDefined()

      done()
    })
  })

  it("does not attempt fs.chmod if custom mode matches mode on disk", function (done) {
    if (isWindows) {
      this.skip()
      return
    }

    const mode = "777"

    mkdirp(outputDirpath, mode, err => {
      expect(err).toBeFalsy()

      const spy = mock.spyOn(fs, "chmod")

      mkdirp(outputDirpath, mode, err => {
        expect(err).toBeFalsy()
        expect(spy).toHaveBeenCalledTimes(0)

        done()
      })
    })
  })
}

describe("mkdirp", suite)

describe("mkdirp with umask", () => {
  let startingUmask
  before(done => {
    startingUmask = process.umask(parseInt("066", 8))

    done()
  })

  after(done => {
    process.umask(startingUmask)

    done()
  })

  // Initialize the normal suite
  suite()
})
