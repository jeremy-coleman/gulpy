import { expect } from "chai"
import * as bach from "../"
import type { Done } from "undertaker"

function fn1(done: Done) {
  done(null, 1)
}

function fn2(done: Done) {
  setTimeout(() => {
    done(null, 2)
  }, 500)
}

function fn3(done: Done) {
  done(null, 3)
}

function fnError(done: Done) {
  done(new Error("An Error Occurred"))
}

describe("settleParallel", () => {
  it("should execute functions in parallel, passing settled results", done => {
    bach.settleParallel(
      fn1,
      fn2,
      fn3
    )((errors, results) => {
      expect(errors).to.be.null
      expect(results).to.deep.equal([1, 2, 3])
      done()
    })
  })

  it("should execute functions in parallel, passing settled errors and results", done => {
    function slowFn(done) {
      setTimeout(() => {
        done(null, 2)
      }, 500)
    }
    bach.settleParallel(
      fn1,
      slowFn,
      fn3,
      fnError
    )((errors, results) => {
      expect(errors).to.be.an("array")
      expect(errors[0]).to.be.an("error")
      expect(results).to.deep.equal([1, 2, 3])
      done()
    })
  })

  it("should take extension points and call them for each function", done => {
    const arr: Function[] = []
    const fns = [fn1, fn2, fn3]
    bach.settleParallel(fn1, fn2, fn3, {
      create(fn, idx) {
        expect(fns).to.include(fn)
        arr[idx] = fn
        return arr
      },
      before(storage) {
        expect(storage).to.equal(arr)
      },
      after(result, storage) {
        expect(storage).to.equal(arr)
      },
    })(error => {
      expect(error).to.be.null
      expect(arr).to.equal(fns)
    })
    done()
  })
})
