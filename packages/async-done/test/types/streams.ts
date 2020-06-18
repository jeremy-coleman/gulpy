import { asyncDone } from "@local/async-done"
import { Stream } from "stream"

function streamSuccess(): Stream {
  return new Stream()
}

function streamFail(): Stream {
  return new Stream()
}

asyncDone(streamSuccess, function (err: Error | null): void {
  console.log("Done")
})

asyncDone(streamFail, function (err: Error | null): void {
  console.log("Done")
})
