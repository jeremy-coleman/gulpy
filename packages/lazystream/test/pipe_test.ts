import stream from "../lib/lazystream"
import helper from "./helper"

export var pipe = {
  readwrite(test) {
    const expected = ["line1\n", "line2\n"]
    const actual = []
    let readableInstantiated = false
    let writableInstantiated = false

    test.expect(3)

    const readable = new stream.Readable(() => {
      readableInstantiated = true
      return new helper.DummyReadable([].concat(expected))
    })

    const writable = new stream.Writable(() => {
      writableInstantiated = true
      return new helper.DummyWritable(actual)
    })

    test.equal(
      readableInstantiated,
      false,
      "DummyReadable should only be instantiated when it is needed"
    )
    test.equal(
      writableInstantiated,
      false,
      "DummyWritable should only be instantiated when it is needed"
    )

    writable.on("end", () => {
      test.equal(
        actual.join(""),
        expected.join(""),
        "Piping on demand streams should keep data intact"
      )
      test.done()
    })

    readable.pipe(writable)
  },
}
