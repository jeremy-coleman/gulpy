/**
 * @git Last upstream commit: [d508f2e on 25 May 2019](https://github.com/micromatch/is-extglob/commit/d508f2ed92ddaf8deef6d64d2f749ca1322f883e).
 */

import { isString } from "lodash"

/*!
 * is-extglob <https://github.com/jonschlinkert/is-extglob>
 *
 * Copyright (c) 2014-2016, Jon Schlinkert.
 * Licensed under the MIT License.
 */

const regex = /(\\).|([@?!+*]\(.*\))/
export function isExtGlob(str: string) {
  if (!isString(str) || str === "") {
    return false
  }

  let match: RegExpExecArray | null
  while ((match = regex.exec(str))) {
    if (match[2]) return true
    str = str.slice(match.index + match[0].length)
  }

  return false
}
