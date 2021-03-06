if (module.parent)
  // Skip this file from testing.
  return

import exports from "iconv"
import iconv_lite from "../"

const encoding = process.argv[2] || "windows-1251"
const convertTimes = 10000

const encodingStrings = {
  "windows-1251": "This is a test string 32 chars..",
  gbk: "这是中文字符测试。。！@￥%12",
  utf8: "这是中文字符测试。。！@￥%12This is a test string 48 chars..",
}
// Test encoding.
let str = encodingStrings[encoding]
if (!str) {
  throw Error(`Don't support ${encoding} performance test.`)
}
for (var i = 0; i < 13; i++) {
  str = str + str
}

console.log(`\n${encoding} charset performance test:`)
console.log(`\nEncoding ${str.length} chars ${convertTimes} times:`)

var start = Date.now()
var converter = new exports.Iconv("utf8", encoding)
for (var i = 0; i < convertTimes; i++) {
  var b = converter.convert(str)
}
var duration = Date.now() - start
var mbs = (convertTimes * b.length) / duration / 1024

console.log(`iconv: ${duration}ms, ${mbs.toFixed(2)} Mb/s.`)

var start = Date.now()
for (var i = 0; i < convertTimes; i++) {
  var b = iconv_lite.encode(str, encoding)
}
var duration = Date.now() - start
var mbs = (convertTimes * b.length) / duration / 1024

console.log(`iconv-lite: ${duration}ms, ${mbs.toFixed(2)} Mb/s.`)

// Test decoding.
const buf = iconv_lite.encode(str, encoding)
console.log(`\nDecoding ${buf.length} bytes ${convertTimes} times:`)

var start = Date.now()
var converter = new exports.Iconv(encoding, "utf8")
for (var i = 0; i < convertTimes; i++) {
  var s = converter.convert(buf).toString()
}
var duration = Date.now() - start
var mbs = (convertTimes * buf.length) / duration / 1024

console.log(`iconv: ${duration}ms, ${mbs.toFixed(2)} Mb/s.`)

var start = Date.now()
for (var i = 0; i < convertTimes; i++) {
  var s = iconv_lite.decode(buf, encoding)
}
var duration = Date.now() - start
var mbs = (convertTimes * buf.length) / duration / 1024

console.log(`iconv-lite: ${duration}ms, ${mbs.toFixed(2)} Mb/s.`)
