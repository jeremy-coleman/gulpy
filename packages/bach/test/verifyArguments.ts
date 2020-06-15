import { expect } from "chai"
import { verifyArguments } from "../lib/helpers"

function validArg() {}

describe("verifyArguments", () => {
  it("should act as pass-through for a valid set of arguments", done => {
    const args = [validArg, validArg]
    expect(verifyArguments(args)).to.equal(args)
    done()
  })

  it("should throw descriptive error message on invalid argument", done => {
    function invalid() {
      verifyArguments([validArg, "invalid", validArg])
    }

    expect(invalid).to.throw("Only functions can be combined, got string for argument 1")
    done()
  })

  it("should throw descriptive error message on when no arguments provided", done => {
    function empty() {
      verifyArguments([])
    }

    expect(empty).to.throw("A set of functions to combine is required")
    done()
  })
})
