import { asyncDone } from "@local/async-done"

export function settle(fn, done) {
  asyncDone(fn, (error, result) => {
    const settled = {
      state: undefined as any,
      value: undefined,
    }

    if (error != null) {
      settled.state = "error"
      settled.value = error
    } else {
      settled.state = "success"
      settled.value = result
    }

    done(null, settled)
  })
}
