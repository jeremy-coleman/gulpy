import pipe from "@local/pump"
import Duplexify from "duplexify"

const toArray = args => {
  if (!args.length) return []
  return Array.isArray(args[0]) ? args[0] : Array.prototype.slice.call(args)
}

const define = opts => {
  class Pumpify extends Duplexify {
    constructor(...args) {
      const streams = toArray(args)
      super(null, null, opts)
      if (streams.length) this.setPipeline(streams)
    }

    setPipeline(...args) {
      const streams = toArray(args)
      const self = this
      let ended = false
      let w = streams[0]
      let r = streams[streams.length - 1]

      r = r.readable ? r : null
      w = w.writable ? w : null

      const onclose = () => {
        streams[0].emit("error", new Error("stream was destroyed"))
      }

      this.on("close", onclose)
      this.on("prefinish", () => {
        if (!ended) self.cork()
      })

      pump(streams, err => {
        self.removeListener("close", onclose)
        if (err) return self.destroy(err.message === "premature close" ? null : err)
        ended = true
        // pump ends after the last stream is not writable *but*
        // pumpify still forwards the readable part so we need to catch errors
        // still, so reenable autoDestroy in this case
        if (self._autoDestroy === false) self._autoDestroy = true
        self.uncork()
      })

      if (this.destroyed) return onclose()
      this.setWritable(w)
      this.setReadable(r)
    }
  }

  return (...args) => new Pumpify(...args)
}

export default define({ autoDestroy: false, destroy: false })

export const obj = define({
  autoDestroy: false,
  destroy: false,
  objectMode: true,
  highWaterMark: 16,
})

export { define as ctor }
