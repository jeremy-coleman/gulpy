/**
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */
import { expect } from "chai"
import { isGlob } from "../"

describe("isGlob", () => {
  describe("glob patterns", () => {
    it("should be true if it is a glob pattern:", () => {
      expect(isGlob("@.(?abc)")).to.be.false
      expect(isGlob("*.js")).to.be.true
      expect(isGlob("!*.js")).to.be.true
      expect(isGlob("!foo")).to.be.true
      expect(isGlob("!foo.js")).to.be.true
      expect(isGlob("**/abc.js")).to.be.true
      expect(isGlob("abc/*.js")).to.be.true
      expect(isGlob("@.(?:abc)")).to.be.true
      expect(isGlob("@.(?!abc)")).to.be.true
    })

    it("should not match escaped globs", () => {
      expect(isGlob("\\!\\*.js")).to.be.false
      expect(isGlob("\\!foo")).to.be.false
      expect(isGlob("\\!foo.js")).to.be.false
      expect(isGlob("\\*(foo).js")).to.be.false
      expect(isGlob("\\*.js")).to.be.false
      expect(isGlob("\\*\\*/abc.js")).to.be.false
      expect(isGlob("abc/\\*.js")).to.be.false
    })

    it("should be false if the value is not a string:", () => {
      expect((isGlob as any)()).to.be.false
      expect(isGlob(null as any)).to.be.false
      expect(isGlob(["**/*.js"] as any)).to.be.false
      expect(isGlob(["foo.js"] as any)).to.be.false
    })

    it("should be false if it is not a glob pattern:", () => {
      expect(isGlob("")).to.be.false
      expect(isGlob("~/abc")).to.be.false
      expect(isGlob("~/abc")).to.be.false
      expect(isGlob("~/(abc)")).to.be.false
      expect(isGlob("+~(abc)")).to.be.false
      expect(isGlob(".")).to.be.false
      expect(isGlob("@.(abc)")).to.be.false
      expect(isGlob("aa")).to.be.false
      expect(isGlob("who?")).to.be.false
      expect(isGlob("why!?")).to.be.false
      expect(isGlob("where???")).to.be.false
      expect(isGlob("abc!/def/!ghi.js")).to.be.false
      expect(isGlob("abc.js")).to.be.false
      expect(isGlob("abc/def/!ghi.js")).to.be.false
      expect(isGlob("abc/def/ghi.js")).to.be.false
    })
  })

  describe("regex capture groups", () => {
    it("should be true if the path has a regex capture group:", () => {
      expect(isGlob("abc/(?!foo).js")).to.be.true
      expect(isGlob("abc/(?:foo).js")).to.be.true
      expect(isGlob("abc/(?=foo).js")).to.be.true
      expect(isGlob("abc/(a|b).js")).to.be.true
      expect(isGlob("abc/(a|b|c).js")).to.be.true
      expect(isGlob("abc/(foo bar)/*.js"), "not a capture group but has a glob").to.be
        .true
    })

    it("should be true if the path has parens but is not a valid capture group", () => {
      expect(isGlob("abc/(?foo).js"), "invalid capture group").to.be.false
      expect(isGlob("abc/(a b c).js"), "unlikely to be a capture group").to.be.false
      expect(isGlob("abc/(ab).js"), "unlikely to be a capture group").to.be.false
      expect(isGlob("abc/(abc).js"), "unlikely to be a capture group").to.be.false
      expect(isGlob("abc/(foo bar).js"), "unlikely to be a capture group").to.be.false
    })

    it("should be false if the capture group is imbalanced:", () => {
      expect(isGlob("abc/(?ab.js")).to.be.false
      expect(isGlob("abc/(ab.js")).to.be.false
      expect(isGlob("abc/(a|b.js")).to.be.false
      expect(isGlob("abc/(a|b|c.js")).to.be.false
    })

    it("should be false if the group is escaped:", () => {
      expect(isGlob("abc/\\(a|b).js")).to.be.false
      expect(isGlob("abc/\\(a|b|c).js")).to.be.false
    })

    it("should be true if glob chars exist and `options.strict` is false", () => {
      expect(isGlob("$(abc)", { strict: false })).to.be.true
      expect(isGlob("&(abc)", { strict: false })).to.be.true
      expect(isGlob("? (abc)", { strict: false })).to.be.true
      expect(isGlob("?.js", { strict: false })).to.be.true
      expect(isGlob("abc/(?ab.js", { strict: false })).to.be.true
      expect(isGlob("abc/(ab.js", { strict: false })).to.be.true
      expect(isGlob("abc/(a|b.js", { strict: false })).to.be.true
      expect(isGlob("abc/(a|b|c.js", { strict: false })).to.be.true
      expect(isGlob("abc/(foo).js", { strict: false })).to.be.true
      expect(isGlob("abc/?.js", { strict: false })).to.be.true
      expect(isGlob("abc/[1-3.js", { strict: false })).to.be.true
      expect(isGlob("abc/[^abc.js", { strict: false })).to.be.true
      expect(isGlob("abc/[abc.js", { strict: false })).to.be.true
      expect(isGlob("abc/foo?.js", { strict: false })).to.be.true
      expect(isGlob("abc/{abc.js", { strict: false })).to.be.true
      expect(isGlob("Who?.js", { strict: false })).to.be.true
    })

    it("should be false if the first delim is escaped and options.strict is false:", () => {
      expect(isGlob("abc/\\(a|b).js", { strict: false })).to.be.false
      expect(isGlob("abc/(a|b\\).js")).to.be.false
      expect(isGlob("abc/\\(a|b|c).js", { strict: false })).to.be.false
      expect(isGlob("abc/\\(a|b|c.js", { strict: false })).to.be.false
      expect(isGlob("abc/\\[abc].js", { strict: false })).to.be.false
      expect(isGlob("abc/\\[abc.js", { strict: false })).to.be.false

      expect(isGlob("abc/(a|b\\).js", { strict: false })).to.be.true
    })
  })

  describe("regex character classes", () => {
    it("should be true if the path has a regex character class:", () => {
      expect(isGlob("abc/[abc].js")).to.be.true
      expect(isGlob("abc/[^abc].js")).to.be.true
      expect(isGlob("abc/[1-3].js")).to.be.true
    })

    it("should be false if the character class is not balanced:", () => {
      expect(isGlob("abc/[abc.js")).to.be.false
      expect(isGlob("abc/[^abc.js")).to.be.false
      expect(isGlob("abc/[1-3.js")).to.be.false
    })

    it("should be false if the character class is escaped:", () => {
      expect(isGlob("abc/\\[abc].js")).to.be.false
      expect(isGlob("abc/\\[^abc].js")).to.be.false
      expect(isGlob("abc/\\[1-3].js")).to.be.false
    })
  })

  describe("brace patterns", () => {
    it("should be true if the path has brace characters:", () => {
      expect(isGlob("abc/{a,b}.js")).to.be.true
      expect(isGlob("abc/{a..z}.js")).to.be.true
      expect(isGlob("abc/{a..z..2}.js")).to.be.true
    })

    it("should be false if (basic) braces are not balanced:", () => {
      expect(isGlob("abc/\\{a,b}.js")).to.be.false
      expect(isGlob("abc/\\{a..z}.js")).to.be.false
      expect(isGlob("abc/\\{a..z..2}.js")).to.be.false
    })
  })

  describe("regex patterns", () => {
    it("should be true if the path has regex characters:", () => {
      expect(isGlob("$(abc)")).to.be.false
      expect(isGlob("&(abc)")).to.be.false
      expect(isGlob("Who?.js")).to.be.false
      expect(isGlob("? (abc)")).to.be.false
      expect(isGlob("?.js")).to.be.false
      expect(isGlob("abc/?.js")).to.be.false

      expect(isGlob("!&(abc)")).to.be.true
      expect(isGlob("!*.js")).to.be.true
      expect(isGlob("!foo")).to.be.true
      expect(isGlob("!foo.js")).to.be.true
      expect(isGlob("**/abc.js")).to.be.true
      expect(isGlob("*.js")).to.be.true
      expect(isGlob("*z(abc)")).to.be.true
      expect(isGlob("[1-10].js")).to.be.true
      expect(isGlob("[^abc].js")).to.be.true
      expect(isGlob("[a-j]*[^c]b/c")).to.be.true
      expect(isGlob("[abc].js")).to.be.true
      expect(isGlob("a/b/c/[a-z].js")).to.be.true
      expect(isGlob("abc/(aaa|bbb).js")).to.be.true
      expect(isGlob("abc/*.js")).to.be.true
      expect(isGlob("abc/{a,b}.js")).to.be.true
      expect(isGlob("abc/{a..z..2}.js")).to.be.true
      expect(isGlob("abc/{a..z}.js")).to.be.true
    })

    it("should be false if regex characters are escaped", () => {
      expect(isGlob("\\?.js")).to.be.false
      expect(isGlob("\\[1-10\\].js")).to.be.false
      expect(isGlob("\\[^abc\\].js")).to.be.false
      expect(isGlob("\\[a-j\\]\\*\\[^c\\]b/c")).to.be.false
      expect(isGlob("\\[abc\\].js")).to.be.false
      expect(isGlob("\\a/b/c/\\[a-z\\].js")).to.be.false
      expect(isGlob("abc/\\(aaa|bbb).js")).to.be.false
      expect(isGlob("abc/\\?.js")).to.be.false
    })
  })

  describe("extglob patterns", () => {
    it("should be true if it has an extglob:", () => {
      expect(isGlob("abc/!(a).js")).to.be.true
      expect(isGlob("abc/!(a|b).js")).to.be.true
      expect(isGlob("abc/(ab)*.js")).to.be.true
      expect(isGlob("abc/(a|b).js")).to.be.true
      expect(isGlob("abc/*(a).js")).to.be.true
      expect(isGlob("abc/*(a|b).js")).to.be.true
      expect(isGlob("abc/+(a).js")).to.be.true
      expect(isGlob("abc/+(a|b).js")).to.be.true
      expect(isGlob("abc/?(a).js")).to.be.true
      expect(isGlob("abc/?(a|b).js")).to.be.true
      expect(isGlob("abc/@(a).js")).to.be.true
      expect(isGlob("abc/@(a|b).js")).to.be.true
    })

    it("should be false if extglob characters are escaped:", () => {
      expect(isGlob("abc/\\*.js")).to.be.false
      expect(isGlob("abc/\\*\\*.js")).to.be.false
      expect(isGlob("abc/\\@(a).js")).to.be.false
      expect(isGlob("abc/\\!(a).js")).to.be.false
      expect(isGlob("abc/\\+(a).js")).to.be.false
      expect(isGlob("abc/\\*(a).js")).to.be.false
      expect(isGlob("abc/\\?(a).js")).to.be.false
      expect(isGlob("abc/\\@(a|b).js"), "matches since extglob is not escaped").to.be.true
      expect(isGlob("abc/\\!(a|b).js"), "matches since extglob is not escaped").to.be.true
      expect(isGlob("abc/\\+(a|b).js"), "matches since extglob is not escaped").to.be.true
      expect(isGlob("abc/\\*(a|b).js"), "matches since extglob is not escaped").to.be.true
      expect(isGlob("abc/\\?(a|b).js"), "matches since extglob is not escaped").to.be.true
      expect(isGlob("abc/\\@(a\\|b).js"), "matches since extglob is not escaped").to.be
        .true
      expect(isGlob("abc/\\!(a\\|b).js"), "matches since extglob is not escaped").to.be
        .true
      expect(isGlob("abc/\\+(a\\|b).js"), "matches since extglob is not escaped").to.be
        .true
      expect(isGlob("abc/\\*(a\\|b).js"), "matches since extglob is not escaped").to.be
        .true
      expect(isGlob("abc/\\?(a\\|b).js"), "matches since extglob is not escaped").to.be
        .true
    })

    it("should not return true for non-extglob parens", () => {
      expect(isGlob("C:/Program Files (x86)/")).to.be.false
    })

    it("should be true if it has glob characters and is not a valid path:", () => {
      expect(isGlob("abc/[*].js")).to.be.true
      expect(isGlob("abc/*.js")).to.be.true
    })

    it("should be false if it is a valid non-glob path:", () => {
      expect(isGlob("abc/?.js")).to.be.false
      expect(isGlob("abc/!.js")).to.be.false
      expect(isGlob("abc/@.js")).to.be.false
      expect(isGlob("abc/+.js")).to.be.false
    })
  })

  describe("isGlob", () => {
    it("should return true when the string has an extglob:", () => {
      expect(isGlob("?(abc)")).to.be.true
      expect(isGlob("@(abc)")).to.be.true
      expect(isGlob("!(abc)")).to.be.true
      expect(isGlob("*(abc)")).to.be.true
      expect(isGlob("+(abc)")).to.be.true
      expect(isGlob("xyz/?(abc)/xyz")).to.be.true
      expect(isGlob("xyz/@(abc)/xyz")).to.be.true
      expect(isGlob("xyz/!(abc)/xyz")).to.be.true
      expect(isGlob("xyz/*(abc)/xyz")).to.be.true
      expect(isGlob("xyz/+(abc)/xyz")).to.be.true
      expect(isGlob("?(abc|xyz)/xyz")).to.be.true
      expect(isGlob("@(abc|xyz)")).to.be.true
      expect(isGlob("!(abc|xyz)")).to.be.true
      expect(isGlob("*(abc|xyz)")).to.be.true
      expect(isGlob("+(abc|xyz)")).to.be.true
    })

    it("should not match escaped extglobs", () => {
      expect(isGlob("\\?(abc)")).to.be.false
      expect(isGlob("\\@(abc)")).to.be.false
      expect(isGlob("\\!(abc)")).to.be.false
      expect(isGlob("\\*(abc)")).to.be.false
      expect(isGlob("\\+(abc)")).to.be.false
      expect(isGlob("xyz/\\?(abc)/xyz")).to.be.false
      expect(isGlob("xyz/\\@(abc)/xyz")).to.be.false
      expect(isGlob("xyz/\\!(abc)/xyz")).to.be.false
      expect(isGlob("xyz/\\*(abc)/xyz")).to.be.false
      expect(isGlob("xyz/\\+(abc)/xyz")).to.be.false
    })

    it("should detect when an glob is in the same pattern as an escaped glob", () => {
      expect(isGlob("\\?(abc|xyz)/xyz")).to.be.true
      expect(isGlob("\\@(abc|xyz)")).to.be.true
      expect(isGlob("\\!(abc|xyz)")).to.be.true
      expect(isGlob("\\*(abc|xyz)")).to.be.true
      expect(isGlob("\\+(abc|xyz)")).to.be.true
      expect(isGlob("\\?(abc)/?(abc)")).to.be.true
      expect(isGlob("\\@(abc)/@(abc)")).to.be.true
      expect(isGlob("\\!(abc)/!(abc)")).to.be.true
      expect(isGlob("\\*(abc)/*(abc)")).to.be.true
      expect(isGlob("\\+(abc)/+(abc)")).to.be.true
      expect(isGlob("xyz/\\?(abc)/xyz/def/?(abc)/xyz")).to.be.true
      expect(isGlob("xyz/\\@(abc)/xyz/def/@(abc)/xyz")).to.be.true
      expect(isGlob("xyz/\\!(abc)/xyz/def/!(abc)/xyz")).to.be.true
      expect(isGlob("xyz/\\*(abc)/xyz/def/*(abc)/xyz")).to.be.true
      expect(isGlob("xyz/\\+(abc)/xyz/def/+(abc)/xyz")).to.be.true
      expect(isGlob("\\?(abc|xyz)/xyz/?(abc|xyz)/xyz")).to.be.true
      expect(isGlob("\\@(abc|xyz)/@(abc|xyz)")).to.be.true
      expect(isGlob("\\!(abc|xyz)/!(abc|xyz)")).to.be.true
      expect(isGlob("\\*(abc|xyz)/*(abc|xyz)")).to.be.true
      expect(isGlob("\\+(abc|xyz)/+(abc|xyz)")).to.be.true
    })
  })
})
