import { expect } from "chai"
import stream from "../readable"

// Need to wrap this to cause node-glob to emit an error
import * as fs from "fs"

function deWindows(p) {
  return p.replace(/\\/g, "/")
}

const pipe = miss.pipe
const concat = miss.concat
const through = miss.through

const dir = deWindows(__dirname)

describe("readable stream", () => {
  it("emits an error if there are no matches", done => {
    function assert({ message }) {
      expect(message).toMatch(/^File not found with singular glob/g)
      done()
    }

    pipe([stream("notfound", [], { cwd: dir }), concat()], assert)
  })

  it("throws an error if you try to write to it", done => {
    const gs = stream("notfound", [], { cwd: dir })

    try {
      gs.write({})
    } catch (err) {
      expect(err).to.exist
      done()
    }
  })

  it("does not throw an error if you push to it", done => {
    const stub = {
      cwd: dir,
      base: dir,
      path: dir,
    }

    const gs = stream("./fixtures/test.coffee", [], { cwd: dir })

    gs.push(stub)

    function assert(pathObjs) {
      expect(pathObjs.length).to.equal(2)
      expect(pathObjs[0]).toEqual(stub)
    }

    pipe([gs, concat(assert)], done)
  })

  it("accepts a file path", done => {
    const expected = {
      cwd: dir,
      base: `${dir}/fixtures`,
      path: `${dir}/fixtures/test.coffee`,
    }

    function assert(pathObjs) {
      expect(pathObjs.length).toBe(1)
      expect(pathObjs[0]).toMatch(expected)
    }

    pipe([stream("./fixtures/test.coffee", [], { cwd: dir }), concat(assert)], done)
  })

  it("accepts a glob", done => {
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
      expect(pathObjs.length).toBe(3)
      expect(pathObjs).toInclude(expected[0])
      expect(pathObjs).toInclude(expected[1])
      expect(pathObjs).toInclude(expected[2])
    }

    pipe([stream("./fixtures/**/*.dmc", [], { cwd: dir }), concat(assert)], done)
  })

  it("pauses the globber upon backpressure", done => {
    const gs = stream("./fixtures/**/*.dmc", [], { cwd: dir, highWaterMark: 1 })

    const spy = expect.spyOn(gs._globber, "pause").andCallThrough()

    function waiter(pathObj, _, cb) {
      setTimeout(() => {
        cb(null, pathObj)
      }, 500)
    }

    function assert({ length }) {
      expect(length).to.equal(3)
      expect(spy.calls.length).to.equal(2)
      spy.restore()
    }

    pipe([gs, through.obj({ highWaterMark: 1 }, waiter), concat(assert)], done)
  })

  it("destroys the stream with an error if no match is found", done => {
    const gs = stream("notfound", [])

    const spy = expect.spyOn(gs, "destroy").andCallThrough()

    function assert(err) {
      spy.restore()
      expect(spy).toHaveBeenCalledWith(err)
      expect(err).toMatch(/File not found with singular glob/)
      done()
    }

    pipe([gs, concat()], assert)
  })

  it("destroys the stream if node-glob errors", done => {
    const expectedError = new Error("Stubbed error")

    const gs = stream("./fixtures/**/*.dmc", [], { cwd: dir, silent: true })

    function stubError(dirpath, cb) {
      cb(expectedError)
    }

    const spy = expect.spyOn(gs, "destroy").andCallThrough()
    const fsStub = expect.spyOn(fs, "readdir").andCall(stubError)

    function assert(err) {
      fsStub.restore()
      spy.restore()
      expect(spy).toHaveBeenCalledWith(err)
      expect(err).toBe(expectedError)
      done()
    }

    pipe([gs, concat()], assert)
  })
})
