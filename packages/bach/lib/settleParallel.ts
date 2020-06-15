import { initial, last } from "lodash-es"

import { settle } from "async-settle"
import * as nowAndLater from "now-and-later"
import * as helpers from "./helpers"

function iterator(fn, _key, cb) {
  return settle(fn, cb)
}

export function settleParallel(...rest) {
  let args = helpers.verifyArguments(rest)

  const extensions = helpers.getExtensions(last(args))

  if (extensions) {
    args = initial(args)
  }

  function settleParallel(done) {
    const onSettled = helpers.onSettled(done)
    nowAndLater.map(args, iterator, extensions, onSettled)
  }

  return settleParallel
}
