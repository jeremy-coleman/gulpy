import duplexify from "duplexify"
import http from "http"

const request = opts => {
  const req = http.request(opts)
  const dup = duplexify()
  dup.setWritable(req)
  req.on("response", res => {
    dup.setReadable(res)
  })
  return dup
}

const req = request({
  method: "GET",
  host: "www.google.com",
  port: 80,
})

req.end()
req.pipe(process.stdout)
