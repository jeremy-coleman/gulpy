import { initial, last } from "lodash"

import { settle } from "async-settle"
import * as nowAndLater from "now-and-later"
import * as helpers from "./helpers"

function iterator(fn, _key, cb) {
  return settle(fn, cb)
}

export function settleSeries(...rest) {
  let args = helpers.verifyArguments(rest)

  const extensions = helpers.getExtensions(last(args))

  if (extensions) {
    args = initial(args)
  }

  function settleSeries(done) {
    const onSettled = helpers.onSettled(done)
    nowAndLater.mapSeries(args, iterator, extensions, onSettled)
  }

  return settleSeries
}
