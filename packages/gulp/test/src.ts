import * as path from "path"

import { expect } from "chai"
import gulp from "../index"

describe("gulp.src()", () => {
  it("should return a stream", done => {
    const stream = gulp.src("./fixtures/*.coffee", { cwd: __dirname })
    expect(stream).to.exist
    expect(stream.on).to.exist
    done()
  })

  it("should return a input stream from a flat glob", done => {
    const stream = gulp.src("./fixtures/*.coffee", { cwd: __dirname })
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      expect(file.path).to.equal(path.join(__dirname, "./fixtures/test.coffee"))
      expect(file.contents.toString()).to.equal("this is a test")
    })
    stream.on("end", () => {
      done()
    })
  })

  it("should return a input stream for multiple globs", done => {
    const globArray = ["./fixtures/stuff/run.dmc", "./fixtures/stuff/test.dmc"]
    const stream = gulp.src(globArray, { cwd: __dirname })

    const files: any[] = []
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      files.push(file)
    })
    stream.on("end", () => {
      expect(files.length).to.equal(2)
      expect(files[0].path).to.equal(path.join(__dirname, globArray[0]))
      expect(files[1].path).to.equal(path.join(__dirname, globArray[1]))
      done()
    })
  })

  it("should return a input stream for multiple globs, with negation", done => {
    const expectedPath = path.join(__dirname, "./fixtures/stuff/run.dmc")
    const globArray = ["./fixtures/stuff/*.dmc", "!fixtures/stuff/test.dmc"]
    const stream = gulp.src(globArray, { cwd: __dirname })

    const files: any[] = []
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      files.push(file)
    })
    stream.on("end", () => {
      expect(files.length).to.equal(1)
      expect(files[0].path).to.equal(expectedPath)
      done()
    })
  })

  it("should return a input stream with no contents when read is false", done => {
    const stream = gulp.src("./fixtures/*.coffee", { read: false, cwd: __dirname })
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.not.exist
      expect(file.path).to.equal(path.join(__dirname, "./fixtures/test.coffee"))
    })
    stream.on("end", () => {
      done()
    })
  })

  it("should return a input stream with contents as stream when buffer is false", done => {
    const stream = gulp.src("./fixtures/*.coffee", { buffer: false, cwd: __dirname })
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      let buf = ""
      file.contents.on("data", d => {
        buf += d
      })
      file.contents.on("end", () => {
        expect(buf).to.equal("this is a test")
        done()
      })
      expect(file.path).to.equal(path.join(__dirname, "./fixtures/test.coffee"))
    })
  })

  it("should return a input stream from a deep glob", done => {
    const stream = gulp.src("./fixtures/**/*.jade", { cwd: __dirname })
    stream.on("error", done)
    stream.on("data", file => {
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      expect(file.path).to.equal(path.join(__dirname, "./fixtures/test/run.jade"))
      expect(file.contents.toString()).to.equal("test template")
    })
    stream.on("end", () => {
      done()
    })
  })

  it("should return a input stream from a deeper glob", done => {
    const stream = gulp.src("./fixtures/**/*.dmc", { cwd: __dirname })
    let a = 0
    stream.on("error", done)
    stream.on("data", () => {
      ++a
    })
    stream.on("end", () => {
      expect(a).to.equal(2)
      done()
    })
  })

  it("should return a file stream from a flat path", done => {
    let a = 0
    const stream = gulp.src(path.join(__dirname, "./fixtures/test.coffee"))
    stream.on("error", done)
    stream.on("data", file => {
      ++a
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      expect(file.path).to.equal(path.join(__dirname, "./fixtures/test.coffee"))
      expect(file.contents.toString()).to.equal("this is a test")
    })
    stream.on("end", () => {
      expect(a).to.equal(1)
      done()
    })
  })
})

// setTimeout(() => {
//   const activeHandles = process["_getActiveHandles"]()
//   console.log({
//     activeRequests: process["_getActiveRequests"](),
//     activeHandles,
//     paths: activeHandles.map(x => x.path),
//   })
// }, 5500)
