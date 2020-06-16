import { initial, last } from "lodash"
import { asyncDone } from "async-done"
import * as nowAndLater from "now-and-later"
import * as helpers from "./helpers"

function iterator(fn, _key, cb) {
  return asyncDone(fn, cb)
}

export function series(...rest) {
  let args = helpers.verifyArguments(rest)

  const extensions = helpers.getExtensions(last(args))

  if (extensions) {
    args = initial(args)
  }

  function series(done) {
    nowAndLater.mapSeries(args, iterator, extensions, done)
  }

  return series
}
