import eos from "../index"
import { expect } from "chai"

import * as fs from "fs"
import * as cp from "child_process"
import * as net from "net"
import * as http from "http"
import * as stream from "stream"

describe("end-of-stream", () => {
  it("fs writestream destroy", done => {
    const ws = fs.createWriteStream("/dev/null")

    eos(ws, function (err) {
      expect(err).to.exist
      expect(this).to.equal(ws)
      done()
    })

    ws.destroy()
  })

  it("fs readstream destroy", done => {
    const rs1 = fs.createReadStream("/dev/urandom")

    eos(rs1, function (err) {
      expect(err).to.exist
      expect(this).to.equal(rs1)
      done()
    })

    rs1.destroy()
  })

  it("fs readstream pipe", done => {
    const rs2 = fs.createReadStream(__filename)

    eos(rs2, function (err) {
      expect(err).to.not.exist
      expect(this).to.equal(rs2)
      done()
    })

    rs2.pipe(fs.createWriteStream("/dev/null"))
  })

  it("fs readstream cancel", done => {
    const rs3 = fs.createReadStream(__filename)

    eos(rs3, () => {
      expect(false, "should not enter")
    })()

    rs3.pipe(fs.createWriteStream("/dev/null"))
    rs3.on("end", () => {
      done()
    })
  })

  it("exec", done => {
    const exec = cp.exec("echo hello world")

    eos(exec, function (err) {
      expect(err).to.not.exist
      expect(this).to.equal(exec)
      done()
    })
  })

  it("spawn", done => {
    const spawn = cp.spawn("echo", ["hello world"])
    eos(spawn, function (err) {
      expect(err).to.not.exist
      expect(this).to.equal(spawn)
      done()
    })
  })

  it("tcp socket", () => {
    const socket = net.connect(50000)

    eos(socket, function (err) {
      expect(err).to.exist
      expect(this).to.equal(socket)
    })

    const server = net
      .createServer(socket => {
        eos(socket, function (err) {
          expect(err).to.exist
          expect(this).to.equal(socket)
        })
        socket.destroy()
      })
      .listen(30000, () => {
        const socket = net.connect(30000)
        eos(socket, function () {
          expect(this).to.equal(socket)
          server.close()
        })
      })
  })

  it("http", () => {
    const server2 = http
      .createServer((_req, res) => {
        eos(res, err => {
          expect(err).to.not.exist
        })
        res.end()
      })
      .listen(() => {
        const port = (server2.address() as net.AddressInfo).port
        http.get(`http://localhost:${port}`, res => {
          eos(res, err => {
            expect(err).to.not.exist
            server2.close()
          })
          res.resume()
        })
      })
  })

  it("end() and emit(close)", done => {
    if (!stream.Writable) return done()
    const ws = new stream.Writable()

    ws._write = (_data, _enc, cb) => {
      process.nextTick(cb)
    }

    eos(ws, err => {
      expect(err).to.not.exist
      done()
    })

    ws.write("hi")
    ws.end()
    ws.emit("close")
  })
})
