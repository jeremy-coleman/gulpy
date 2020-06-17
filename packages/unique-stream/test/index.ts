import { expect } from "chai"
import unique from "../index"
import Stream from "stream"
import after from "after"

describe("unique stream", () => {
  function makeStream(type) {
    const s = new Stream()
    s.readable = true

    const n = 10
    const next = after(n * 2, () => {
      setImmediate(() => {
        s.emit("end")
      })
    })

    for (let k = 0; k < n * 2; k++) {
      const i = Math.floor(k / 2)
      setImmediate(() => {
        s.emit(
          "data",
          k % 2 === 0
            ? {
                type,
                name: `name ${i}`,
                number: i * 10,
              }
            : {
                type,
                number: i * 10,
                name: `name ${i}`,
              }
        )
        next()
      })
    }
    return s
  }

  it("should be able to uniqueify objects based on JSON data", done => {
    const aggregator = unique()
    makeStream("a").pipe(aggregator)
    makeStream("a").pipe(aggregator)

    let n = 0
    aggregator
      .on("data", () => {
        n++
      })
      .on("end", () => {
        expect(n).to.equal(10)
        done()
      })
  })

  it("should be able to uniqueify objects based on a property", done => {
    const aggregator = unique("number")
    makeStream("a").pipe(aggregator)
    makeStream("b").pipe(aggregator)

    let n = 0
    aggregator
      .on("data", () => {
        n++
      })
      .on("end", () => {
        expect(n).to.equal(10)
        done()
      })
  })

  it("should be able to uniqueify objects based on a function", done => {
    const aggregator = unique(({ name }) => name)

    makeStream("a").pipe(aggregator)
    makeStream("b").pipe(aggregator)

    let n = 0
    aggregator
      .on("data", () => {
        n++
      })
      .on("end", () => {
        expect(n).to.equal(10)
        done()
      })
  })

  it("should be able to handle uniqueness when not piped", done => {
    const stream = unique()
    let count = 0
    stream.on("data", data => {
      expect(data).to.equal("hello")
      count++
    })
    stream.on("end", () => {
      expect(count).to.equal(1)
      done()
    })
    stream.write("hello")
    stream.write("hello")
    stream.end()
  })

  it("can use a custom keystore", done => {
    const keyStore = {
      store: {},
      add(key) {
        this.store[key] = true
      },
      has(key) {
        return this.store[key] !== undefined
      },
    }

    const aggregator = unique("number", keyStore)
    makeStream("a").pipe(aggregator)
    makeStream("b").pipe(aggregator)

    let n = 0
    aggregator
      .on("data", () => {
        n++
      })
      .on("end", () => {
        expect(n).to.equal(10)
        done()
      })
  })
})
