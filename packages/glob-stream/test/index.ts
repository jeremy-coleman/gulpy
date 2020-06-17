import { expect } from "chai"
import _globStream from "../"

import { pump } from "pump2"
import concat from "concat-stream"
import * as through2 from "through2"

const globStream = _globStream as any

describe("glob-stream", () => {
  it("streams a single object when given a directory path", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/whatsgoingon`,
    }

    function assert(pathObjects) {
      expect(pathObjects.length).to.equal(1)
      expect(pathObjects[0]).to.deep.equal(expected)
    }

    await pump(globStream("./fixtures/whatsgoingon", { cwd: __dirname }), concat(assert))
  })

  it("streams a single object when given a file path", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjects) {
      expect(pathObjects.length).to.equal(1)
      expect(pathObjects[0]).to.deep.equal(expected)
    }

    await pump(globStream("./fixtures/test.coffee", { cwd: __dirname }), concat(assert))
  })

  it("streams only objects with directory paths when given a directory glob", async done => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures/whatsgoingon`,
      path: `${__dirname}/fixtures/whatsgoingon/hey`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream("./fixtures/whatsgoingon/*/", { cwd: __dirname }),
      concat(assert)
    )
  })

  it("streams only objects with file paths from a non-directory glob", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream("./fixtures/*.coffee", { cwd: __dirname }), concat(assert))
  })

  it("properly handles ( ) in cwd path", async () => {
    const cwd = `${__dirname}/fixtures/has (parens)`

    const expected = {
      cwd,
      base: cwd,
      path: `${cwd}/test.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream("*.dmc", { cwd }), concat(assert))
  })

  it("sets the correct base when ( ) in glob", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures/has (parens)`,
      path: `${__dirname}/fixtures/has (parens)/test.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream("./fixtures/has (parens)/*.dmc", { cwd: __dirname }),
      concat(assert)
    )
  })

  it("finds files in paths that contain ( ) when they match the glob", async () => {
    const expected = [
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/has (parens)/test.dmc`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/stuff/run.dmc`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/stuff/test.dmc`,
      },
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.include(expected[0])
      expect(pathObjs).to.deep.include(expected[1])
      expect(pathObjs).to.deep.include(expected[2])
    }

    await pump(globStream("./fixtures/**/*.dmc", { cwd: __dirname }), concat(assert))
  })

  // TODO: This doesn't seem to be testing that back pressure is respected
  it("respects back pressure and stream state", async () => {
    const delayStream = through2.obj(function (data, _enc, cb) {
      this.pause()
      setTimeout(() => {
        cb(null, data)
        this.resume()
      }, 500)
    })

    function assert({ length }) {
      expect(length).to.equal(2)
    }

    await pump(
      globStream("./fixtures/stuff/*.dmc", { cwd: __dirname }),
      delayStream,
      concat(assert)
    )
  })

  it("properly orders objects when given multiple paths and specified base", async () => {
    const base = `${__dirname}/fixtures`

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

    await pump(globStream(paths, { cwd: base, base }), concat(assert))
  })

  it("properly orders objects when given multiple paths and cwdbase", async () => {
    const base = `${__dirname}/fixtures`

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

    await pump(globStream(paths, { cwd: base, cwdbase: true }), concat(assert))
  })

  it("properly orders objects when given multiple globs with globstars", async () => {
    const expected = [
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/test.coffee`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/whatsgoingon/test.js`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/has (parens)/test.dmc`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/stuff/test.dmc`,
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

    await pump(globStream(globs, { cwd: __dirname }), concat(assert))
  })

  it("properly orders objects when given multiple absolute paths and no cwd", async () => {
    const expected = [
      {
        cwd: process.cwd(),
        base: `${__dirname}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon`,
        path: `${__dirname}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      },
      {
        cwd: process.cwd(),
        base: `${__dirname}/fixtures`,
        path: `${__dirname}/fixtures/test.coffee`,
      },
      {
        cwd: process.cwd(),
        base: `${__dirname}/fixtures/whatsgoingon`,
        path: `${__dirname}/fixtures/whatsgoingon/test.js`,
      },
    ]

    const paths = [
      `${__dirname}/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt`,
      `${__dirname}/fixtures/test.coffee`,
      `${__dirname}/fixtures/whatsgoingon/test.js`,
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(3)
      expect(pathObjs).to.deep.equal(expected)
    }

    await pump(globStream(paths), concat(assert))
  })

  it("removes duplicate objects from the stream using default (path) filter", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream(["./fixtures/test.coffee", "./fixtures/*.coffee"], { cwd: __dirname }),
      concat(assert)
    )
  })

  it("removes duplicate objects from the stream using custom string filter", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures/stuff`,
      path: `${__dirname}/fixtures/stuff/run.dmc`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream(["./fixtures/stuff/run.dmc", "./fixtures/stuff/test.dmc"], {
        cwd: __dirname,
        uniqueBy: "base",
      }),
      concat(assert)
    )
  })

  it("removes duplicate objects from the stream using custom function filter", async () => {
    const expected = [
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures/stuff`,
        path: `${__dirname}/fixtures/stuff/run.dmc`,
      },
      {
        cwd: __dirname,
        base: `${__dirname}/fixtures/stuff`,
        path: `${__dirname}/fixtures/stuff/test.dmc`,
      },
    ]

    const uniqueBy = ({ path }) => path

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(2)
      expect(pathObjs).to.deep.include(expected[0])
      expect(pathObjs).to.deep.include(expected[1])
    }

    await pump(
      globStream("./fixtures/stuff/*.dmc", { cwd: __dirname, uniqueBy }),
      concat(assert)
    )
  })

  it("ignores dot files without dot option", async () => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    await pump(globStream("./fixtures/*swag", { cwd: __dirname }), concat(assert))
  })

  it("finds dot files with dot option", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/.swag`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream("./fixtures/*swag", { cwd: __dirname, dot: true }),
      concat(assert)
    )
  })

  it("removes dot files that match negative globs with dot option", async () => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    await pump(
      globStream(["./fixtures/*swag", "!./fixtures/**"], { cwd: __dirname, dot: true }),
      concat(assert)
    )
  })

  it("respects pause/resume", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    const stream = globStream("./fixtures/test.coffee", { cwd: __dirname })
    stream.pause()

    await pump(stream, concat(assert))

    setTimeout(() => {
      stream.resume()
    }, 1000)
  })

  it("works with direct paths and no cwd", async () => {
    const expected = {
      cwd: process.cwd(),
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream(`${__dirname}/fixtures/test.coffee`), concat(assert))
  })

  it("supports negative globs", async () => {
    const expected = {
      cwd: process.cwd(),
      base: `${__dirname}/fixtures/stuff`,
      path: `${__dirname}/fixtures/stuff/run.dmc`,
    }

    const globs = [
      `${__dirname}/fixtures/stuff/*.dmc`,
      `!${__dirname}/fixtures/stuff/*test.dmc`,
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream(globs), concat(assert))
  })

  it("supports negative file paths", async () => {
    const expected = {
      cwd: process.cwd(),
      base: `${__dirname}/fixtures/stuff`,
      path: `${__dirname}/fixtures/stuff/run.dmc`,
    }

    const paths = [
      `${__dirname}/fixtures/stuff/*.dmc`,
      `!${__dirname}/fixtures/stuff/test.dmc`,
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream(paths), concat(assert))
  })

  it("does not error when a negative glob removes all matches from a positive glob", async () => {
    function assert({ length }) {
      expect(length).to.equal(0)
    }

    await pump(
      globStream(["./fixtures/**/*.js", "!./**/test.js"], { cwd: __dirname }),
      concat(assert)
    )
  })

  it("respects order of negative globs", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures/stuff`,
      path: `${__dirname}/fixtures/stuff/run.dmc`,
    }

    const globs = [
      "./fixtures/stuff/*",
      "!./fixtures/stuff/*.dmc",
      "./fixtures/stuff/run.dmc",
    ]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream(globs, { cwd: __dirname }), concat(assert))
  })

  it("ignores leading negative globs", async () => {
    const expected = {
      cwd: __dirname,
      base: `${__dirname}/fixtures/stuff`,
      path: `${__dirname}/fixtures/stuff/run.dmc`,
    }

    const globs = ["!./fixtures/stuff/*.dmc", "./fixtures/stuff/run.dmc"]

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(globStream(globs, { cwd: __dirname }), concat(assert))
  })

  it("throws on invalid glob argument", () => {
    expect(() => globStream(42, { cwd: __dirname })).to.throw(/Invalid glob .* 0/)
    expect(() => globStream([".", 42], { cwd: __dirname })).to.throw(/Invalid glob .* 1/)
  })

  it("throws on missing positive glob", () => {
    expect(() => globStream("!c", { cwd: __dirname })).to.throw(/Missing positive glob/)
    expect(() => globStream(["!a", "!b"], { cwd: __dirname })).to.throw(
      /Missing positive glob/
    )
  })

  it("emits an error when file not found on singular path", () => {
    expect(pump(globStream("notfound"), concat())).to.eventually.throw(
      /File not found with singular glob/
    )
  })

  it("does not emit an error when file not found on glob containing {}", () => {
    expect(pump(globStream("notfound{a,b}"), concat())).to.eventually.be.fulfilled
  })

  it("does not emit an error on singular path when allowEmpty is true", () => {
    expect(pump(globStream("notfound", { allowEmpty: true }), concat())).to.eventually.be
      .fulfilled
  })

  it("emits an error when a singular path in multiple paths not found", () => {
    expect(
      pump(
        globStream(["notfound", "./fixtures/whatsgoingon"], { cwd: __dirname }),
        concat()
      )
    ).to.eventually.throw(/File not found with singular glob/)
  })

  it("emits an error when a singular path in multiple paths/globs not found", () => {
    expect(
      pump(globStream(["notfound", "./fixtures/*.coffee"], { cwd: __dirname }), concat())
    ).to.eventually.throw(/File not found with singular glob/)
  })

  it("resolves absolute paths when root option is given", async () => {
    const expected = {
      cwd: process.cwd(),
      base: `${__dirname}/fixtures`,
      path: `${__dirname}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(1)
      expect(pathObjs[0]).to.deep.equal(expected)
    }

    await pump(
      globStream("/test.coffee", { root: `${__dirname}/fixtures` }),
      concat(assert)
    )
  })
})

describe("options", () => {
  it("avoids mutation of options", async () => {
    const defaultedOpts = {
      cwd: process.cwd(),
      dot: false,
      silent: true,
      nonull: false,
      cwdbase: false,
    }

    const opts = {}

    const stream = globStream(`${__dirname}/fixtures/stuff/run.dmc`, opts)
    expect(Object.keys(opts).length).to.equal(0)
    expect(opts).to.not.equal(defaultedOpts)

    await pump(stream, concat())
  })

  describe("silent", () => {
    it("accepts a boolean", async () => {
      await pump(
        globStream(`${__dirname}/fixtures/stuff/run.dmc`, { silent: false }),
        concat()
      )
    })
  })

  describe("nonull", () => {
    it("accepts a boolean", async () => {
      await pump(globStream("notfound{a,b}", { nonull: true }), concat())
    })

    it("does not have any effect on our results", async () => {
      function assert({ length }) {
        expect(length).to.equal(0)
      }

      await pump(globStream("notfound{a,b}", { nonull: true }), concat(assert))
    })
  })

  describe("ignore", () => {
    it("accepts a string (in addition to array)", async () => {
      const expected = {
        cwd: __dirname,
        base: `${__dirname}/fixtures/stuff`,
        path: `${__dirname}/fixtures/stuff/run.dmc`,
      }

      function assert(pathObjs) {
        expect(pathObjs.length).to.equal(1)
        expect(pathObjs[0]).to.deep.equal(expected)
      }

      await pump(
        globStream("./fixtures/stuff/*.dmc", {
          cwd: __dirname,
          ignore: "./fixtures/stuff/test.dmc",
        }),
        concat(assert)
      )
    })

    it("supports the ignore option instead of negation", async () => {
      const expected = {
        cwd: __dirname,
        base: `${__dirname}/fixtures/stuff`,
        path: `${__dirname}/fixtures/stuff/run.dmc`,
      }

      function assert(pathObjs) {
        expect(pathObjs.length).to.equal(1)
        expect(pathObjs[0]).to.deep.equal(expected)
      }

      await pump(
        globStream("./fixtures/stuff/*.dmc", {
          cwd: __dirname,
          ignore: ["./fixtures/stuff/test.dmc"],
        }),
        concat(assert)
      )
    })

    it("supports the ignore option with dot option", async () => {
      function assert({ length }) {
        expect(length).to.equal(0)
      }

      await pump(
        globStream("./fixtures/*swag", {
          cwd: __dirname,
          dot: true,
          ignore: ["./fixtures/**"],
        }),
        concat(assert)
      )
    })

    it("merges ignore option and negative globs", async () => {
      const globs = ["./fixtures/stuff/*.dmc", "!./fixtures/stuff/test.dmc"]

      function assert({ length }) {
        expect(length).to.equal(0)
      }

      await pump(
        globStream(globs, { cwd: __dirname, ignore: ["./fixtures/stuff/run.dmc"] }),
        concat(assert)
      )
    })
  })
})
