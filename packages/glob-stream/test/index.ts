import { expect } from "chai"
import globStream from "../"

import pipe from "pump"
import concat from "concat-stream"
import * as through2 from "through2"

import from from "from2"
import to from "flush-write-stream"

function deWindows(p) {
  return p.replace(/\\/g, "/")
}

const dir = deWindows(__dirname)

describe("glob-stream", () => {
  it("streams a single object when given a directory path", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/whatsgoingon`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("./fixtures/whatsgoingon", { cwd: dir }), concat(assert)], done)
  })

  it("streams a single object when given a file path", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("./fixtures/test.coffee", { cwd: dir }), concat(assert)], done)
  })

  it("streams only objects with directory paths when given a directory glob", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures/whatsgoingon`,
      path: `${dir}/fixtures/whatsgoingon/hey`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("./fixtures/whatsgoingon/*/", { cwd: dir }), concat(assert)], done)
  })

  it("streams only objects with file paths from a non-directory glob", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("./fixtures/*.coffee", { cwd: dir }), concat(assert)], done)
  })

  it("properly handles ( ) in cwd path", done => {
    const cwd = `${dir}/fixtures/has (parens)`

    const expected = {
      cwd,
      base: cwd,
      path: `${cwd}/test.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("*.dmc", { cwd }), concat(assert)], done)
  })

  it("sets the correct base when ( ) in glob", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures/has (parens)`,
      path: `${dir}/fixtures/has (parens)/test.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe(
      [globStream("./fixtures/has (parens)/*.dmc", { cwd: dir }), concat(assert)],
      done
    )
  })

  it("finds files in paths that contain ( ) when they match the glob", done => {
    const expected = [
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/has (parens)/test.dmc`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/stuff/run.dmc`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/stuff/test.dmc`,
      },
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.include(expected[0])
      expect(pathObjs).to.deep.include(expected[1])
      expect(pathObjs).to.deep.include(expected[2])
    }

    pipe([globStream("./fixtures/**/*.dmc", { cwd: dir }), concat(assert)], done)
  })

  // TODO: This doesn't seem to be testing that backpressure is respected
  it("respects backpressure and stream state", done => {
    const delayStream = through2.obj(function (data, enc, cb) {
      const self = this

      self.pause()
      setTimeout(() => {
        cb(null, data)
        self.resume()
      }, 500)
    })

    function assert({ length }) {
      expect(length).to.equal(2)
    }

    pipe(
      [globStream("./fixtures/stuff/*.dmc", { cwd: dir }), delayStream, concat(assert)],
      done
    )
  })

  it("properly orders objects when given multiple paths and specified base", done => {
    const base = `${dir}/fixtures`

    const expected = [
      {
        cwd: base,
        base,
        path: `${base}/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: base,
        base,
        path: `${base}/test.coffee`,
      },
      {
        cwd: base,
        base,
        path: `${base}/whatsgoingon/test.js`,
      },
    ]

    const paths = [
      "./whatsgoingon/hey/isaidhey/whatsgoingon/test.txt",
      "./test.coffee",
      "./whatsgoingon/test.js",
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.equal(expected)
    }

    pipe([globStream(paths, { cwd: base, base }), concat(assert)], done)
  })

  it("properly orders objects when given multiple paths and cwdbase", done => {
    const base = `${dir}/fixtures`

    const expected = [
      {
        cwd: base,
        base,
        path: `${base}/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: base,
        base,
        path: `${base}/test.coffee`,
      },
      {
        cwd: base,
        base,
        path: `${base}/whatsgoingon/test.js`,
      },
    ]

    const paths = [
      "./whatsgoingon/hey/isaidhey/whatsgoingon/test.txt",
      "./test.coffee",
      "./whatsgoingon/test.js",
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.equal(expected)
    }

    pipe([globStream(paths, { cwd: base, cwdbase: true }), concat(assert)], done)
  })

  it("properly orders objects when given multiple globs with globstars", done => {
    const expected = [
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/test.coffee`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/whatsgoingon/test.js`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/has (parens)/test.dmc`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/stuff/test.dmc`,
      },
    ]

    const globs = [
      "./fixtures/**/test.txt",
      "./fixtures/**/test.coffee",
      "./fixtures/**/test.js",
      "./fixtures/**/test.dmc",
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(5)
      expect(pathObjs).to.deep.equal(expected)
    }

    pipe([globStream(globs, { cwd: dir }), concat(assert)], done)
  })

  it("properly orders objects when given multiple absolute paths and no cwd", done => {
    const expected = [
      {
        cwd: process.cwd(),
        base: `${dir}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon`,
        path: `${dir}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: process.cwd(),
        base: `${dir}/fixtures`,
        path: `${dir}/fixtures/test.coffee`,
      },
      {
        cwd: process.cwd(),
        base: `${dir}/fixtures/whatsgoingon`,
        path: `${dir}/fixtures/whatsgoingon/test.js`,
      },
    ]

    const paths = [
      `${dir}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      `${dir}/fixtures/test.coffee`,
      `${dir}/fixtures/whatsgoingon/test.js`,
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.equal(expected)
    }

    pipe([globStream(paths), concat(assert)], done)
  })

  it("removes duplicate objects from the stream using default (path) filter", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    pipe(
      [
        globStream(["./fixtures/test.coffee", "./fixtures/*.coffee"], { cwd: dir }),
        concat(assert),
      ],
      done
    )
  })

  it("removes duplicate objects from the stream using custom string filter", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures/stuff`,
      path: `${dir}/fixtures/stuff/run.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    pipe(
      [
        globStream(["./fixtures/stuff/run.dmc", "./fixtures/stuff/test.dmc"], {
          cwd: dir,
          uniqueBy: "base",
        }),
        concat(assert),
      ],
      done
    )
  })

  it("removes duplicate objects from the stream using custom function filter", done => {
    const expected = [
      {
        cwd: dir,
        base: `${dir}/fixtures/stuff`,
        path: `${dir}/fixtures/stuff/run.dmc`,
      },
      {
        cwd: dir,
        base: `${dir}/fixtures/stuff`,
        path: `${dir}/fixtures/stuff/test.dmc`,
      },
    ]

    const uniqueBy = ({ path }) => path

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(2)
      expect(pathObjs).to.deep.include(expected[0])
      expect(pathObjs).to.deep.include(expected[1])
    }

    pipe(
      [globStream("./fixtures/stuff/*.dmc", { cwd: dir, uniqueBy }), concat(assert)],
      done
    )
  })

  it("ignores dotfiles without dot option", done => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    pipe([globStream("./fixtures/*swag", { cwd: dir }), concat(assert)], done)
  })

  it("finds dotfiles with dot option", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/.swag`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    pipe([globStream("./fixtures/*swag", { cwd: dir, dot: true }), concat(assert)], done)
  })

  it("removes dotfiles that match negative globs with dot option", done => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    pipe(
      [
        globStream(["./fixtures/*swag", "!./fixtures/**"], { cwd: dir, dot: true }),
        concat(assert),
      ],
      done
    )
  })

  it("respects pause/resume", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    const stream = globStream("./fixtures/test.coffee", { cwd: dir })
    stream.pause()

    pipe([stream, concat(assert)], done)

    setTimeout(() => {
      stream.resume()
    }, 1000)
  })

  it("works with direct paths and no cwd", done => {
    const expected = {
      cwd: process.cwd(),
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream(`${dir}/fixtures/test.coffee`), concat(assert)], done)
  })

  it("supports negative globs", done => {
    const expected = {
      cwd: process.cwd(),
      base: `${dir}/fixtures/stuff`,
      path: `${dir}/fixtures/stuff/run.dmc`,
    }

    const globs = [`${dir}/fixtures/stuff/*.dmc`, `!${dir}/fixtures/stuff/*test.dmc`]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    pipe([globStream(globs), concat(assert)], done)
  })

  it("supports negative file paths", done => {
    const expected = {
      cwd: process.cwd(),
      base: `${dir}/fixtures/stuff`,
      path: `${dir}/fixtures/stuff/run.dmc`,
    }

    const paths = [`${dir}/fixtures/stuff/*.dmc`, `!${dir}/fixtures/stuff/test.dmc`]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    pipe([globStream(paths), concat(assert)], done)
  })

  it("does not error when a negative glob removes all matches from a positive glob", done => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    pipe(
      [globStream(["./fixtures/**/*.js", "!./**/test.js"], { cwd: dir }), concat(assert)],
      done
    )
  })

  it("respects order of negative globs", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures/stuff`,
      path: `${dir}/fixtures/stuff/run.dmc`,
    }

    const globs = [
      "./fixtures/stuff/*",
      "!./fixtures/stuff/*.dmc",
      "./fixtures/stuff/run.dmc",
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream(globs, { cwd: dir }), concat(assert)], done)
  })

  it("ignores leading negative globs", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures/stuff`,
      path: `${dir}/fixtures/stuff/run.dmc`,
    }

    const globs = ["!./fixtures/stuff/*.dmc", "./fixtures/stuff/run.dmc"]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream(globs, { cwd: dir }), concat(assert)], done)
  })

  it("throws on invalid glob argument", done => {
    expect(() => globStream(42, { cwd: dir })).to.throw(/Invalid glob .* 0/)
    expect(() => globStream([".", 42], { cwd: dir })).to.throw(/Invalid glob .* 1/)
    done()
  })

  it("throws on missing positive glob", done => {
    expect(() => globStream("!c", { cwd: dir })).to.throw(/Missing positive glob/)
    expect(() => globStream(["!a", "!b"], { cwd: dir })).to.throw(/Missing positive glob/)
    done()
  })

  it("emits an error when file not found on singular path", done => {
    function assert(err) {
      expect(err).to.match(/File not found with singular glob/)
      done()
    }

    pipe([globStream("notfound"), concat()], assert)
  })

  it("does not emit an error when file not found on glob containing {}", done => {
    function assert(err) {
      expect(err).to.not.exist
      done()
    }

    pipe([globStream("notfound{a,b}"), concat()], assert)
  })

  it("does not emit an error on singular path when allowEmpty is true", done => {
    function assert(err) {
      expect(err).to.not.exist
      done()
    }

    pipe([globStream("notfound", { allowEmpty: true }), concat()], assert)
  })

  it("emits an error when a singular path in multiple paths not found", done => {
    function assert(err) {
      expect(err).toMatch(/File not found with singular glob/)
      done()
    }

    pipe(
      [globStream(["notfound", "./fixtures/whatsgoingon"], { cwd: dir }), concat()],
      assert
    )
  })

  it("emits an error when a singular path in multiple paths/globs not found", done => {
    function assert(err) {
      expect(err).toMatch(/File not found with singular glob/)
      done()
    }

    pipe(
      [globStream(["notfound", "./fixtures/*.coffee"], { cwd: dir }), concat()],
      assert
    )
  })

  it("resolves absolute paths when root option is given", done => {
    const expected = {
      cwd: process.cwd(),
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).toEqual(expected)
    }

    pipe([globStream("/test.coffee", { root: `${dir}/fixtures` }), concat(assert)], done)
  })
})

describe("options", () => {
  it("avoids mutation of options", done => {
    const defaultedOpts = {
      cwd: process.cwd(),
      dot: false,
      silent: true,
      nonull: false,
      cwdbase: false,
    }

    const opts = {}

    const stream = globStream(`${dir}/fixtures/stuff/run.dmc`, opts)
    expect(Object.keys(opts).length).to.equal(0)
    expect(opts).toNotEqual(defaultedOpts)

    pipe([stream, concat()], done)
  })

  describe("silent", () => {
    it("accepts a boolean", done => {
      pipe(
        [globStream(`${dir}/fixtures/stuff/run.dmc`, { silent: false }), concat()],
        done
      )
    })
  })

  describe("nonull", () => {
    it("accepts a boolean", done => {
      pipe([globStream("notfound{a,b}", { nonull: true }), concat()], done)
    })

    it("does not have any effect on our results", done => {
      function assert({ length }) {
        expect(length).to.equal(0)
      }

      pipe([globStream("notfound{a,b}", { nonull: true }), concat(assert)], done)
    })
  })

  describe("ignore", () => {
    it("accepts a string (in addition to array)", done => {
      const expected = {
        cwd: dir,
        base: `${dir}/fixtures/stuff`,
        path: `${dir}/fixtures/stuff/run.dmc`,
      }

      function assert(pathObjs) {
        expect(pathObjs.length).to.equal(1)
        expect(pathObjs[0]).toEqual(expected)
      }

      pipe(
        [
          globStream("./fixtures/stuff/*.dmc", {
            cwd: dir,
            ignore: "./fixtures/stuff/test.dmc",
          }),
          concat(assert),
        ],
        done
      )
    })

    it("supports the ignore option instead of negation", done => {
      const expected = {
        cwd: dir,
        base: `${dir}/fixtures/stuff`,
        path: `${dir}/fixtures/stuff/run.dmc`,
      }

      function assert(pathObjs) {
        expect(pathObjs.length).to.equal(1)
        expect(pathObjs[0]).toEqual(expected)
      }

      pipe(
        [
          globStream("./fixtures/stuff/*.dmc", {
            cwd: dir,
            ignore: ["./fixtures/stuff/test.dmc"],
          }),
          concat(assert),
        ],
        done
      )
    })

    it("supports the ignore option with dot option", done => {
      function assert({ length }) {
        expect(length).to.equal(0)
      }

      pipe(
        [
          globStream("./fixtures/*swag", {
            cwd: dir,
            dot: true,
            ignore: ["./fixtures/**"],
          }),
          concat(assert),
        ],
        done
      )
    })

    it("merges ignore option and negative globs", done => {
      const globs = ["./fixtures/stuff/*.dmc", "!./fixtures/stuff/test.dmc"]

      function assert({ length }) {
        expect(length).to.equal(0)
      }

      pipe(
        [
          globStream(globs, { cwd: dir, ignore: ["./fixtures/stuff/run.dmc"] }),
          concat(assert),
        ],
        done
      )
    })
  })
})
