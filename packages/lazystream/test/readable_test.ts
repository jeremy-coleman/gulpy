import { Readable } from "../"
import { DummyReadable } from "./helper"

export var readable = {
  dummy(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []

    test.expect(1)

    new DummyReadable([].concat(expected))
      .on("data", chunk => {
        actual.push(chunk.toString())
      })
      .on("end", () => {
        test.equal(
          actual.join(""),
          expected.join(""),
          "DummyReadable should produce the data it was created with"
        )
        test.done()
      })
  },
  options(test) {
    test.expect(3)

    const readable = new Readable(
      function ({ encoding }) {
        test.ok(
          this instanceof Readable,
          "Readable should bind itself to callback's this"
        )
        test.equal(
          encoding,
          "utf-8",
          "Readable should make options accessible to callback"
        )
        this.ok = true
        return new DummyReadable(["test"])
      },
      { encoding: "utf-8" }
    )

    readable.read(4)

    test.ok(readable.ok)

    test.done()
  },
  streams2(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []
    let instantiated = false

    test.expect(2)

    const readable = new Readable(() => {
      instantiated = true
      return new DummyReadable([].concat(expected))
    })

    test.equal(
      instantiated,
      false,
      "DummyReadable should only be instantiated when it is needed"
    )

    readable.on("readable", () => {
      let chunk
      while ((chunk = readable.read())) {
        actual.push(chunk.toString())
      }
    })
    readable.on("end", () => {
      test.equal(
        actual.join(""),
        expected.join(""),
        "Readable should not change the data of the underlying stream"
      )
      test.done()
    })

    readable.read(0)
  },
  resume(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []
    let instantiated = false

    test.expect(2)

    const readable = new Readable(() => {
      instantiated = true
      return new DummyReadable([].concat(expected))
    })

    readable.pause()

    readable.on("data", chunk => {
      actual.push(chunk.toString())
    })
    readable.on("end", () => {
      test.equal(
        actual.join(""),
        expected.join(""),
        "Readable should not change the data of the underlying stream"
      )
      test.done()
    })

    test.equal(
      instantiated,
      false,
      "DummyReadable should only be instantiated when it is needed"
    )

    readable.resume()
  },
}
