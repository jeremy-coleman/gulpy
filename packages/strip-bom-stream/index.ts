import FirstChunkStream from "@local/first-chunk-stream"
import stripBomBuffer from "strip-bom-buf"

export default function () {
  return new FirstChunkStream({ chunkLength: 3 }, (error, chunk, encoding, callback) => {
    if (error) {
      callback(error)
      return
    }

    callback(null, stripBomBuffer(chunk))
  })
}
