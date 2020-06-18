import * as path from "path"
import * as os from "os"
import { expect } from "chai"
import replaceExt from "../index"

describe("replace-ext", () => {
  it("returns a valid replaced extension on long path", () => {
    const fname = path.join(__dirname, "./fixtures/test.coffee")
    const expected = path.join(__dirname, "./fixtures/test.js")
    const result = replaceExt(fname, ".js")
    expect(result).to.equal(expected)
  })

  it("returns a valid replaced extension on basename", () => {
    const fname = "test.coffee"
    const expected = "test.js"
    const result = replaceExt(fname, ".js")
    expect(result).to.equal(expected)
  })

  it("should not return a valid replaced extension on empty string", () => {
    const fname = ""
    const expected = ""
    const result = replaceExt(fname, ".js")
    expect(result).to.equal(expected)
  })

  it("returns a valid removed extension on long path", () => {
    const fname = path.join(__dirname, "./fixtures/test.coffee")
    const expected = path.join(__dirname, "./fixtures/test")
    const result = replaceExt(fname, "")
    expect(result).to.equal(expected)
  })

  it("returns a valid added extension on long path", () => {
    const fname = path.join(__dirname, "./fixtures/test")
    const expected = path.join(__dirname, "./fixtures/test.js")
    const result = replaceExt(fname, ".js")
    expect(result).to.equal(expected)
  })

  it("should not replace when 1st arg is not a string (null)", () => {
    const result = replaceExt(null as any, ".js")
    expect(result).to.equal(null)
  })

  it("should not replace when 1st arg is not a string (object)", () => {
    const obj = {}
    const result = replaceExt(obj as any, ".js")
    expect(result).to.equal(obj)
  })

  it("Should preserve the first dot of relative dir name.", () => {
    if (process.platform === "win32") {
      expect(replaceExt("a/b/c.js", ".ts")).to.equal("a\\b\\c.ts")
      expect(replaceExt("./a/b/c.js", ".ts")).to.equal(".\\a\\b\\c.ts")
      expect(replaceExt("../a/b/c.js", ".ts")).to.equal("..\\a\\b\\c.ts")
      expect(replaceExt("/a/b/c.js", ".ts")).to.equal("\\a\\b\\c.ts")

      expect(replaceExt("C:/a/b/c.js", ".ts")).to.equal("C:\\a\\b\\c.ts")

      expect(replaceExt("a\\b\\c.js", ".ts")).to.equal("a\\b\\c.ts")
      expect(replaceExt(".\\a\\b\\c.js", ".ts")).to.equal(".\\a\\b\\c.ts")
      expect(replaceExt("..\\a\\b\\c.js", ".ts")).to.equal("..\\a\\b\\c.ts")
      expect(replaceExt("\\a\\b\\c.js", ".ts")).to.equal("\\a\\b\\c.ts")

      expect(replaceExt("C:\\a\\b\\c.js", ".ts")).to.equal("C:\\a\\b\\c.ts")
    } else {
      expect(replaceExt("a/b/c.js", ".ts")).to.equal("a/b/c.ts")
      expect(replaceExt("./a/b/c.js", ".ts")).to.equal("./a/b/c.ts")
      expect(replaceExt("../a/b/c.js", ".ts")).to.equal("../a/b/c.ts")
      expect(replaceExt("/a/b/c.js", ".ts")).to.equal("/a/b/c.ts")
    }
  })
})
