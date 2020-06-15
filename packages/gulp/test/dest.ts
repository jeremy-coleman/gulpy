import * as fs from "fs-extra"
import * as path from "path"

import { expect } from "chai"

import gulp from "../index"

const outPath = path.join(__dirname, "./out-fixtures")

describe("gulp.dest()", () => {
  beforeEach(() => fs.removeSync(outPath))
  afterEach(() => fs.removeSync(outPath))

  it("should return a stream", done => {
    const stream = gulp.dest(path.join(__dirname, "./fixtures/"))
    expect(stream).to.exist
    expect(stream.on).to.exist
    done()
  })

  it("should return a output stream that writes files", done => {
    const inStream = gulp.src("./fixtures/**/*.txt", { cwd: __dirname })
    const outStream = gulp.dest(outPath)
    inStream.pipe(outStream)

    outStream.on("error", done)
    outStream.on("data", file => {
      // Data should be re-emitted right
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      expect(file.path).to.equal(path.join(outPath, "./copy/example.txt"))
      expect(file.contents.toString()).to.equal("this is a test")
    })
    outStream.on("end", () => {
      fs.readFile(path.join(outPath, "copy", "example.txt"), (err, contents) => {
        expect(err).to.not.exist
        expect(contents).to.exist
        expect(contents.toString()).to.equal("this is a test")
        done()
      })
    })
  })

  it("should return a output stream that does not write non-read files", done => {
    const instream = gulp.src("./fixtures/**/*.txt", { read: false, cwd: __dirname })
    const outstream = gulp.dest(outPath)
    instream.pipe(outstream)

    outstream.on("error", done)
    outstream.on("data", file => {
      // Data should be re-emitted right
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.not.exist
      expect(file.path).to.equal(path.join(outPath, "./copy/example.txt"))
    })
    outstream.on("end", () => {
      fs.readFile(path.join(outPath, "copy", "example.txt"), (err, contents) => {
        expect(err).to.exist
        expect(contents).to.not.exist
        done()
      })
    })
  })

  it("should return a output stream that writes streaming files", done => {
    var instream = gulp.src("./fixtures/**/*.txt", { buffer: false, cwd: __dirname })
    var outstream = instream.pipe(gulp.dest(outPath))

    outstream.on("error", done)
    outstream.on("data", file => {
      // Data should be re-emitted right
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.contents).to.exist
      expect(file.path).to.equal(path.join(outPath, "./copy/example.txt"))
    })
    outstream.on("end", () => {
      fs.readFile(path.join(outPath, "copy", "example.txt"), (err, contents) => {
        expect(err).to.not.exist
        expect(contents).to.exist
        expect(contents.toString()).to.equal("this is a test")
        done()
      })
    })
  })

  it("should return a output stream that writes streaming files into new directories", done => {
    testWriteDir({ cwd: __dirname }, done)
  })

  it("should return a output stream that writes streaming files into new directories (buffer: false)", done => {
    testWriteDir({ buffer: false, cwd: __dirname }, done)
  })

  it("should return a output stream that writes streaming files into new directories (read: false)", done => {
    testWriteDir({ read: false, cwd: __dirname }, done)
  })

  it("should return a output stream that writes streaming files into new directories (read: false, buffer: false)", done => {
    testWriteDir({ buffer: false, read: false, cwd: __dirname }, done)
  })

  function testWriteDir(srcOptions, done) {
    var instream = gulp.src("./fixtures/stuff", srcOptions)
    var outstream = instream.pipe(gulp.dest(outPath))

    outstream.on("error", done)
    outstream.on("data", file => {
      // Data should be re-emitted right
      expect(file).to.exist
      expect(file.path).to.exist
      expect(file.path).to.equal(path.join(outPath, "./stuff"))
    })
    outstream.on("end", () => {
      fs.exists(path.join(outPath, "stuff"), exists => {
        expect(exists).to.exist
        done()
      })
    })
  }
})
