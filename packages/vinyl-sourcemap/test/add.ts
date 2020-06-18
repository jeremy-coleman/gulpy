"use strict"

var fs = require("fs")
var File = require("vinyl")
var path = require("path")
var expect = require("expect")
var convert = require("convert-source-map")
var miss = require("mississippi")

var sourcemaps = require("..")

var from = miss.from

var sourceContent = fs.readFileSync(path.join(__dirname, "assets/helloworld.js"))

function makeFile() {
  return new File({
    cwd: __dirname,
    base: path.join(__dirname, "assets"),
    path: path.join(__dirname, "assets", "helloworld.js"),
    contents: new Buffer(sourceContent),
  })
}

function makeSourcemap() {
  return {
    file: "all.js",
    mappings: "AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA",
    names: ["console", "log"],
    sourceRoot: path.join(__dirname, "assets"),
    sources: ["test1.js", "test2.js"],
    sourcesContent: [
      'console.log("line 1.1");\nconsole.log("line 1.2");\n',
      'console.log("line 2.1");\nconsole.log("line 2.2");',
    ],
    version: 3,
  }
}

function makeFileWithInlineSourceMap() {
  var inline = convert.fromObject(makeSourcemap()).toComment()
  return new File({
    cwd: __dirname,
    base: path.join(__dirname, "assets"),
    path: path.join(__dirname, "assets", "all.js"),
    contents: new Buffer(
      'console.log("line 1.1"),console.log("line 1.2"),console.log("line 2.1"),console.log("line 2.2");\n' +
        inline
    ),
  })
}

describe("add", function () {
  it("errors if file argument is undefined", function (done) {
    sourcemaps.add(undefined, function (err) {
      expect(
        err instanceof Error && err.message === "vinyl-sourcemap-add: Not a vinyl file"
      ).toExist()
      done()
    })
  })

  it("errors if file argument is null", function (done) {
    sourcemaps.add(null, function (err) {
      expect(
        err instanceof Error && err.message === "vinyl-sourcemap-add: Not a vinyl file"
      ).toExist()
      done()
    })
  })

  it("errors if file argument is a plain object", function (done) {
    sourcemaps.add({}, function (err) {
      expect(
        err instanceof Error && err.message === "vinyl-sourcemap-add: Not a vinyl file"
      ).toExist()
      done()
    })
  })

  it("does not error if file argument is a Vinyl object with Buffer contents", function (done) {
    var file = makeFile()
    sourcemaps.add(file, function (err) {
      expect(err).toNotExist()
      done()
    })
  })

  it("errors if file argument is a Vinyl object with Stream contents", function (done) {
    var file = makeFile()
    file.contents = from([])
    sourcemaps.add(file, function (err) {
      expect(
        err instanceof Error &&
          err.message === "vinyl-sourcemap-add: Streaming not supported"
      ).toExist()
      done()
    })
  })

  it("calls back with the untouched file if file already has a sourcemap", function (done) {
    var sourceMap = {
      version: 3,
      names: [],
      mappings: "",
      sources: ["test.js"],
      sourcesContent: ["testContent"],
    }

    var file = makeFile()
    file.sourceMap = sourceMap
    sourcemaps.add(file, function (err, data) {
      expect(data).toExist()
      expect(File.isVinyl(data)).to.be.true
      expect(data.sourceMap).toBe(sourceMap)
      expect(data).toBe(file)
      done(err)
    })
  })

  it("calls back with the untouched file if file contents are null", function (done) {
    var file = makeFile()
    file.contents = null
    sourcemaps.add(file, function (err, outFile) {
      expect(err).toNotExist()
      expect(file).toExist()
      expect(outFile).toEqual(file)
      done(err)
    })
  })

  it("adds an empty sourceMap if none are found", function (done) {
    sourcemaps.add(makeFile(), function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources[0]).to.equal("helloworld.js")
      expect(data.sourceMap.sourcesContent[0]).toEqual(sourceContent)
      expect(data.sourceMap.names).to.deep.equal([])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("imports an existing inline sourcemap", function (done) {
    sourcemaps.add(makeFileWithInlineSourceMap(), function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["test1.js", "test2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        'console.log("line 1.1");\nconsole.log("line 1.2");\n',
        'console.log("line 2.1");\nconsole.log("line 2.2");',
      ])
      expect(data.sourceMap.mappings).toEqual(
        "AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA"
      )
      done(err)
    })
  })

  it("removes an imported inline sourcemap", function (done) {
    sourcemaps.add(makeFileWithInlineSourceMap(), function (err, data) {
      expect(/sourceMappingURL/.test(data.contents.toString())).to.be.false
      done(err)
    })
  })

  it("loads external sourcemap file from //# comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld2.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["helloworld2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        "source content from source map",
      ])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("removes an imported sourcemap file //# comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld2.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(/sourceMappingURL/.test(data.contents.toString())).to.be.false
      done(err)
    })
  })

  it("loads external sourcemap file from //@ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//@ sourceMappingURL=helloworld2.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["helloworld2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        "source content from source map",
      ])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("removes an imported sourcemap file //@ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//@ sourceMappingURL=helloworld2.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(/sourceMappingURL/.test(data.contents.toString())).to.be.false
      done(err)
    })
  })

  it("loads external sourcemap file from /*# */ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n/*# sourceMappingURL=helloworld2.js.map */"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["helloworld2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        "source content from source map",
      ])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("removes an imported sourcemap file /*# */ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n/*# sourceMappingURL=helloworld2.js.map */"
    )
    sourcemaps.add(file, function (err, data) {
      expect(/sourceMappingURL/.test(data.contents.toString())).to.be.false
      done(err)
    })
  })

  it("loads external sourcemap file from /*@ */ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n/*@ sourceMappingURL=helloworld2.js.map */"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["helloworld2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        "source content from source map",
      ])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("removes an imported sourcemap file /*@ */ comment", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n/*@ sourceMappingURL=helloworld2.js.map */"
    )
    sourcemaps.add(file, function (err, data) {
      expect(/sourceMappingURL/.test(data.contents.toString())).to.be.false
      done(err)
    })
  })

  it("loads external sourcemap by filename if no source mapping comment", function (done) {
    var file = makeFile()
    file.path = file.path.replace("helloworld.js", "helloworld2.js")
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.version).to.equal(3)
      expect(data.sourceMap.sources).to.deep.equal(["helloworld2.js"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        "source content from source map",
      ])
      expect(data.sourceMap.mappings).to.equal("")
      done(err)
    })
  })

  it("loads sourcesContent if missing", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld3.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        file.contents.toString(),
        "test1\n",
      ])
      done(err)
    })
  })

  it("does not error when source file for sourcesContent not found", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld4.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(err).toNotExist()
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sources).to.deep.equal(["helloworld.js", "missingfile"])
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        file.contents.toString(),
        null,
      ])
      done(err)
    })
  })

  it("uses unix style paths in sourcemap", function (done) {
    var file = makeFile()
    file.base = file.cwd
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.file).to.equal("assets/helloworld.js")
      expect(data.sourceMap.sources).to.deep.equal(["assets/helloworld.js"])
      done(err)
    })
  })

  it("normalizes Windows paths in sources to unix paths", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld8.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sources).to.deep.equal(["../helloworld.js", "../test1.js"])
      done(err)
    })
  })

  it("sets file.relative as file property in sourcemap", function (done) {
    var file = makeFile()
    file.stem = "brandnew"
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.file).to.equal("brandnew.js")
      done(err)
    })
  })

  it("normalizes Windows paths in file.relative before using in sourcemap", function (done) {
    var file = makeFile()
    file.stem = "assets\\\\brandnew"
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.file).to.equal("assets/brandnew.js")
      done(err)
    })
  })

  it("uses relative sourceRoot to resolve sources", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld5.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sourceRoot).to.equal("test")
      expect(data.sourceMap.sourcesContent).to.deep.equal([
        file.contents.toString(),
        "test1\n",
      ])
      done(err)
    })
  })

  it("uses absolute sourceRoot to resolve sources", function (done) {
    var file = makeFile()
    var map = convert.fromObject(makeSourcemap())
    delete map.sourcemap.sourcesContent
    var inline = map.toComment()
    file.contents = new Buffer(sourceContent + "\n" + inline)
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sourceRoot).toEqual(path.join(__dirname, "assets"))
      expect(data.sourceMap.sourcesContent).to.deep.equal(["test1\n", "test2\n"])
      done(err)
    })
  })

  it("does not load sourcesContent when sourceRoot is a url", function (done) {
    var file = makeFile()
    file.contents = new Buffer(
      sourceContent + "\n//# sourceMappingURL=helloworld6.js.map"
    )
    sourcemaps.add(file, function (err, data) {
      expect(data.sourceMap).toExist()
      expect(data.sourceMap.sourceRoot).to.equal("http://example.com/")
      expect(data.sourceMap.sourcesContent).to.deep.equal([null, null])
      done(err)
    })
  })
})
