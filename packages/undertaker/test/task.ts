import { expect } from "chai"

import { Undertaker } from "../mod"

function noop(done) {
  done()
}

function anon() {}
anon.displayName = ""

describe("task", () => {
  let taker

  beforeEach(done => {
    taker = new Undertaker()
    done()
  })

  it("should register a named function", done => {
    taker.task(noop)
    expect(taker.task("noop").unwrap()).to.equal(noop)
    done()
  })

  it("should register an anonymous function by string name", done => {
    taker.task("test1", anon)
    expect(taker.task("test1").unwrap()).to.equal(anon)
    done()
  })

  it("should register an anonymous function by displayName property", done => {
    anon.displayName = "<display name>"
    taker.task(anon)
    expect(taker.task("<display name>").unwrap()).to.equal(anon)
    delete anon.displayName
    done()
  })

  it("should throw on register an anonymous function without string name", done => {
    function noName() {
      taker.task(() => {})
    }

    expect(noName).to.throw("Task name must be specified")
    done()
  })

  it("should register a named function by string name", done => {
    taker.task("test1", noop)
    expect(taker.task("test1").unwrap()).to.equal(noop)
    done()
  })

  it("should not get a task that was not registered", done => {
    expect(taker.task("test1")).to.equal(undefined)
    done()
  })

  it("should get a task that was registered", done => {
    taker.task("test1", noop)
    expect(taker.task("test1").unwrap()).to.equal(noop)
    done()
  })

  it("should get the wrapped task, not original function", done => {
    const registry = taker.registry()
    taker.task("test1", noop)
    expect(taker.task("test1").unwrap).to.be.a("function")
    expect(taker.task("test1")).to.equal(registry.get("test1"))
    done()
  })

  it("provides an `unwrap` method to get the original function", done => {
    taker.task("test1", noop)
    expect(taker.task("test1").unwrap).to.be.a("function")
    expect(taker.task("test1").unwrap()).to.equal(noop)
    done()
  })

  it("should return a function that was registered in some other way", done => {
    taker.registry()._tasks.set("test1", noop)
    expect(taker.task("test1")).to.equal(noop)
    done()
  })

  it("should prefer displayName instead of name when both properties are defined", done => {
    function fn() {}
    fn.displayName = "test1"
    taker.task(fn)
    expect(taker.task("test1").unwrap()).to.equal(fn)
    done()
  })

  it("should allow different tasks to refer to the same function", done => {
    function fn() {}
    taker.task("foo", fn)
    taker.task("bar", fn)
    expect(taker.task("foo").unwrap()).to.equal(taker.task("bar").unwrap())
    done()
  })

  it("should allow using aliased tasks in composite tasks", done => {
    let count = 0
    function fn(cb) {
      count++
      cb()
    }

    taker.task("foo", fn)
    taker.task("bar", fn)

    const series = taker.series("foo", "bar", cb => {
      expect(count).to.equal(2)
      cb()
    })

    const parallel = taker.parallel("foo", "bar", cb => {
      setTimeout(() => {
        expect(count).to.equal(4)
        cb()
      }, 500)
    })

    taker.series(series, parallel)(done)
  })

  it("should allow composite tasks tasks to be aliased", done => {
    let count = 0
    function fn1(cb) {
      count += 1
      cb()
    }
    function fn2(cb) {
      count += 2
      cb()
    }

    taker.task("ser", taker.series(fn1, fn2))
    taker.task("foo", taker.task("ser"))

    taker.task("par", taker.parallel(fn1, fn2))
    taker.task("bar", taker.task("par"))

    const series = taker.series("foo", cb => {
      expect(count).to.equal(3)
      cb()
    })

    const parallel = taker.series("bar", cb => {
      setTimeout(() => {
        expect(count).to.equal(6)
        cb()
      }, 500)
    })

    taker.series(series, parallel)(done)
  })
})
