import stream from "../index"
import _fs from "fs"
const tmpDir = "test/tmp/"
const readFile = "test/data.md"
const writeFile = `${tmpDir}data.md`

export var fs = {
  readwrite(test) {
    let readfd
    let writefd

    const readable = new stream.Readable(() =>
      _fs
        .createReadStream(readFile)
        .on("open", fd => {
          readfd = fd
        })
        .on("close", () => {
          readfd = undefined
          step()
        })
    )

    const writable = new stream.Writable(() =>
      _fs
        .createWriteStream(writeFile)
        .on("open", fd => {
          writefd = fd
        })
        .on("close", () => {
          writefd = undefined
          step()
        })
    )

    test.expect(3)

    test.equal(readfd, undefined, "Input file should not be opened until read")
    test.equal(writefd, undefined, "Output file should not be opened until write")

    if (!_fs.existsSync(tmpDir)) {
      _fs.mkdirSync(tmpDir)
    }
    if (_fs.existsSync(writeFile)) {
      _fs.unlinkSync(writeFile)
    }

    readable.on("end", () => {
      step()
    })
    writable.on("end", () => {
      step()
    })

    let steps = 0
    function step() {
      steps += 1
      if (steps == 4) {
        const input = _fs.readFileSync(readFile)
        const output = _fs.readFileSync(writeFile)

        test.ok(input >= output && input <= output, "Should be equal")

        _fs.unlinkSync(writeFile)
        _fs.rmdirSync(tmpDir)

        test.done()
      }
    }

    readable.pipe(writable)
  },
}
