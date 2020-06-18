import assert from "assert"
import exports from "../"

const testString = "Hello123!"
const testStringLatin1 = "Hello123!£Å÷×çþÿ¿®"
const testStringBase64 = "SGVsbG8xMjMh"
const testStringHex = "48656c6c6f31323321"

describe("Generic UTF8-UCS2 tests", () => {
  it("Return values are of correct types", () => {
    assert.ok(Buffer.isBuffer(exports.encode(testString, "utf8")))

    const s = exports.decode(Buffer.from(testString), "utf8")
    assert.strictEqual(Object.prototype.toString.call(s), "[object String]")
  })

  it("Internal encodings all correctly encoded/decoded", () => {
    ;["utf8", "UTF-8", "UCS2", "binary"].forEach(enc => {
      assert.strictEqual(
        exports.encode(testStringLatin1, enc).toString(enc),
        testStringLatin1
      )
      assert.strictEqual(
        exports.decode(Buffer.from(testStringLatin1, enc), enc),
        testStringLatin1
      )
    })
  })

  it("Base64 correctly encoded/decoded", () => {
    assert.strictEqual(
      exports.encode(testStringBase64, "base64").toString("binary"),
      testString
    )
    assert.strictEqual(
      exports.decode(Buffer.from(testString, "binary"), "base64"),
      testStringBase64
    )
  })

  it("Hex correctly encoded/decoded", () => {
    assert.strictEqual(
      exports.encode(testStringHex, "hex").toString("binary"),
      testString
    )
    assert.strictEqual(
      exports.decode(Buffer.from(testString, "binary"), "hex"),
      testStringHex
    )
  })

  it("Latin1 correctly encoded/decoded", () => {
    assert.strictEqual(
      exports.encode(testStringLatin1, "latin1").toString("binary"),
      testStringLatin1
    )
    assert.strictEqual(
      exports.decode(Buffer.from(testStringLatin1, "binary"), "latin1"),
      testStringLatin1
    )
  })

  it("Convert to string, not buffer (utf8 used)", () => {
    const res = exports.encode(Buffer.from(testStringLatin1, "utf8"), "utf8")
    assert.ok(Buffer.isBuffer(res))
    assert.strictEqual(res.toString("utf8"), testStringLatin1)
  })

  it("Throws on unknown encodings", () => {
    assert.throws(() => {
      exports.encode("a", "xxx")
    })
    assert.throws(() => {
      exports.decode(Buffer.from("a"), "xxx")
    })
  })

  it("Convert non-strings and non-buffers", () => {
    assert.strictEqual(exports.encode({}, "utf8").toString(), "[object Object]")
    assert.strictEqual(exports.encode(10, "utf8").toString(), "10")
    assert.strictEqual(exports.encode(undefined, "utf8").toString(), "")
  })

  it("Aliases toEncoding and fromEncoding work the same as encode and decode", () => {
    assert.strictEqual(
      exports.toEncoding(testString, "latin1").toString("binary"),
      exports.encode(testString, "latin1").toString("binary")
    )
    assert.strictEqual(
      exports.fromEncoding(Buffer.from(testStringLatin1), "latin1"),
      exports.decode(Buffer.from(testStringLatin1), "latin1")
    )
  })

  it("handles Object & Array prototypes monkey patching", () => {
    Object.prototype.permits = () => {}
    Array.prototype.sample2 = () => {}

    exports._codecDataCache = {} // Clean up cache so that all encodings are loaded.

    assert.strictEqual(exports.decode(Buffer.from("abc"), "gbk"), "abc")
    assert.strictEqual(exports.decode(Buffer.from("abc"), "win1251"), "abc")
    assert.strictEqual(exports.decode(Buffer.from("abc"), "utf7"), "abc")
    assert.strictEqual(exports.decode(Buffer.from("abc"), "utf8"), "abc")

    assert.strictEqual(exports.encode("abc", "gbk").toString(), "abc")
    assert.strictEqual(exports.encode("abc", "win1251").toString(), "abc")
    assert.strictEqual(exports.encode("abc", "utf7").toString(), "abc")
    assert.strictEqual(exports.encode("abc", "utf8").toString(), "abc")

    delete Object.prototype.permits
    delete Array.prototype.sample2
  })

  it("handles encoding untranslatable characters correctly", () => {
    // Regression #162
    assert.strictEqual(exports.encode("外国人", "latin1").toString(), "???")
  })
})

describe("Canonicalize encoding function", () => {
  it("works with numbers directly", () => {
    assert.equal(exports._canonicalizeEncoding(955), "955")
  })

  it("correctly strips year and non-alpha chars", () => {
    assert.equal(exports._canonicalizeEncoding("ISO_8859-5:1988"), "iso88595")
  })
})
