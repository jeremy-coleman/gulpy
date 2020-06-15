import { expect } from "chai"
import { settle } from "../"

describe("asyncSettle", () => {
  it("should transform success into settled success values", done => {
    const val = "value to be settled"
    settle(
      done => {
        done(null, val)
      },
      (err, result) => {
        expect(result).to.deep.include({
          state: "success",
          value: val,
        })
        done(err)
      }
    )
  })

  it("should transform errors into settled success values", done => {
    const error = new Error("Error to be settled")
    settle(
      done => {
        done(error)
      },
      (err, result) => {
        expect(result).to.deep.include({
          state: "error",
          value: error,
        })
        done(err)
      }
    )
  })
})
