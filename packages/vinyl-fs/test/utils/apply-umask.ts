import { isNumber } from "lodash"

function applyUmask(mode) {
  if (!isNumber(mode)) {
    mode = parseInt(mode, 8)
  }

  return mode & ~process.umask()
}

export default applyUmask
