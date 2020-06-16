import path from "path"

function normalize(str) {
  return str === "" ? str : path.normalize(str)
}

export default normalize
