import * as path from "path"

export function normalize(str: string) {
  return str === "" ? str : path.normalize(str)
}
