import { expect } from "chai"
import is from "./"

describe("is-negated-glob", () => {
  describe("API", () => {
    it("should export a function", () => {
      expect(is).to.be.a("function")
    })

    it("should return an object", () => {
      expect(is("foo")).to.be.an("object")
    })

    it("should expose a negated property", () => {
      expect(is("foo").negated).to.be.a("boolean")
    })

    it("should expose an original property", () => {
      expect(is("foo").original).to.be.a("string")
      expect(is("foo").original).to.equal("foo")
    })

    it("should expose an pattern property", () => {
      expect(is("foo").pattern).to.be.a("string")
    })

    it("should throw an error when invalid args are passed", cb => {
      try {
        ;(is as any)()
        cb(new Error("expected an error"))
      } catch (err) {
        expect(err).to.exist
        expect(err.message, "expected a string")
        cb()
      }
    })
  })

  describe(".negated", () => {
    it("should be true when a pattern is negated", () => {
      expect(is("!foo").negated).to.be.true
    })

    it("should be false when the exclamation is escaped", () => {
      expect(is("\\!foo").negated).to.be.false
    })

    it("should be false when a pattern is not negated", () => {
      expect(is("foo").negated).to.be.false
    })

    it("should be false when a pattern is an extglob", () => {
      expect(is("!(foo)").negated).to.be.false
    })

    it("should be true when first paren is escaped", () => {
      expect(is("!\\(foo)").negated).to.be.true
    })
  })

  describe(".pattern", () => {
    it("should remove the leading `!` from a pattern", () => {
      expect(is("!foo").pattern, "foo")
    })

    it("should not remove the leading `!` from an extglob pattern", () => {
      expect(is("!(foo)").pattern, "!(foo)")
      expect(is("!(foo)").negated).to.be.false
    })
  })
})
