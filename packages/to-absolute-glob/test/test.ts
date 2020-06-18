require("mocha")
import path from "path"
import assert from "assert"
import resolve from "./"
const sep = path.sep
let fixture
let actual

function unixify(filepath) {
  return filepath.replace(/\\/g, "/")
}

describe("resolve", () => {
  describe("posix", () => {
    it("should make a path absolute", () => {
      assert.equal(resolve("a"), unixify(path.resolve("a")))
    })

    it("should make a glob absolute", () => {
      assert.equal(resolve("a/*.js"), unixify(path.resolve("a/*.js")))
    })

    it("should retain trailing slashes", () => {
      actual = resolve("a/*/")
      assert.equal(actual, `${unixify(path.resolve("a/*"))}/`)
      assert.equal(actual.slice(-1), "/")
    })

    it("should retain trailing slashes with cwd", () => {
      fixture = "fixtures/whatsgoingon/*/"
      actual = resolve(fixture, { cwd: __dirname })
      assert.equal(actual, `${unixify(path.resolve(fixture))}/`)
      assert.equal(actual.slice(-1), "/")
    })

    it("should handle ./ at the beginnnig of a glob", () => {
      fixture = "./fixtures/whatsgoingon/*/"
      actual = resolve(fixture, { cwd: __dirname })
      assert.equal(actual, `${unixify(path.resolve(fixture))}/`)
    })

    it("should make a negative glob absolute", () => {
      actual = resolve("!a/*.js")
      assert.equal(actual, `!${unixify(path.resolve("a/*.js"))}`)
    })

    it("should make a negative extglob absolute", () => {
      actual = resolve("!(foo)")
      assert.equal(actual, unixify(path.resolve("!(foo)")))
    })

    it("should make an escaped negative extglob absolute", () => {
      actual = resolve("\\!(foo)")
      assert.equal(actual, `${unixify(path.resolve("."))}/\\!(foo)`)
    })

    it("should make a glob absolute from a cwd", () => {
      actual = resolve("a/*.js", { cwd: "foo" })
      assert.equal(actual, unixify(path.resolve("foo/a/*.js")))
    })

    it("should make a negative glob absolute from a cwd", () => {
      actual = resolve("!a/*.js", { cwd: "foo" })
      assert.equal(actual, `!${unixify(path.resolve("foo/a/*.js"))}`)
    })

    it("should make a glob absolute from a root path", () => {
      actual = resolve("/a/*.js", { root: "foo" })
      assert.equal(actual, unixify(path.resolve("foo/a/*.js")))
    })

    it("should make a glob absolute from a root slash", () => {
      actual = resolve("/a/*.js", { root: "/" })
      assert.equal(actual, unixify(path.resolve("/a/*.js")))
    })

    it("should make a glob absolute from a negative root path", () => {
      actual = resolve("!/a/*.js", { root: "foo" })
      assert.equal(actual, `!${unixify(path.resolve("foo/a/*.js"))}`)
    })

    it("should make a negative glob absolute from a negative root path", () => {
      actual = resolve("!/a/*.js", { root: "/" })
      assert.equal(actual, `!${unixify(path.resolve("/a/*.js"))}`)
    })
  })

  describe("windows", () => {
    it("should make an escaped negative extglob absolute", () => {
      actual = resolve("foo/bar\\!(baz)")
      assert.equal(actual, `${unixify(path.resolve("foo/bar"))}\\!(baz)`)
    })

    it("should make a glob absolute from a root path", () => {
      actual = resolve("/a/*.js", { root: "foo\\bar\\baz" })
      assert.equal(actual, unixify(path.resolve("foo/bar/baz/a/*.js")))
    })

    it("should make a glob absolute from a root slash", () => {
      actual = resolve("/a/*.js", { root: "\\" })
      assert.equal(actual, unixify(path.resolve("/a/*.js")))
    })
  })
})
