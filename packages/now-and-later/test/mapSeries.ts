import { expect } from "chai"
import * as nal from "../index"

describe("mapSeries", () => {
  it("will execute without an extension object", done => {
    const initial = [1, 2, 3]

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.equal(result)
      done(err)
    })
  })

  it("should execute without a final callback", done => {
    const initial = [1, 2, 3]
    const result: number[] = []

    function iterator(value, _key, cb) {
      result.push(value)
      if (result.length === initial.length) {
        expect(initial).to.deep.equal(result)
        done()
      }
      cb(null, value)
    }

    nal.mapSeries(initial, iterator)
  })

  it("should execute with array", done => {
    const initial = [1, 2, 3]

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("executes with an empty array", done => {
    const initial = []

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("should execute with an object", done => {
    const initial = {
      test: 1,
      test2: 2,
      test3: 3,
    }

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("executes with an empty object", done => {
    const initial = {}

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("should throw if first argument is a non-object", done => {
    function nonObject() {
      nal.mapSeries("nope")
    }

    expect(nonObject).to.throw(Error)
    done()
  })

  it("should maintain order", done => {
    const callOrder: number[] = []

    function iterator(value, _key, cb) {
      setTimeout(() => {
        callOrder.push(value)
        cb(null, value * 2)
      }, value * 25)
    }

    nal.mapSeries([1, 3, 2], iterator, (err, result) => {
      expect(callOrder).to.deep.equal([1, 3, 2])
      expect(result).to.deep.equal([2, 6, 4])
      done(err)
    })
  })

  it("should not mutate the original array", done => {
    const initial = [1, 2, 3]

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial === result).to.deep.equal(false)
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("should fail when an error occurs", done => {
    function iterator(_value, _key, cb) {
      cb(new Error("Boom"))
    }

    nal.mapSeries([1, 2, 3], iterator, err => {
      expect(err).to.be.an("error")
      expect(err.message).to.deep.equal("Boom")
      done()
    })
  })

  it("should ignore multiple calls to the callback inside iterator", done => {
    const initial = [1, 2, 3]

    function iterator(value, _key, cb) {
      cb(null, value)
      cb(null, value * 2)
    }

    nal.mapSeries(initial, iterator, (err, result) => {
      expect(initial).to.deep.equal(result)
      done(err)
    })
  })

  it("should take extension points and call them for each function", done => {
    const initial = [1, 2, 3]
    const create: number[] = []
    const before: number[] = []
    const after: number[] = []

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    const extensions = {
      create(value, idx) {
        expect(initial).to.include(value)
        create[idx] = value
        return { idx, value }
      },
      before({ idx, value }) {
        before[idx] = value
      },
      after(result, { idx }) {
        after[idx] = result
      },
    }

    nal.mapSeries(initial, iterator, extensions, (err, result) => {
      expect(initial).to.deep.equal(create)
      expect(initial).to.deep.equal(before)
      expect(result).to.deep.equal(after)
      done(err)
    })
  })

  it("should call the error extension point upon error", done => {
    const initial = [1, 2, 3]
    let error = []

    function iterator(_value, _key, cb) {
      cb(new Error("Boom"))
    }

    const extensions = {
      create() {
        return {}
      },
      error(err) {
        error = err
      },
    }

    nal.mapSeries(initial, iterator, extensions, err => {
      expect(err).to.equal(error)
      done()
    })
  })

  it("should pass an empty object if falsy value is returned from create", done => {
    const initial = [1, 2, 3]

    function iterator(value, _key, cb) {
      cb(null, value)
    }

    const extensions = {
      create() {
        return null
      },
      before(storage) {
        expect(storage).to.be.an("object")
        expect(storage).to.deep.equal({})
      },
    }

    nal.mapSeries(initial, iterator, extensions, done)
  })

  it("passes the key as the second argument to iterator (array)", done => {
    const initial = [1, 2, 3]
    const results: number[] = []

    function iterator(value, key, cb) {
      results.push(key)
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, err => {
      expect(results).to.deep.equal(["0", "1", "2"])
      done(err)
    })
  })

  it("passes the key as the second argument to iterator (object)", done => {
    const initial = {
      test: 1,
      test2: 2,
      test3: 3,
    }
    const results: string[] = []

    function iterator(value, key, cb) {
      results.push(key)
      cb(null, value)
    }

    nal.mapSeries(initial, iterator, err => {
      expect(results).to.deep.equal(["test", "test2", "test3"])
      done(err)
    })
  })
})
