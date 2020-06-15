import { expect } from "chai"

import { Undertaker } from "../mod"

import simple from "./fixtures/taskTree/simple"
import singleLevel from "./fixtures/taskTree/singleLevel"
import doubleLevel from "./fixtures/taskTree/doubleLevel"
import tripleLevel from "./fixtures/taskTree/tripleLevel"
import aliasSimple from "./fixtures/taskTree/aliasSimple"
import aliasNested from "./fixtures/taskTree/aliasNested"

function noop(done) {
  done()
}

describe("tree", () => {
  let taker

  beforeEach(done => {
    taker = new Undertaker()
    done()
  })

  it("should return a simple tree by default", done => {
    taker.task("test1", cb => {
      cb()
    })
    taker.task("test2", cb => {
      cb()
    })
    taker.task("test3", cb => {
      cb()
    })
    taker.task("error", cb => {
      cb()
    })

    const ser = taker.series("test1", "test2")
    const anon = cb => {
      cb()
    }
    anon.displayName = "<display name>"

    taker.task("ser", taker.series("test1", "test2"))
    taker.task("par", taker.parallel("test1", "test2", "test3"))
    taker.task("serpar", taker.series("ser", "par"))
    taker.task("serpar2", taker.series(ser, anon))
    taker.task(anon)

    const tree = taker.tree()

    expect(tree).to.deep.equal(simple)
    done()
  })

  it("should form a 1 level tree", done => {
    taker.task("fn1", cb => {
      cb()
    })
    taker.task("fn2", cb => {
      cb()
    })

    const tree = taker.tree({ deep: true })

    expect(tree).to.deep.equal(singleLevel)
    done()
  })

  it("should form a 2 level nested tree", done => {
    taker.task("fn1", cb => {
      cb()
    })
    taker.task("fn2", cb => {
      cb()
    })
    taker.task("fn3", taker.series("fn1", "fn2"))

    const tree = taker.tree({ deep: true })

    expect(tree).to.deep.equal(doubleLevel)
    done()
  })

  it("should form a 3 level nested tree", done => {
    taker.task(
      "fn1",
      taker.parallel(cb => {
        cb()
      }, noop)
    )
    taker.task(
      "fn2",
      taker.parallel(cb => {
        cb()
      }, noop)
    )
    taker.task("fn3", taker.series("fn1", "fn2"))

    const tree = taker.tree({ deep: true })

    expect(tree).to.deep.equal(tripleLevel)
    done()
  })

  it("should use the proper labels for aliased tasks (simple)", done => {
    const anon = cb => {
      cb()
    }
    taker.task(noop)
    taker.task("fn1", noop)
    taker.task("fn2", taker.task("noop"))
    taker.task("fn3", anon)
    taker.task("fn4", taker.task("fn3"))

    const tree = taker.tree({ deep: true })

    expect(tree).to.deep.equal(aliasSimple)
    done()
  })

  it("should use the proper labels for aliased tasks (nested)", done => {
    taker.task(noop)
    taker.task("fn1", noop)
    taker.task("fn2", taker.task("noop"))
    taker.task("fn3", cb => {
      cb()
    })
    taker.task(
      "ser",
      taker.series(
        noop,
        cb => {
          cb()
        },
        "fn1",
        "fn2",
        "fn3"
      )
    )
    taker.task(
      "par",
      taker.parallel(
        noop,
        cb => {
          cb()
        },
        "fn1",
        "fn2",
        "fn3"
      )
    )

    const tree = taker.tree({ deep: true })

    expect(tree).to.deep.equal(aliasNested)
    done()
  })
})
