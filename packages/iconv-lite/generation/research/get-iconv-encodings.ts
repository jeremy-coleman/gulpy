// Prints out information about all iconv encodings.
// Usage:
// > iconv --list | node get-iconv-encodings.js > iconv-data.json

import iconv from "iconv"

import crypto from "crypto"

const skipEncodings = {}

let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", data => {
  input += data
})

process.stdin.on("end", () => {
  input = input.replace(/\s|\n/g, " ")
  encodings = input
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
  encodings = input
    .split(" ")
    .map(s => s.trim())
    .filter(Boolean)
  encodings = encodings.filter(enc => {
    try {
      new iconv.Iconv("utf-8", enc).convert(Buffer.from("hello!"))
      if (skipEncodings[enc]) {
        console.log("Encoding skipped: ", enc)
        return false
      }
    } catch (e) {
      console.log("Encoding not supported: ", enc)
      return false
    }
    return true
  })

  let hashes = {}

  encodings = encodings.map(enc => {
    process.stderr.write(`Checking ${enc}: `)
    const hash = crypto.createHash("sha1")

    const converter = new iconv.Iconv(enc, "utf-8")
    const buf = Buffer.alloc(10)
    const res = {
      enc: [enc],
      isDBCS: true,
      isSBCS: true,
      isASCII: true,
      maxChars: 0,
      valid: 0,
      invalid: 0,
      hash: "",
    }

    try {
      forAllChars(
        converter,
        (valid, inp, outp) => {
          res.isASCII = res.isASCII && (inp[0] >= 0x80 || (valid && inp[0] == outp[0]))
          res.isSBCS = res.isSBCS && inp.length == 1
          res.isDBCS =
            res.isDBCS &&
            ((inp.length == 1 && (inp[0] < 0x80 || !valid)) ||
              (inp.length == 2 && inp[0] >= 0x80))
          res.maxChars = Math.max(res.maxChars, inp.length)
          hash.update(inp)
          if (valid) {
            res.valid++
            hash.update(outp)
          } else {
            res.invalid++
          }
          if (res.valid + res.invalid > 1000000) throw Error("Too long")
        },
        buf,
        1
      )
    } catch (e) {
      res.bad = true
    }

    res.hash = hash.digest("hex")
    if (hashes[res.hash]) {
      hashes[res.hash].enc.push(enc)
    } else {
      hashes[res.hash] = res
    }

    process.stderr.write(`${JSON.stringify(res)}\n`)
    return res
  })

  hashes = Object.keys(hashes).map(key => hashes[key])
  console.log(JSON.stringify(hashes, undefined, 2))
})
process.stdin.resume()

// Make all valid input combinations for a given encoding and call fn with it.
// fn(valid, input, output)
function forAllChars(converter, fn, origbuf, len) {
  const buf = origbuf.slice(0, len)
  for (let i = 0; i < 0x100; i++) {
    buf[len - 1] = i
    let res = undefined
    try {
      res = converter.convert(buf)
    } catch (e) {
      if (e.code == "EILSEQ") {
        // Invalid character sequence.
        // Notify that this sequence is invalid.
        //fn(false, buf);
      } else if (e.code == "EINVAL") {
        // Partial character sequence.
        // Recurse deeper.
        forAllChars(converter, fn, origbuf, len + 1)
      } else throw e
    }

    // buf contains correct input combination. Run fn with input and converter output.
    fn(res != null, buf, res)
  }
}
