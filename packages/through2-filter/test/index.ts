import { assert, expect } from "chai"
import * as filter from "../index"
import spigot from "stream-spigot"
import { concat } from "concat-stream"

function combine(records: Buffer) {
  expect(records).to.have.lengthOf(3, "Correct number of remaining records")
  expect(records.filter(({ skip }: any) => skip)).to.be.empty // "No remaining skip records"
}

describe("through2-filter", () => {
  it("ctor", () => {
    const Filter = filter.ctor(({ skip }) => !skip)

    spigot({ objectMode: true }, [
      { foo: "bar" },
      { foo: "baz", skip: true },
      { foo: "bif", skip: true },
      { foo: "blah" },
      { foo: "buzz" },
    ])
      .pipe(new Filter({ objectMode: true }))
      .pipe(concat(combine))
  })

  it("objCtor", () => {
    const Filter = filter.objCtor(({ skip }) => !skip)

    spigot({ objectMode: true }, [
      { foo: "bar" },
      { foo: "baz", skip: true },
      { foo: "bif", skip: true },
      { foo: "blah" },
      { foo: "buzz" },
    ])
      .pipe(new Filter())
      .pipe(concat(combine))
  })

  it("ctor buffer wantStrings", () => {
    const Filter = filter.ctor(({ length }) => length <= 5, { wantStrings: true })

    function combine(result) {
      expect(result.toString()).to.equal("abuvwxyz", "result is correct")
    }

    spigot(["a", "b", "cskipk", "lmnopqrstskip", "u", "vwxyz"])
      .pipe(new Filter())
      .pipe(concat(combine))
  })

  it("simple", () => {
    const f = filter.make(({ skip }) => !skip, { objectMode: true })

    spigot({ objectMode: true }, [
      { foo: "bar" },
      { foo: "baz", skip: true },
      { foo: "bif", skip: true },
      { foo: "blah" },
      { foo: "buzz" },
    ])
      .pipe(f)
      .pipe(concat(combine))
  })

  it("simple .obj", () => {
    const f = filter.obj(({ skip }) => !skip)

    spigot({ objectMode: true }, [
      { foo: "bar" },
      { foo: "baz", skip: true },
      { foo: "bif", skip: true },
      { foo: "blah" },
      { foo: "buzz" },
    ])
      .pipe(f)
      .pipe(concat(combine))
  })

  it("simple buffer", () => {
    const f = filter.make(({ length }) => length <= 5, { objectMode: true })

    function combine(result) {
      expect(result.toString()).to.equal("abuvwxyz", "result is correct")
    }

    spigot(["a", "b", "cdefghijk", "lmnopqrst", "u", "vwxyz"])
      .pipe(f)
      .pipe(concat(combine))
  })

  it("simple buffer wantStrings", () => {
    const f = filter.make(({ length }) => length <= 5, { wantStrings: true })

    function combine(result) {
      expect(result.toString()).to.equal("abuvwxyz", "result is correct")
    }

    spigot(["a", "b", "cskipk", "lmnopqrstskip", "u", "vwxyz"])
      .pipe(f)
      .pipe(concat(combine))
  })

  it("simple index", () => {
    const f = filter.make((_, index) => index < 2, { objectMode: true })

    function combine(records) {
      expect(records).to.deep.equal([{ foo: "bar" }, { foo: "baz" }], "Expected content")
    }

    spigot({ objectMode: true }, [
      { foo: "bar" },
      { foo: "baz" },
      { foo: "bif" },
      { foo: "blah" },
      { foo: "buzz" },
    ])
      .pipe(f)
      .pipe(concat(combine))
  })

  it("error", () => {
    const f = filter.make(() => {
      throw Error("Error in filter function")
    })

    function end() {
      assert.fail("Should not end")
    }

    spigot(["a", "b", "cdefghijk", "lmnopqrst", "u", "vwxyz"])
      .pipe(f)
      .on("end", end)
      .on("error", err => {
        expect(err).to.be.instanceof(Error, "Caught error")
      })
  })
})
