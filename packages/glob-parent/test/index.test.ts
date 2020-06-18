import { expect } from "chai"
import "chai-as-promised"
import { globParent as gp } from "../index"

const isWin32 = process.platform === "win32"

describe("glob-parent", () => {
  it("should strip glob magic to return parent path", done => {
    expect(gp(".")).to.equal(".")
    expect(gp(".*")).to.equal(".")
    expect(gp("/.*")).to.equal("/")
    expect(gp("/.*/")).to.equal("/")
    expect(gp("a/.*/b")).to.equal("a")
    expect(gp("a*/.*/b")).to.equal(".")
    expect(gp("*/a/b/c")).to.equal(".")
    expect(gp("*")).to.equal(".")
    expect(gp("*/")).to.equal(".")
    expect(gp("*/*")).to.equal(".")
    expect(gp("*/*/")).to.equal(".")
    expect(gp("**")).to.equal(".")
    expect(gp("**/")).to.equal(".")
    expect(gp("**/*")).to.equal(".")
    expect(gp("**/*/")).to.equal(".")
    expect(gp("/*.js")).to.equal("/")
    expect(gp("*.js")).to.equal(".")
    expect(gp("**/*.js")).to.equal(".")
    expect(gp("{a,b}")).to.equal(".")
    expect(gp("/{a,b}")).to.equal("/")
    expect(gp("/{a,b}/")).to.equal("/")
    expect(gp("(a|b)")).to.equal(".")
    expect(gp("/(a|b)")).to.equal("/")
    expect(gp("./(a|b)")).to.equal(".")
    expect(gp("a/(b c)")).to.equal("a", "not an extglob")
    expect(gp("a/(b c)/")).to.equal("a/(b c)", "not an extglob")
    expect(gp("a/(b c)/d")).to.equal("a/(b c)", "not an extglob")
    expect(gp("path/to/*.js")).to.equal("path/to")
    expect(gp("/root/path/to/*.js")).to.equal("/root/path/to")
    expect(gp("chapter/foo [bar]/")).to.equal("chapter")
    expect(gp("path/[a-z]")).to.equal("path")
    expect(gp("[a-z]")).to.equal(".")
    expect(gp("path/{to,from}")).to.equal("path")
    expect(gp("path/(to|from)")).to.equal("path")
    expect(gp("path/(foo bar)/subdir/foo.*")).to.equal("path/(foo bar)/subdir")
    expect(gp("path/!(to|from)")).to.equal("path")
    expect(gp("path/?(to|from)")).to.equal("path")
    expect(gp("path/+(to|from)")).to.equal("path")
    expect(gp("path/*(to|from)")).to.equal("path")
    expect(gp("path/@(to|from)")).to.equal("path")
    expect(gp("path/!/foo")).to.equal("path/!")
    expect(gp("path/?/foo")).to.equal("path/?")
    expect(gp("path/+/foo")).to.equal("path/+")
    expect(gp("path/*/foo")).to.equal("path")
    expect(gp("path/@/foo")).to.equal("path/@")
    expect(gp("path/!/foo/")).to.equal("path/!/foo")
    expect(gp("path/?/foo/")).to.equal("path/?/foo")
    expect(gp("path/+/foo/")).to.equal("path/+/foo")
    expect(gp("path/*/foo/")).to.equal("path")
    expect(gp("path/@/foo/")).to.equal("path/@/foo")
    expect(gp("path/**/*")).to.equal("path")
    expect(gp("path/**/subdir/foo.*")).to.equal("path")
    expect(gp("path/subdir/**/foo.js")).to.equal("path/subdir")
    expect(gp("path/!subdir/foo.js")).to.equal("path/!subdir")
    expect(gp("path/{foo,bar}/")).to.equal("path")

    done()
  })

  it("should respect escaped characters", done => {
    expect(gp("path/\\*\\*/subdir/foo.*")).to.equal("path/**/subdir")
    expect(gp("path/\\[\\*\\]/subdir/foo.*")).to.equal("path/[*]/subdir")
    expect(gp("path/\\*(a|b)/subdir/foo.*")).to.equal("path")
    expect(gp("path/\\*/(a|b)/subdir/foo.*")).to.equal("path/*")
    expect(gp("path/\\*\\(a\\|b\\)/subdir/foo.*")).to.equal("path/*(a|b)/subdir")
    expect(gp("path/\\[foo bar\\]/subdir/foo.*")).to.equal("path/[foo bar]/subdir")
    expect(gp("path/\\[bar]/")).to.equal("path/[bar]")
    expect(gp("path/\\[bar]")).to.equal("path/[bar]")
    expect(gp("[bar]")).to.equal(".")
    expect(gp("[bar]/")).to.equal(".")
    expect(gp("./\\[bar]")).to.equal("./[bar]")
    expect(gp("\\[bar]/")).to.equal("[bar]")
    expect(gp("\\!dir/*")).to.equal("!dir")
    expect(gp("[bar\\]/")).to.equal(".")
    expect(gp("path/foo \\[bar]/")).to.equal("path/foo [bar]")
    expect(gp("path/\\{foo,bar}/")).to.equal("path/{foo,bar}")
    expect(gp("\\{foo,bar}/")).to.equal("{foo,bar}")
    expect(gp("\\{foo,bar\\}/")).to.equal("{foo,bar}")
    expect(gp("{foo,bar\\}/")).to.equal(".")

    if (isWin32) {
      // On Windows we are trying to flip backslashes foo-\\( → foo-/(
      expect(gp("foo-\\(bar\\).md")).to.equal("foo-")
    } else {
      expect(gp("foo-\\(bar\\).md")).to.equal(".")
      expect(gp("\\[bar]")).to.equal("[bar]")
      expect(gp("[bar\\]")).to.equal(".")
      expect(gp("\\{foo,bar\\}")).to.equal("{foo,bar}")
      expect(gp("{foo,bar\\}")).to.equal(".")
    }

    done()
  })

  it("should respect glob enclosures with embedded separators", done => {
    expect(gp("path/{,/,bar/baz,qux}/")).to.equal("path")
    expect(gp("path/\\{,/,bar/baz,qux}/")).to.equal("path/{,/,bar/baz,qux}")
    expect(gp("path/\\{,/,bar/baz,qux\\}/")).to.equal("path/{,/,bar/baz,qux}")
    expect(gp("/{,/,bar/baz,qux}/")).to.equal("/")
    expect(gp("/\\{,/,bar/baz,qux}/")).to.equal("/{,/,bar/baz,qux}")
    expect(gp("{,/,bar/baz,qux}")).to.equal(".")
    expect(gp("\\{,/,bar/baz,qux\\}")).to.equal("{,/,bar/baz,qux}")
    expect(gp("\\{,/,bar/baz,qux}/")).to.equal("{,/,bar/baz,qux}")
    expect(gp("path/foo[a\\/]/")).to.equal("path")
    expect(gp("path/foo\\[a\\/]/")).to.equal("path/foo[a\\/]")
    expect(gp("foo[a\\/]")).to.equal(".")
    expect(gp("foo\\[a\\/]")).to.equal("foo[a\\/]")
    expect(gp("path/(foo/bar|baz)")).to.equal("path")
    expect(gp("path/(foo/bar|baz)/")).to.equal("path")
    expect(gp("path/\\(foo/bar|baz)/")).to.equal("path/(foo/bar|baz)")

    done()
  })

  it("should handle nested braces", done => {
    expect(gp("path/{../,./,{bar,/baz\\},qux\\}/")).to.equal("path")
    expect(gp("path/{../,./,\\{bar,/baz},qux}/")).to.equal("path")
    expect(gp("path/\\{../,./,\\{bar,/baz\\},qux\\}/"), "path/{../,./,{bar,/baz},qux}")
    expect(gp("{../,./,{bar,/baz\\},qux\\}/")).to.equal(".")
    expect(gp("{../,./,{bar,/baz\\},qux\\}")).to.equal(".")
    expect(gp("path/{,/,bar/{baz,qux\\}}/")).to.equal("path")
    expect(gp("path/{,/,bar/{baz,qux}\\}/")).to.equal("path")
    // expect(gp('path/\\{../,./,{bar,/baz},qux}/'), 'path');

    done()
  })

  it("should return parent dirname from non-glob paths", done => {
    expect(gp("path")).to.equal(".")
    expect(gp("path/foo")).to.equal("path")
    expect(gp("path/foo/")).to.equal("path/foo")
    expect(gp("path/foo/bar.js")).to.equal("path/foo")

    done()
  })

  it("should respect disabled auto flip backslashes", done => {
    expect(gp("foo-\\(bar\\).md", { flipBackslashes: false })).to.equal(".")

    done()
  })
})

describe("glob2base test patterns", () => {
  it("should get a base name", done => {
    expect(gp("js/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from a nested glob", done => {
    expect(gp("js/**/test/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from a flat file", done => {
    expect(gp("js/test/wow.js")).to.equal("js/test")
    expect(gp("js/test/wow.js")).to.equal("js/test")

    done()
  })

  it("should get a base name from character class pattern", done => {
    expect(gp("js/t[a-z]st}/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from brace , expansion", done => {
    expect(gp("js/{src,test}/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from brace .. expansion", done => {
    expect(gp("js/test{0..9}/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from extglob", done => {
    expect(gp("js/t+(wo|est)/*.js")).to.equal("js")

    done()
  })

  it("should get a base name from a path with non-exglob parens", done => {
    expect(gp("js/t(wo|est)/*.js")).to.equal("js")
    expect(gp("js/t/(wo|est)/*.js")).to.equal("js/t")

    done()
  })

  it("should get a base name from a complex brace glob", done => {
    expect(gp("lib/{components,pages}/**/{test,another}/*.txt")).to.equal("lib")

    expect(gp("js/test/**/{images,components}/*.js")).to.equal("js/test")

    expect(gp("ooga/{booga,sooga}/**/dooga/{eooga,fooga}")).to.equal("ooga")

    done()
  })
})

if (isWin32) {
  describe("technically invalid windows globs", () => {
    it("should manage simple globs with backslash path separator", done => {
      expect(gp("C:\\path\\*.js")).to.equal("C:/path")

      done()
    })
  })
}
