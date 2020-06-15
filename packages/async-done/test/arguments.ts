import expect from "expect"
import { asyncDone } from "../"

function twoArg(cb) {
  cb(null, 1, 2)
}

describe("arguments", () => {
  it("passes all arguments to the completion callback", done => {
    asyncDone(twoArg, (err, arg1, arg2) => {
      expect(arg1).toEqual(1)
      expect(arg2).toEqual(2)
      done(err)
    })
  })
})
