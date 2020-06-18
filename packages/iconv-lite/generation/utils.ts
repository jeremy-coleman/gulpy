import request from "request"
import fs from "fs"
import path from "path"
import errTo from "errto"
import { isNumber } from "lodash-es"

// Common utilities used in scripts.

export function getFile(url, cb?) {
  const sourceDataFolder = path.join(__dirname, "source-data")
  const fullpath = path.join(sourceDataFolder, path.basename(url))
  fs.readFile(fullpath, "utf8", (err, text) => {
    if (!err) return cb(null, text)
    if (err.code != "ENOENT") return cb(err)
    request(
      url,
      errTo(cb, (res, buf) => {
        fs.mkdir(sourceDataFolder, err => {
          if (err && err.code != "EEXIST") return cb(err)
          fs.writeFile(
            fullpath,
            buf,
            errTo(cb, () => {
              cb(null, buf.toString())
            })
          )
        })
      })
    )
  })
}

// Returns array of arrays.
export function parseText(text, splitChar) {
  return text
    .split("\n")
    .map(line => line.split("#")[0].trim())
    .filter(Boolean)
    .map(line =>
      line
        .split(splitChar || /\s+/)
        .map(s => s.trim())
        .filter(Boolean)
    )
}

// Convert array of character codes to string. Character codes can be > 0xFFFF,
// so we emit surrogates when needed. Also, some character codes are actually
// sequences (arrays) - we emit them prepended with U+0FFF-(length-2).
// U+0FFF was chosen because it's small and unassigned, as well as 32 chars before it
function arrToStr(arr) {
  let s = ""
  for (let i = 0; i < arr.length; i++)
    if (Array.isArray(arr[i])) {
      if (arr[i].length == 1) s += arrToStr(arr[i])
      else if (arr[i].length > 1)
        s += String.fromCharCode(0xfff - (arr[i].length - 2)) + arrToStr(arr[i])
    } else if (arr[i] > 0xffff) {
      // Surrogates
      s +=
        String.fromCharCode(0xd800 + Math.floor((arr[i] - 0x10000) / 0x400)) +
        String.fromCharCode(0xdc00 + ((arr[i] - 0x10000) % 0x400))
    } else {
      // Basic characters.
      s += String.fromCharCode(arr[i])
    }

  return s
}

// Input: map <dbcs num> -> <unicode num>
// Resulting format: Array of chunks, each chunk is:
// [0] = address of start of the chunk, hex string.
// <str> - characters of the chunk.
// <num> - increasing sequence of the length num, starting with prev character.
export function generateTable(dbcs, maxBytes?: number) {
  const minSeqLen = 4
  const table = []
  let range
  let block
  let seqLen
  const max = 1 << ((maxBytes || 2) * 8)
  for (let i = 0x0000; i < max; i++)
    if (dbcs[i] !== undefined) {
      if (dbcs[i - 1] === undefined) {
        // Range started.
        range = [i.toString(16)] // Range[0] is starting address.
        block = [] // Current block of character codes.
        seqLen = 0 // Increasing sequence length at the end of the block.
      } else if (
        isNumber(dbcs[i - 1]) && // We have arrays as elements of dbcs - check against it.
        isNumber(dbcs[i]) &&
        dbcs[i - 1] + 1 === dbcs[i]
      ) {
        // Increasing sequence continues - track its length.
        seqLen++
      } else {
        // Increasing sequence ended (or not started at all).
        if (seqLen >= minSeqLen) {
          // Seq is long enough: write prev segment and its length.
          range.push(arrToStr(block.slice(0, -seqLen)), seqLen)
          block = []
        }
        seqLen = 0
      }

      block.push(dbcs[i])
    } else if (range) {
      // Range finished, write last segments.
      if (seqLen >= minSeqLen) range.push(arrToStr(block.slice(0, -seqLen)), seqLen)
      else range.push(arrToStr(block))

      table.push(range)
      range = null
    }

  return table
}

export function writeTable(name, table) {
  this.writeFile(name, `[\n${table.map(a => JSON.stringify(a)).join(",\n")}\n]\n`)
}

export function writeFile(name, body) {
  fs.writeFileSync(path.join(__dirname, "../encodings/tables", `${name}.json`), body)
}
