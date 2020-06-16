import * as fs from "fs"
import * as constants from "../../lib/constants"

function masked(mode) {
  return mode & constants.MASK_MODE
}

function statMode(outputPath) {
  return masked(fs.lstatSync(outputPath).mode)
}

export default statMode
