import * as path from "path"
import { assert } from "chai"
import { toAbsoluteGlob as resolve } from "../"

function unix(filepath: string) {
  return filepath.replace(/\\/g, "/")
}

describe("resolve", () => {
  describe("posix", () => {
    it("should make a path absolute", () => {
      assert.equal(resolve("a"), unix(path.resolve("a")))
    })

    it("should make a glob absolute", () => {
      assert.equal(resolve("a/*.js"), unix(path.resolve("a/*.js")))
    })

    it("should retain trailing slashes", () => {
      const actual = resolve("a/*/")
      assert.equal(actual, `${unix(path.resolve("a/*"))}/`)
      assert.equal(actual.slice(-1), "/")
    })

    it("should retain trailing slashes with cwd", () => {
      const fixture = "fixtures/whatsgoingon/*/"
      const actual = resolve(fixture, { cwd: __dirname })
      assert.equal(actual, `${unix(path.resolve(__dirname, fixture))}/`)
      assert.equal(actual.slice(-1), "/")
    })

    it("should handle ./ at the beginning of a glob", () => {
      const fixture = "./fixtures/whatsgoingon/*/"
      const actual = resolve(fixture, { cwd: __dirname })
      assert.equal(actual, `${unix(path.resolve(__dirname, fixture))}/`)
    })

    it("should make a negative glob absolute", () => {
      const actual = resolve("!a/*.js")
      assert.equal(actual, `!${unix(path.resolve("a/*.js"))}`)
    })

    it("should make a negative extglob absolute", () => {
      const actual = resolve("!(foo)")
      assert.equal(actual, unix(path.resolve("!(foo)")))
    })

    it("should make an escaped negative extglob absolute", () => {
      const actual = resolve("\\!(foo)")
      assert.equal(actual, `${unix(path.resolve("."))}/\\!(foo)`)
    })

    it("should make a glob absolute from a cwd", () => {
      const actual = resolve("a/*.js", { cwd: "foo" })
      assert.equal(actual, unix(path.resolve("foo/a/*.js")))
    })

    it("should make a negative glob absolute from a cwd", () => {
      const actual = resolve("!a/*.js", { cwd: "foo" })
      assert.equal(actual, `!${unix(path.resolve("foo/a/*.js"))}`)
    })

    it("should make a glob absolute from a root path", () => {
      const actual = resolve("/a/*.js", { root: "foo" })
      assert.equal(actual, unix(path.resolve("foo/a/*.js")))
    })

    it("should make a glob absolute from a root slash", () => {
      const actual = resolve("/a/*.js", { root: "/" })
      assert.equal(actual, unix(path.resolve("/a/*.js")))
    })

    it("should make a glob absolute from a negative root path", () => {
      const actual = resolve("!/a/*.js", { root: "foo" })
      assert.equal(actual, `!${unix(path.resolve("foo/a/*.js"))}`)
    })

    it("should make a negative glob absolute from a negative root path", () => {
      const actual = resolve("!/a/*.js", { root: "/" })
      assert.equal(actual, `!${unix(path.resolve("/a/*.js"))}`)
    })
  })

  describe("windows", () => {
    it("should make an escaped negative extglob absolute", () => {
      const actual = resolve("foo/bar\\!(baz)")
      assert.equal(actual, `${unix(path.resolve("foo/bar"))}\\!(baz)`)
    })

    it("should make a glob absolute from a root path", () => {
      const actual = resolve("/a/*.js", { root: "foo\\bar\\baz" })
      assert.equal(actual, unix(path.resolve("foo/bar/baz/a/*.js")))
    })

    it("should make a glob absolute from a root slash", () => {
      const actual = resolve("/a/*.js", { root: "\\" })
      assert.equal(actual, unix(path.resolve("/a/*.js")))
    })
  })
})
