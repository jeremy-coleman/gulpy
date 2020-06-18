import { Writable } from "../"
import { DummyWritable } from "./helper"

export var writable = {
  options(test) {
    test.expect(3)

    const writable = new Writable(
      function ({ encoding }) {
        test.ok(
          this instanceof Writable,
          "Writable should bind itself to callback's this"
        )
        test.equal(
          encoding,
          "utf-8",
          "Writable should make options accessible to callback"
        )
        this.ok = true
        return new DummyWritable([])
      },
      { encoding: "utf-8" }
    )

    writable.write("test")

    test.ok(writable.ok)

    test.done()
  },
  dummy(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []

    test.expect(0)

    const dummy = new DummyWritable(actual)

    expected.forEach(item => {
      dummy.write(new Buffer(item))
    })
    test.done()
  },
  streams2(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []
    let instantiated = false

    test.expect(2)

    const writable = new Writable(() => {
      instantiated = true
      return new DummyWritable(actual)
    })

    test.equal(
      instantiated,
      false,
      "DummyWritable should only be instantiated when it is needed"
    )

    writable.on("end", () => {
      test.equal(
        actual.join(""),
        expected.join(""),
        "Writable should not change the data of the underlying stream"
      )
      test.done()
    })

    expected.forEach(item => {
      writable.write(new Buffer(item))
    })
    writable.end()
  },
}
