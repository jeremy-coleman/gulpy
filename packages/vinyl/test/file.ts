import * as fs from "fs"
import * as path from "path"
import * as util from "util"
import { expect } from "chai"
import { pipe, from, concat } from "./mississippi"
import cloneable from "cloneable-readable"
import File from "../index"

const isCloneable = cloneable.isCloneable

const isWin = process.platform === "win32"

describe("File", () => {
  describe("isVinyl()", () => {
    it("returns true for a Vinyl object", () => {
      const file = new File()
      const result = File.isVinyl(file)
      expect(result).to.be.true
    })

    it("returns false for a normal object", () => {
      const result = File.isVinyl({})
      expect(result).to.be.false
    })

    it("returns false for null", () => {
      const result = File.isVinyl(null)
      expect(result).to.be.false
    })

    it("returns false for a string", () => {
      const result = File.isVinyl("foobar")
      expect(result).to.be.false
    })

    it("returns false for a String object", () => {
      const result = File.isVinyl(new String("foobar"))
      expect(result).to.be.false
    })

    it("returns false for a number", () => {
      const result = File.isVinyl(1)
      expect(result).to.be.false
    })

    it("returns false for a Number object", () => {
      const result = File.isVinyl(new Number(1))
      expect(result).to.be.false
    })

    // This is based on current implementation
    // A test was added to document and make aware during internal changes
    // TODO: decide if this should be leak-able
    it("returns true for a mocked object", () => {
      const result = File.isVinyl({ _isVinyl: true })
      expect(result).to.be.true
    })
  })

  describe("defaults", () => {
    it("defaults cwd to process.cwd", () => {
      const file = new File()
      expect(file.cwd).to.equal(process.cwd())
    })

    it("defaults base to process.cwd", () => {
      const file = new File()
      expect(file.base).to.equal(process.cwd())
    })

    it("defaults base to cwd property", () => {
      const cwd = path.normalize("/")
      const file = new File({ cwd })
      expect(file.base).to.equal(cwd)
    })

    it("defaults path to null", () => {
      const file = new File()
      expect(file.path).to.not.exist
    })

    it("defaults history to an empty array", () => {
      const file = new File()
      expect(file.history).to.deep.equal([])
    })

    it("defaults stat to null", () => {
      const file = new File()
      expect(file.stat).to.not.exist
    })

    it("defaults contents to null", () => {
      const file = new File()
      expect(file.contents).to.not.exist
    })
  })

  describe("constructor()", () => {
    it("sets base", () => {
      const val = path.normalize("/")
      const file = new File({ base: val })
      expect(file.base).to.equal(val)
    })

    it("sets cwd", () => {
      const val = path.normalize("/")
      const file = new File({ cwd: val })
      expect(file.cwd).to.equal(val)
    })

    it("sets path (and history)", () => {
      const val = path.normalize("/test.coffee")
      const file = new File({ path: val })
      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal([val])
    })

    it("sets history (and path)", () => {
      const val = path.normalize("/test.coffee")
      const file = new File({ history: [val] })
      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal([val])
    })

    it("sets stat", () => {
      const val = {} as any
      const file = new File({ stat: val })
      expect(file.stat).to.equal(val)
    })

    it("sets contents", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val })
      expect(file.contents).to.deep.equal(val)
    })

    it("sets custom properties", () => {
      const sourceMap = {}
      const file = new File({ sourceMap })
      expect(file["sourceMap"]).to.equal(sourceMap)
    })

    it("normalizes path", () => {
      const val = "/test/foo/../test.coffee"
      const expected = path.normalize(val)
      const file = new File({ path: val })
      expect(file.path).to.equal(expected)
      expect(file.history).to.deep.equal([expected])
    })

    it("normalizes and removes trailing separator from path", () => {
      const val = "/test/foo/../foo/"
      const expected = path.normalize(val.slice(0, -1))
      const file = new File({ path: val })
      expect(file.path).to.equal(expected)
    })

    it("normalizes history", () => {
      const val = ["/test/bar/../bar/test.coffee", "/test/foo/../test.coffee"]
      const expected = val.map(p => path.normalize(p))
      const file = new File({ history: val })
      expect(file.path).to.deep.equal(expected[1])
      expect(file.history).to.deep.equal(expected)
    })

    it("normalizes and removes trailing separator from history", () => {
      const val = ["/test/foo/../foo/", "/test/bar/../bar/"]
      const expected = val.map(p => path.normalize(p.slice(0, -1)))
      const file = new File({ history: val })
      expect(file.history).to.deep.equal(expected)
    })

    it("appends path to history if both exist and different from last", () => {
      const val = path.normalize("/test/baz/test.coffee")
      const history = [
        path.normalize("/test/bar/test.coffee"),
        path.normalize("/test/foo/test.coffee"),
      ]
      const file = new File({ path: val, history })

      const expectedHistory = history.concat(val)

      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(expectedHistory)
    })

    it("does not append path to history if both exist and same as last", () => {
      const val = path.normalize("/test/baz/test.coffee")
      const history = [
        path.normalize("/test/bar/test.coffee"),
        path.normalize("/test/foo/test.coffee"),
        val,
      ]
      const file = new File({ path: val, history })

      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(history)
    })

    it("does not mutate history array passed in", () => {
      const val = path.normalize("/test/baz/test.coffee")
      const history = [
        path.normalize("/test/bar/test.coffee"),
        path.normalize("/test/foo/test.coffee"),
      ]
      const historyCopy = Array.prototype.slice.call(history)
      const file = new File({ path: val, history })

      const expectedHistory = history.concat(val)

      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(expectedHistory)
      expect(history).to.deep.equal(historyCopy)
    })
  })

  describe("isBuffer()", () => {
    it("returns true when the contents are a Buffer", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val })
      expect(file.isBuffer()).to.be.true
    })

    it("returns false when the contents are a Stream", () => {
      const val = from([])
      const file = new File({ contents: val })
      expect(file.isBuffer()).to.be.false
    })

    it("returns false when the contents are null", () => {
      const file = new File({ contents: null })
      expect(file.isBuffer()).to.be.false
    })
  })

  describe("isStream()", () => {
    it("returns false when the contents are a Buffer", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val })
      expect(file.isStream()).to.be.false
    })

    it("returns true when the contents are a Stream", () => {
      const val = from([])
      const file = new File({ contents: val })
      expect(file.isStream()).to.be.true
    })

    it("returns false when the contents are null", () => {
      const file = new File({ contents: null })
      expect(file.isStream()).to.be.false
    })
  })

  describe("isNull()", () => {
    it("returns false when the contents are a Buffer", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val })
      expect(file.isNull()).to.be.false
    })

    it("returns false when the contents are a Stream", () => {
      const val = from([])
      const file = new File({ contents: val })
      expect(file.isNull()).to.be.false
    })

    it("returns true when the contents are null", () => {
      const file = new File({ contents: null })
      expect(file.isNull()).to.be.true
    })
  })

  describe("isDirectory()", () => {
    const fakeStat = ({
      isDirectory() {
        return true
      },
    } as any) as fs.Stats

    it("returns false when the contents are a Buffer", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val, stat: fakeStat })
      expect(file.isDirectory()).to.be.false
    })

    it("returns false when the contents are a Stream", () => {
      const val = from([])
      const file = new File({ contents: val, stat: fakeStat })
      expect(file.isDirectory()).to.be.false
    })

    it("returns true when the contents are null & stat.isDirectory is true", () => {
      const file = new File({ contents: null, stat: fakeStat })
      expect(file.isDirectory()).to.be.true
    })

    it("returns false when stat exists but does not contain an isDirectory method", () => {
      const file = new File({ contents: null, stat: {} as any })
      expect(file.isDirectory()).to.be.false
    })

    it("returns false when stat does not exist", () => {
      const file = new File({ contents: null })
      expect(file.isDirectory()).to.be.false
    })
  })

  describe("isSymbolic()", () => {
    const fakeStat = ({
      isSymbolicLink() {
        return true
      },
    } as any) as fs.Stats

    it("returns false when the contents are a Buffer", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val, stat: fakeStat })
      expect(file.isSymbolic()).to.be.false
    })

    it("returns false when the contents are a Stream", () => {
      const val = from([])
      const file = new File({ contents: val, stat: fakeStat })
      expect(file.isSymbolic()).to.be.false
    })

    it("returns true when the contents are null & stat.isSymbolicLink is true", () => {
      const file = new File({ contents: null, stat: fakeStat })
      expect(file.isSymbolic()).to.be.true
    })

    it("returns false when stat exists but does not contain an isSymbolicLink method", () => {
      const file = new File({ contents: null, stat: {} as any })
      expect(file.isSymbolic()).to.be.false
    })

    it("returns false when stat does not exist", () => {
      const file = new File({ contents: null })
      expect(file.isSymbolic()).to.be.false
    })
  })

  describe("clone()", () => {
    it("copies all attributes over with Buffer contents", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: new Buffer("test"),
      }
      const file = new File(options)
      const file2 = file.clone()

      expect(file2).to.not.equal(file)
      expect(file2.cwd).to.equal(file.cwd)
      expect(file2.base).to.equal(file.base)
      expect(file2.path).to.equal(file.path)
      expect(file2.contents).to.not.equal(file.contents)
      expect(file2.contents!.toString("utf8")).to.equal(file.contents!.toString("utf8"))
    })

    it("assigns Buffer content reference when contents option is false", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.js",
        contents: new Buffer("test"),
      }
      const file = new File(options)

      const copy1 = file.clone({ contents: false })
      expect(copy1.contents).to.equal(file.contents)

      const copy2 = file.clone()
      expect(copy2.contents).to.not.equal(file.contents)

      const copy3 = file.clone({ contents: "invalid" as any })
      expect(copy3.contents).to.not.equal(file.contents)
    })

    it("copies all attributes over with Stream contents", done => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: from(["wa", "dup"]),
      }
      const file = new File(options)
      const file2 = file.clone()

      expect(file2).to.not.equal(file)
      expect(file2.cwd).to.equal(file.cwd)
      expect(file2.base).to.equal(file.base)
      expect(file2.path).to.equal(file.path)
      expect(file2.contents).to.not.equal(file.contents)

      let ends = 2
      let data: Buffer
      let data2: Buffer

      function assert(err) {
        if (err) {
          done(err)
          return
        }

        if (--ends === 0) {
          expect(data).to.not.equal(data2)
          expect(data.toString("utf8")).to.equal(data2.toString("utf8"))
          done()
        }
      }

      pipe(
        [
          file.contents,
          concat(d => {
            data = d
          }),
        ],
        assert
      )

      pipe(
        [
          file2.contents,
          concat(d => {
            data2 = d
          }),
        ],
        assert
      )
    })

    it("does not start flowing until all clones flows (data)", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: from(["wa", "dup"]),
      }
      const file = File.of(options)
      const file2 = file.clone()
      let ends = 2

      let data = ""
      let data2 = ""

      function assert() {
        if (--ends === 0) {
          expect(data).to.equal(data2)
        }
      }

      // Start flowing file2
      file2.contents!.on("data", chunk => {
        data2 += chunk.toString("utf8")
      })

      process.nextTick(() => {
        // Nothing was written yet
        expect(data).to.equal("")
        expect(data2).to.equal("")

        // Starts flowing file
        file.contents!.on("data", chunk => {
          data += chunk.toString("utf8")
        })
      })

      file2.contents!.on("end", assert)
      file.contents!.on("end", assert)
    })

    it("does not start flowing until all clones flows (readable)", done => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: from(["wa", "dup"]),
      }
      const file = File.of(options)
      const file2 = file.clone()

      let data2 = ""

      function assert(data) {
        expect(data.toString("utf8")).to.equal(data2)
      }

      // Start flowing file2
      file2.contents!.on("readable", function () {
        let chunk
        while ((chunk = this.read()) !== null) {
          data2 += chunk.toString()
        }
      })

      pipe([file.contents, concat(assert)], done)
    })

    it("copies all attributes over with null contents", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: null,
      }
      const file = new File(options)
      const file2 = file.clone()

      expect(file2).to.not.equal(file)
      expect(file2.cwd).to.equal(file.cwd)
      expect(file2.base).to.equal(file.base)
      expect(file2.path).to.equal(file.path)
      expect(file2.contents).to.not.exist
    })

    it("properly clones the `stat` property", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.js",
        contents: new Buffer("test"),
        stat: fs.statSync(__filename),
      }

      const file = new File(options)
      const copy = file.clone()

      expect(copy.stat!.isFile()).to.be.true
      expect(copy.stat!.isDirectory()).to.be.false
      expect(file.stat).to.be.instanceOf(fs.Stats)
      expect(copy.stat).to.be.instanceOf(fs.Stats)
    })

    it("properly clones the `history` property", () => {
      const options = {
        cwd: path.normalize("/"),
        base: path.normalize("/test/"),
        path: path.normalize("/test/test.js"),
        contents: new Buffer("test"),
      }

      const file = new File(options)
      const copy = file.clone()

      expect(copy.history[0]).to.equal(options.path)
      copy.path = "lol"
      expect(file.path).to.not.equal(copy.path)
    })

    it("copies custom properties", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: null,
        custom: { meta: {} },
      }

      const file = new File(options)
      const file2 = file.clone()

      expect(file2).to.not.equal(file)
      expect(file2.cwd).to.equal(file.cwd)
      expect(file2.base).to.equal(file.base)
      expect(file2.path).to.equal(file.path)
      expect(file2.custom).to.not.equal(file.custom)
      expect(file2.custom.meta).to.not.equal(file.custom.meta)
      expect(file2.custom).to.deep.equal(file.custom)
    })

    it("copies history", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: null,
      }
      const history = [
        path.normalize("/test/test.coffee"),
        path.normalize("/test/test.js"),
        path.normalize("/test/test-938di2s.js"),
      ]

      const file = new File(options)
      file.path = history[1]
      file.path = history[2]
      const file2 = file.clone()

      expect(file2.history).to.deep.equal(history)
      expect(file2.history).to.not.equal(file.history)
      expect(file2.path).to.equal(history[2])
    })

    it("supports deep & shallow copy of all attributes", () => {
      const options = {
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: null,
        custom: { meta: {} },
      }

      const file = new File(options)

      const file2 = file.clone()
      expect(file2.custom).to.deep.equal(file.custom)
      expect(file2.custom).to.not.equal(file.custom)
      expect(file2.custom.meta).to.deep.equal(file.custom.meta)
      expect(file2.custom.meta).to.not.equal(file.custom.meta)

      const file3 = file.clone(true)
      expect(file3.custom).to.deep.equal(file.custom)
      expect(file3.custom).to.not.equal(file.custom)
      expect(file3.custom.meta).to.deep.equal(file.custom.meta)
      expect(file3.custom.meta).to.not.equal(file.custom.meta)

      const file4 = file.clone({ deep: true })
      expect(file4.custom).to.deep.equal(file.custom)
      expect(file4.custom).to.not.equal(file.custom)
      expect(file4.custom.meta).to.deep.equal(file.custom.meta)
      expect(file4.custom.meta).to.not.equal(file.custom.meta)

      const file5 = file.clone(false)
      expect(file5.custom).to.equal(file.custom)
      expect(file5.custom).to.deep.equal(file.custom)
      expect(file5.custom.meta).to.deep.equal(file.custom.meta)
      expect(file5.custom.meta).to.equal(file.custom.meta)

      const file6 = file.clone({ deep: false })
      expect(file6.custom).to.deep.equal(file.custom)
      expect(file6.custom).to.equal(file.custom)
      expect(file6.custom.meta).to.deep.equal(file.custom.meta)
      expect(file6.custom.meta).to.equal(file.custom.meta)
    })

    it("supports inheritance", () => {
      class ExtendedFile extends File {}

      // Just copy static stuff since Object.setPrototypeOf is node >=0.12
      Object.keys(File).forEach(key => {
        ExtendedFile[key] = File[key]
      })

      const file = new ExtendedFile()
      const file2 = file.clone()

      expect(file2).to.not.equal(file)
      expect(file2).to.be.instanceOf(ExtendedFile)
      expect(file2).to.be.instanceOf(ExtendedFile)
      expect(file2).to.be.instanceOf(File)
      expect(ExtendedFile.prototype.isPrototypeOf(file2)).to.be.true
      expect(File.prototype.isPrototypeOf(file2)).to.be.true
    })
  })

  describe("inspect()", () => {
    it("returns correct format when no contents and no path", () => {
      const file = new File()
      const expectation = "<File >"
      expect(file.inspect()).to.equal(expectation)
      expect(util.inspect(file)).to.equal(expectation)
      if (util.inspect.custom) {
        expect(file[util.inspect.custom]()).to.equal(expectation)
      }
    })

    it("returns correct format when Buffer contents and no path", () => {
      const val = new Buffer("test")
      const file = new File({ contents: val })
      expect(file.inspect()).to.equal("<File <Buffer 74 65 73 74>>")
    })

    it("returns correct format when Buffer contents and relative path", () => {
      const val = new Buffer("test")
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: val,
      })
      expect(file.inspect()).to.equal('<File "test.coffee" <Buffer 74 65 73 74>>')
    })

    it("returns correct format when Stream contents and relative path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: from([]),
      })
      expect(file.inspect()).to.equal('<File "test.coffee" <CloneableStream>>')
    })

    it("returns correct format when null contents and relative path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
        contents: null,
      })
      expect(file.inspect()).to.equal('<File "test.coffee">')
    })
  })

  describe("contents get/set", () => {
    it("returns _contents", () => {
      const val = new Buffer("test")
      const file = new File()
      file["_contents"] = val
      expect(file.contents).to.deep.equal(val)
    })

    it("sets _contents", () => {
      const val = new Buffer("test")
      const file = new File()
      file.contents = val
      expect(file["_contents"]).to.deep.equal(val)
    })

    it("sets a Buffer", () => {
      const val = new Buffer("test")
      const file = new File()
      file.contents = val
      expect(file.contents).to.deep.equal(val)
    })

    it("wraps Stream in Cloneable", () => {
      const val = from([])
      const file = new File()
      file.contents = val
      expect(isCloneable(file.contents)).to.be.true
    })

    it("does not double wrap a Cloneable", () => {
      const val = from([])
      const clone = cloneable(val)
      const file = new File()
      file.contents = clone
      expect(file.contents!["_original"]).to.equal(val)
    })

    it("sets null", () => {
      const val = null
      const file = new File()
      file.contents = val
      expect(file.contents).to.be.null
    })

    it("does not set a string", () => {
      const val = "test"
      const file = new File()
      function invalid() {
        file.contents = val as any
      }
      expect(invalid).to.throw()
    })
  })

  describe("cwd get/set", () => {
    it("returns _cwd", () => {
      const val = "/test"
      const file = new File()
      file["_cwd"] = val
      expect(file.cwd).to.equal(val)
    })

    it("sets _cwd", () => {
      const val = "/test"
      const file = new File()
      file.cwd = val
      expect(file["_cwd"]).to.equal(path.normalize(val))
    })

    it("normalizes and removes trailing separator on set", () => {
      const val = "/test/foo/../foo/"
      const expected = path.normalize(val.slice(0, -1))
      const file = new File()

      file.cwd = val

      expect(file.cwd).to.equal(expected)

      const val2 = "\\test\\foo\\..\\foo\\"
      const expected2 = path.normalize(isWin ? val2.slice(0, -1) : val2)

      file.cwd = val2

      expect(file.cwd).to.equal(expected2)
    })

    it("throws on set with invalid values", () => {
      const invalidValues = ["", null, undefined, true, false, 0, Infinity, NaN, {}, []]
      const file = new File()

      invalidValues.forEach(val => {
        function invalid() {
          file.cwd = val as any
        }
        expect(invalid).to.throw("cwd must be a non-empty string.")
      })
    })
  })

  describe("base get/set", () => {
    it("proxies cwd when omitted", () => {
      const file = new File({ cwd: "/test" })
      expect(file.base).to.equal(file.cwd)
    })

    it("proxies cwd when same", () => {
      const file = new File({
        cwd: "/test",
        base: "/test",
      })
      file.cwd = "/foo/"
      expect(file.base).to.equal(file.cwd)

      const file2 = new File({
        cwd: "/test",
      })
      file2.base = "/test/"
      file2.cwd = "/foo/"
      expect(file2.base).to.equal(file.cwd)
    })

    it("proxies to cwd when set to same value", () => {
      const file = new File({
        cwd: "/foo",
        base: "/bar",
      })
      expect(file.base).to.not.equal(file.cwd)
      file.base = file.cwd
      expect(file.base).to.equal(file.cwd)
    })

    it("proxies to cwd when null or undefined", () => {
      const file = new File({
        cwd: "/foo",
        base: "/bar",
      })
      expect(file.base).to.not.equal(file.cwd)
      file.base = null as any
      expect(file.base).to.equal(file.cwd)
      file.base = "/bar/"
      expect(file.base).to.not.equal(file.cwd)
      file.base = undefined as any
      expect(file.base).to.equal(file.cwd)
    })

    it("returns _base", () => {
      const val = "/test/"
      const file = new File()
      file["_base"] = val
      expect(file.base).to.equal(val)
    })

    it("sets _base", () => {
      const val = "/test/foo"
      const file = new File()
      file.base = val
      expect(file["_base"]).to.equal(path.normalize(val))
    })

    it("normalizes and removes trailing separator on set", () => {
      const val = "/test/foo/../foo/"
      const expected = path.normalize(val.slice(0, -1))
      const file = new File()

      file.base = val

      expect(file.base).to.equal(expected)

      const val2 = "\\test\\foo\\..\\foo\\"
      const expected2 = path.normalize(isWin ? val2.slice(0, -1) : val2)

      file.base = val2

      expect(file.base).to.equal(expected2)
    })

    it("throws on set with invalid values", () => {
      const invalidValues = [true, false, 1, 0, Infinity, NaN, "", {}, []]
      const file = new File()

      invalidValues.forEach(val => {
        function invalid() {
          file.base = val as any
        }
        expect(invalid).to.throw("base must be a non-empty string, or null/undefined.")
      })
    })
  })

  describe("relative get/set", () => {
    it("throws on set", () => {
      const file = new File()

      function invalid() {
        file.relative = "test"
      }

      expect(invalid).to.throw(
        "File.relative is generated from the base and path attributes. Do not modify it."
      )
    })

    it("throws on get with no path", () => {
      const file = new File()

      function invalid() {
        file.relative
      }

      expect(invalid).to.throw("No path specified! Can not get relative.")
    })

    it("returns a relative path from base", () => {
      const file = new File({
        base: "/test/",
        path: "/test/test.coffee",
      })

      expect(file.relative).to.equal("test.coffee")
    })

    it("returns a relative path from cwd", () => {
      const file = new File({
        cwd: "/",
        path: "/test/test.coffee",
      })

      expect(file.relative).to.equal(path.normalize("test/test.coffee"))
    })

    it("does not append separator when directory", () => {
      const file = new File({
        base: "/test",
        path: "/test/foo/bar",
        stat: {
          isDirectory() {
            return true
          },
        } as any,
      })

      expect(file.relative).to.equal(path.normalize("foo/bar"))
    })

    it("does not append separator when symlink", () => {
      const file = new File({
        base: "/test",
        path: "/test/foo/bar",
        stat: {
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.relative).to.equal(path.normalize("foo/bar"))
    })

    it("does not append separator when directory & symlink", () => {
      const file = new File({
        base: "/test",
        path: "/test/foo/bar",
        stat: {
          isDirectory() {
            return true
          },
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.relative).to.equal(path.normalize("foo/bar"))
    })
  })

  describe("dirname get/set", () => {
    it("throws on get with no path", () => {
      const file = new File()

      function invalid() {
        file.dirname
      }

      expect(invalid).to.throw("No path specified! Can not get dirname.")
    })

    it("returns the dirname without trailing separator", () => {
      const file = new File({
        cwd: "/",
        base: "/test",
        path: "/test/test.coffee",
      })

      expect(file.dirname).to.equal(path.normalize("/test"))
    })

    it("throws on set with no path", () => {
      const file = new File()

      function invalid() {
        file.dirname = "/test"
      }

      expect(invalid).to.throw("No path specified! Can not set dirname.")
    })

    it("replaces the dirname of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      file.dirname = "/test/foo"
      expect(file.path).to.equal(path.normalize("/test/foo/test.coffee"))
    })
  })

  describe("basename get/set", () => {
    it("throws on get with no path", () => {
      const file = new File()

      function invalid() {
        file.basename
      }

      expect(invalid).to.throw("No path specified! Can not get basename.")
    })

    it("returns the basename of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      expect(file.basename).to.equal("test.coffee")
    })

    it("does not append trailing separator when directory", () => {
      const file = new File({
        path: "/test/foo",
        stat: {
          isDirectory() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("does not append trailing separator when symlink", () => {
      const file = new File({
        path: "/test/foo",
        stat: {
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("does not append trailing separator when directory & symlink", () => {
      const file = new File({
        path: "/test/foo",
        stat: {
          isDirectory() {
            return true
          },
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("removes trailing separator", () => {
      const file = new File({
        path: "/test/foo/",
      })

      expect(file.basename).to.equal("foo")
    })

    it("removes trailing separator when directory", () => {
      const file = new File({
        path: "/test/foo/",
        stat: {
          isDirectory() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("removes trailing separator when symlink", () => {
      const file = new File({
        path: "/test/foo/",
        stat: {
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("removes trailing separator when directory & symlink", () => {
      const file = new File({
        path: "/test/foo/",
        stat: {
          isDirectory() {
            return true
          },
          isSymbolicLink() {
            return true
          },
        } as any,
      })

      expect(file.basename).to.equal("foo")
    })

    it("throws on set with no path", () => {
      const file = new File()

      function invalid() {
        file.basename = "test.coffee"
      }

      expect(invalid).to.throw("No path specified! Can not set basename.")
    })

    it("replaces the basename of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      file.basename = "foo.png"
      expect(file.path).to.equal(path.normalize("/test/foo.png"))
    })
  })

  describe("stem get/set", () => {
    it("throws on get with no path", () => {
      const file = new File()

      function invalid() {
        file.stem
      }

      expect(invalid).to.throw("No path specified! Can not get stem.")
    })

    it("returns the stem of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      expect(file.stem).to.equal("test")
    })

    it("throws on set with no path", () => {
      const file = new File()

      function invalid() {
        file.stem = "test.coffee"
      }

      expect(invalid).to.throw("No path specified! Can not set stem.")
    })

    it("replaces the stem of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      file.stem = "foo"
      expect(file.path).to.equal(path.normalize("/test/foo.coffee"))
    })
  })

  describe("extname get/set", () => {
    it("throws on get with no path", () => {
      const file = new File()

      function invalid() {
        file.extname
      }

      expect(invalid).to.throw("No path specified! Can not get extname.")
    })

    it("returns the extname of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      expect(file.extname).to.equal(".coffee")
    })

    it("throws on set with no path", () => {
      const file = new File()

      function invalid() {
        file.extname = ".coffee"
      }

      expect(invalid).to.throw("No path specified! Can not set extname.")
    })

    it("replaces the extname of the path", () => {
      const file = new File({
        cwd: "/",
        base: "/test/",
        path: "/test/test.coffee",
      })

      file.extname = ".png"
      expect(file.path).to.equal(path.normalize("/test/test.png"))
    })
  })

  describe("path get/set", () => {
    it("records path in history upon instantiation", () => {
      const file = new File({
        cwd: "/",
        path: "/test/test.coffee",
      })
      const history = [path.normalize("/test/test.coffee")]

      expect(file.path).to.equal(history[0])
      expect(file.history).to.deep.equal(history)
    })

    it("records path in history when set", () => {
      const val = path.normalize("/test/test.js")
      const file = new File({
        cwd: "/",
        path: "/test/test.coffee",
      })
      const history = [path.normalize("/test/test.coffee"), val]

      file.path = val
      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(history)

      const val2 = path.normalize("/test/test.es6")
      history.push(val2)

      file.path = val2
      expect(file.path).to.equal(val2)
      expect(file.history).to.deep.equal(history)
    })

    it("does not record path in history when set to the current path", () => {
      const val = path.normalize("/test/test.coffee")
      const file = new File({
        cwd: "/",
        path: val,
      })
      const history = [val]

      file.path = val
      file.path = val
      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(history)
    })

    it("does not record path in history when set to empty string", () => {
      const val = path.normalize("/test/test.coffee")
      const file = new File({
        cwd: "/",
        path: val,
      })
      const history = [val]

      file.path = ""
      expect(file.path).to.equal(val)
      expect(file.history).to.deep.equal(history)
    })

    it("throws on set with null path", () => {
      const file = new File()

      expect(file.path).to.not.exist
      expect(file.history).to.deep.equal([])

      function invalid() {
        file.path = null as any
      }

      expect(invalid).to.throw("path should be a string.")
    })

    it("normalizes the path upon set", () => {
      const val = "/test/foo/../test.coffee"
      const expected = path.normalize(val)
      const file = new File()

      file.path = val

      expect(file.path).to.equal(expected)
      expect(file.history).to.deep.equal([expected])
    })

    it("removes the trailing separator upon set", () => {
      const file = new File()
      file.path = "/test/"

      expect(file.path).to.equal(path.normalize("/test"))
      expect(file.history).to.deep.equal([path.normalize("/test")])
    })

    it("removes the trailing separator upon set when directory", () => {
      const file = new File({
        stat: {
          isDirectory() {
            return true
          },
        } as any,
      })
      file.path = "/test/"

      expect(file.path).to.equal(path.normalize("/test"))
      expect(file.history).to.deep.equal([path.normalize("/test")])
    })

    it("removes the trailing separator upon set when symlink", () => {
      const file = new File({
        stat: {
          isSymbolicLink() {
            return true
          },
        } as any,
      })
      file.path = "/test/"

      expect(file.path).to.equal(path.normalize("/test"))
      expect(file.history).to.deep.equal([path.normalize("/test")])
    })

    it("removes the trailing separator upon set when directory & symlink", () => {
      const file = new File({
        stat: {
          isDirectory() {
            return true
          },
          isSymbolicLink() {
            return true
          },
        } as any,
      })
      file.path = "/test/"

      expect(file.path).to.equal(path.normalize("/test"))
      expect(file.history).to.deep.equal([path.normalize("/test")])
    })
  })

  describe("symlink get/set", () => {
    it("return null on get with no symlink", () => {
      const file = new File()

      expect(file.symlink).to.be.null
    })

    it("returns _symlink", () => {
      const val = "/test/test.coffee"
      const file = new File()
      file["_symlink"] = val

      expect(file.symlink).to.equal(val)
    })

    it("throws on set with non-string", () => {
      const file = new File()

      function invalid() {
        file.symlink = null
      }

      expect(invalid).to.throw("symlink should be a string")
    })

    it("sets _symlink", () => {
      const val = "/test/test.coffee"
      const expected = path.normalize(val)
      const file = new File()
      file.symlink = val

      expect(file["_symlink"]).to.equal(expected)
    })

    it("allows relative symlink", () => {
      const val = "test.coffee"
      const file = new File()
      file.symlink = val

      expect(file.symlink).to.equal(val)
    })

    it("normalizes and removes trailing separator upon set", () => {
      const val = "/test/foo/../bar/"
      const expected = path.normalize(val.slice(0, -1))
      const file = new File()
      file.symlink = val

      expect(file.symlink).to.equal(expected)
    })
  })
})
