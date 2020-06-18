import { isString } from "lodash"

export default function isNegatedGlob(pattern: string) {
  if (!isString(pattern)) {
    throw TypeError("expected a string")
  }

  const glob = { negated: false, pattern, original: pattern }
  if (pattern[0] === "!" && pattern[1] !== "(") {
    glob.negated = true
    glob.pattern = pattern.slice(1)
  }

  return glob
}
