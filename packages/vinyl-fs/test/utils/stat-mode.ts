import * as fs from "fs"
import { MASK_MODE } from "../../lib/constants"

function masked(mode) {
  return mode & MASK_MODE
}

function statMode(outputPath) {
  return masked(fs.lstatSync(outputPath).mode)
}

export default statMode
