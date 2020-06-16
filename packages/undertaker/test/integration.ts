import { expect } from "chai"

import * as os from "os"
import * as fs from "fs"
import * as path from "path"
import * as vinyl from "vinyl-fs"
import { spawn } from "child_process"
import { once } from "lodash"
import aOnce from "async-once"
import del from "del"
import through from "through2"
import { Undertaker } from "../mod"

const isWindows = os.platform() === "win32"

function cleanup() {
  return del([
    path.join(__dirname, "./fixtures/out/"),
    path.join(__dirname, "./fixtures/tmp/"),
  ])
}

describe("integrations", () => {
  let taker: Undertaker

  beforeEach(done => {
    taker = new Undertaker()
    done()
  })

  beforeEach(cleanup)
  afterEach(cleanup)

  it("should handle vinyl streams", done => {
    taker.task("test", () =>
      vinyl
        .src("./fixtures/test.ts", { cwd: __dirname })
        .pipe(vinyl.dest("./fixtures/out", { cwd: __dirname }))
    )

    taker.parallel("test")(done)
  })

  it("should exhaust vinyl streams", done => {
    taker.task("test", () => vinyl.src("./fixtures/test.ts", { cwd: __dirname }))

    taker.parallel("test")(done)
  })

  it("should handle a child process return", done => {
    taker.task("test", () => {
      if (isWindows) {
        return spawn("cmd", ["/c", "dir"]).on("error", console.log)
      }

      return spawn("ls", ["-lh", __dirname])
    })

    taker.parallel("test")(done)
  })

  it("should run dependencies once (1)", done => {
    let count = 0

    taker.task(
      "clean",
      once(() => {
        count++
        return del(["./fixtures/some-build.txt"], { cwd: __dirname })
      })
    )

    taker.task(
      "build-this",
      taker.series("clean", cb => {
        cb()
      })
    )
    taker.task(
      "build-that",
      taker.series("clean", cb => {
        cb()
      })
    )
    taker.task(
      "build",
      taker.series("clean", taker.parallel(["build-this", "build-that"]))
    )

    taker.parallel("build")(err => {
      expect(count).to.equal(1)
      done(err)
    })
  })

  it("should run dependencies once (2)", done => {
    let count = 0

    taker.task(
      "clean",
      aOnce(cb => {
        cb()
        count++
        ;(del as any)(["./fixtures/some-build.txt"], { cwd: __dirname }, cb)
      })
    )

    taker.task(
      "build-this",
      taker.series("clean", cb => {
        cb()
      })
    )
    taker.task(
      "build-that",
      taker.series("clean", cb => {
        cb()
      })
    )
    taker.task(
      "build",
      taker.series("clean", taker.parallel(["build-this", "build-that"]))
    )

    // ICI
    taker.parallel("build")(err => {
      expect(count).to.equal(1)
      done(err)
    })
  })

  it("can use lastRun with vinyl.src `since` option", function (done) {
    this.timeout(5000)

    let count = 0

    function setup() {
      return vinyl
        .src("./fixtures/test*.ts", { cwd: __dirname })
        .pipe(vinyl.dest("./fixtures/tmp", { cwd: __dirname }))
    }

    function delay(cb: () => void) {
      setTimeout(cb, 2000)
    }

    // Some built
    taker.task("build", () =>
      vinyl
        .src("./fixtures/tmp/*.ts", { cwd: __dirname })
        .pipe(vinyl.dest("./fixtures/out", { cwd: __dirname }))
    )

    function userEdit(cb: () => void) {
      fs.appendFile(path.join(__dirname, "./fixtures/tmp/testMore.ts"), " ", cb)
    }

    function countEditedFiles() {
      return vinyl
        .src("./fixtures/tmp/*.ts", { cwd: __dirname, since: taker.lastRun("build") })
        .pipe(
          through.obj((_file, _enc, cb) => {
            count++
            cb()
          })
        )
    }

    taker.series(
      setup,
      delay,
      "build",
      delay,
      userEdit,
      countEditedFiles
    )(err => {
      expect(count).to.equal(1)
      done(err)
    })
  })
})
