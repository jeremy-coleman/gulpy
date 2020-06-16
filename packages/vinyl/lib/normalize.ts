import path from "path"

function normalize(str: string) {
  return str === "" ? str : path.normalize(str)
}

export default normalize
