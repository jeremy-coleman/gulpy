import { initial, last } from "lodash"

import { asyncDone } from "@local/async-done"
import * as nowAndLater from "now-and-later"
import * as helpers from "./helpers"

export function parallel(...rest) {
  let args = helpers.verifyArguments(rest)

  const extensions = helpers.getExtensions(last(args))

  if (extensions) {
    args = initial(args)
  }

  function parallel(done) {
    nowAndLater.map(args, (fn, _key, cb) => asyncDone(fn, cb), extensions, done)
  }

  return parallel
}
