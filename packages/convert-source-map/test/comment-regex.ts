/*jshint asi: true */

import { test } from "tap"

import generator from "inline-source-map"
import convert from ".."

function comment(prefix, suffix) {
  const rx = convert.commentRegex
  return rx.test(
    `${prefix}sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlcyI6WyJmdW5jdGlvbiBmb28oKSB7XG4gY29uc29sZS5sb2coXCJoZWxsbyBJIGFtIGZvb1wiKTtcbiBjb25zb2xlLmxvZyhcIndobyBhcmUgeW91XCIpO1xufVxuXG5mb28oKTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSJ9${suffix}`
  )
}

function commentWithCharSet(prefix, suffix, sep = ":") {
  const rx = convert.commentRegex
  return rx.test(
    `${prefix}sourceMappingURL=data:application/json;charset${sep}utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlcyI6WyJmdW5jdGlvbiBmb28oKSB7XG4gY29uc29sZS5sb2coXCJoZWxsbyBJIGFtIGZvb1wiKTtcbiBjb25zb2xlLmxvZyhcIndobyBhcmUgeW91XCIpO1xufVxuXG5mb28oKTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSJ9${suffix}`
  )
}

// Source Map v2 Tests
test("comment regex old spec - @", t => {
  ;[
    "//@ ",
    "  //@ ", // with leading space
    "\t//@ ", // with leading tab
    "//@ ", // with leading text
    "/*@ ", // multi line style
    "  /*@ ", // multi line style with leading spaces
    "\t/*@ ", // multi line style with leading tab
    "/*@ ", // multi line style with leading text
  ].forEach(x => {
    t.ok(comment(x, ""), `matches ${x}`)
    t.ok(commentWithCharSet(x, ""), `matches ${x} with charset`)
    t.ok(commentWithCharSet(x, "", "="), `matches ${x} with charset`)
  })
  ;[" @// @", " @/* @"].forEach(x => {
    t.ok(!comment(x, ""), `should not match ${x}`)
  })

  t.end()
})

test("comment regex new spec - #", t => {
  ;[
    "  //# ", // with leading spaces
    "\t//# ", // with leading tab
    "//# ", // with leading text
    "/*# ", // multi line style
    "  /*# ", // multi line style with leading spaces
    "\t/*# ", // multi line style with leading tab
    "/*# ", // multi line style with leading text
  ].forEach(x => {
    t.ok(comment(x, ""), `matches ${x}`)
    t.ok(commentWithCharSet(x, ""), `matches ${x} with charset`)
    t.ok(commentWithCharSet(x, "", "="), `matches ${x} with charset`)
  })
  ;[" #// #", " #/* #"].forEach(x => {
    t.ok(!comment(x, ""), `should not match ${x}`)
  })

  t.end()
})

function mapFileCommentWrap(s1, s2) {
  const mapFileRx = convert.mapFileCommentRegex
  return mapFileRx.test(`${s1}sourceMappingURL=foo.js.map${s2}`)
}

test("mapFileComment regex old spec - @", t => {
  ;[
    ["//@ ", ""],
    ["  //@ ", ""], // with leading spaces
    ["\t//@ ", ""], // with a leading tab
    ["///@ ", ""], // with a leading text
    [";//@ ", ""], // with a leading text
    ["return//@ ", ""], // with a leading text
  ].forEach(x => {
    t.ok(mapFileCommentWrap(x[0], x[1]), `matches ${x.join(" :: ")}`)
  })
  ;[
    [" @// @", ""],
    ["var sm = `//@ ", "`"], // not inside a string
    ['var sm = "//@ ', '"'], // not inside a string
    ["var sm = '//@ ", "'"], // not inside a string
    ["var sm = ' //@ ", "'"], // not inside a string
  ].forEach(x => {
    t.ok(!mapFileCommentWrap(x[0], x[1]), `does not match ${x.join(" :: ")}`)
  })
  t.end()
})

test("mapFileComment regex new spec - #", t => {
  ;[
    ["//# ", ""],
    ["  //# ", ""], // with leading space
    ["\t//# ", ""], // with leading tab
    ["///# ", ""], // with leading text
    [";//# ", ""], // with leading text
    ["return//# ", ""], // with leading text
  ].forEach(x => {
    t.ok(mapFileCommentWrap(x[0], x[1]), `matches ${x.join(" :: ")}`)
  })
  ;[
    [" #// #", ""],
    ["var sm = `//# ", "`"], // not inside a string
    ['var sm = "//# ', '"'], // not inside a string
    ["var sm = '//# ", "'"], // not inside a string
    ["var sm = ' //# ", "'"], // not inside a string
  ].forEach(x => {
    t.ok(!mapFileCommentWrap(x[0], x[1]), `does not match ${x.join(" :: ")}`)
  })
  t.end()
})

test("mapFileComment regex /* */ old spec - @", t => {
  ;[
    ["/*@ ", "*/"],
    ["  /*@ ", "  */ "], // with leading spaces
    ["\t/*@ ", " \t*/\t "], // with a leading tab
    ["leading string/*@ ", "*/"], // with a leading string
    ["/*@ ", " \t*/\t "], // with trailing whitespace
  ].forEach(x => {
    t.ok(mapFileCommentWrap(x[0], x[1]), `matches ${x.join(" :: ")}`)
  })
  ;[
    ["/*@ ", " */ */ "], // not the last thing on its line
    ["/*@ ", " */ more text "], // not the last thing on its line
  ].forEach(x => {
    t.ok(!mapFileCommentWrap(x[0], x[1]), `does not match ${x.join(" :: ")}`)
  })
  t.end()
})

test("mapFileComment regex /* */ new spec - #", t => {
  ;[
    ["/*# ", "*/"],
    ["  /*# ", "  */ "], // with leading spaces
    ["\t/*# ", " \t*/\t "], // with a leading tab
    ["leading string/*# ", "*/"], // with a leading string
    ["/*# ", " \t*/\t "], // with trailing whitespace
  ].forEach(x => {
    t.ok(mapFileCommentWrap(x[0], x[1]), `matches ${x.join(" :: ")}`)
  })
  ;[
    ["/*# ", " */ */ "], // not the last thing on its line
    ["/*# ", " */ more text "], // not the last thing on its line
  ].forEach(x => {
    t.ok(!mapFileCommentWrap(x[0], x[1]), `does not match ${x.join(" :: ")}`)
  })
  t.end()
})
