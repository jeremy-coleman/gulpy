import concat from "../../"
import { spawn } from "child_process"
import { exec } from "child_process"
import { expect } from "chai"

describe("concat-stream", () => {
  it("ls command", () => {
    const cmd = spawn("ls", [__dirname])
    cmd.stdout.pipe(
      concat(out => {
        exec(`ls ${__dirname}`, (_err, body) => {
          expect(out.toString("utf8")).to.equal(body)
        })
      })
    )
  })
})
