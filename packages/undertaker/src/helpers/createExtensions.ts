import type { Undertaker } from "../index"
import { capture, release } from "last-run"
import { metadata } from "./metadata"

let uid = 0

class Storage {
  fn
  uid: number
  name: string
  branch: boolean
  captureTime: number
  startHr: any[]

  constructor(fn) {
    const meta = metadata.get(fn)!
    this.fn = meta.orig || fn
    this.uid = uid++
    this.name = meta.name
    this.branch = meta.branch || false
    this.captureTime = Date.now()
    this.startHr = []
  }
  capture() {
    capture(this.fn, this.captureTime)
  }
  release() {
    release(this.fn)
  }
}

export function createExtensions(ee: Undertaker) {
  return {
    create(fn) {
      return new Storage(fn)
    },
    before(storage) {
      storage.startHr = process.hrtime()
      ee.emit("start", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        time: Date.now(),
      })
    },
    after(result, storage) {
      if (result && result.state === "error") {
        return this.error(result.value, storage)
      }
      storage.capture()
      ee.emit("stop", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        duration: process.hrtime(storage.startHr),
        time: Date.now(),
      })
    },
    error(error, storage) {
      if (Array.isArray(error)) {
        error = error[0]
      }
      storage.release()
      ee.emit("error", {
        uid: storage.uid,
        name: storage.name,
        branch: storage.branch,
        error,
        duration: process.hrtime(storage.startHr),
        time: Date.now(),
      })
    },
  }
}
