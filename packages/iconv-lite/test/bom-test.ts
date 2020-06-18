import assert from "assert"
import iconv from "../"

const sampleStr = '<?xml version="1.0" encoding="UTF-8"?>\n<俄语>данные</俄语>'
const strBOM = "\ufeff"
const utf8BOM = Buffer.from([0xef, 0xbb, 0xbf])
const utf16beBOM = Buffer.from([0xfe, 0xff])
const utf16leBOM = Buffer.from([0xff, 0xfe])

describe("BOM Handling", () => {
  it("strips UTF-8 BOM", () => {
    const body = Buffer.concat([utf8BOM, Buffer.from(sampleStr)])
    assert.equal(iconv.decode(body, "utf8"), sampleStr)
  })

  it("strips UTF-16 BOM", () => {
    var body = Buffer.concat([utf16leBOM, iconv.encode(sampleStr, "utf16le")])
    assert.equal(iconv.decode(body, "utf16"), sampleStr)
    assert.equal(iconv.decode(body, "utf16le"), sampleStr)

    var body = Buffer.concat([utf16beBOM, iconv.encode(sampleStr, "utf16be")])
    assert.equal(iconv.decode(body, "utf16"), sampleStr)
    assert.equal(iconv.decode(body, "utf16be"), sampleStr)
  })

  it("doesn't strip BOMs when stripBOM=false", () => {
    var body = Buffer.concat([utf8BOM, Buffer.from(sampleStr)])
    assert.equal(iconv.decode(body, "utf8", { stripBOM: false }), strBOM + sampleStr)

    var body = Buffer.concat([utf16leBOM, iconv.encode(sampleStr, "utf16le")])
    assert.equal(iconv.decode(body, "utf16", { stripBOM: false }), strBOM + sampleStr)
    assert.equal(iconv.decode(body, "utf16le", { stripBOM: false }), strBOM + sampleStr)

    var body = Buffer.concat([utf16beBOM, iconv.encode(sampleStr, "utf16be")])
    assert.equal(iconv.decode(body, "utf16", { stripBOM: false }), strBOM + sampleStr)
    assert.equal(iconv.decode(body, "utf16be", { stripBOM: false }), strBOM + sampleStr)
  })

  it("adds/strips UTF-7 BOM", () => {
    const bodyWithBOM = iconv.encode(sampleStr, "utf7", { addBOM: true })
    const body = iconv.encode(sampleStr, "utf7")
    assert.notEqual(body.toString("hex"), bodyWithBOM.toString("hex"))
    assert.equal(iconv.decode(body, "utf7"), sampleStr)
  })

  it("adds UTF-8 BOM when addBOM=true", () => {
    const body = Buffer.concat([utf8BOM, Buffer.from(sampleStr)]).toString("hex")
    assert.equal(iconv.encode(sampleStr, "utf8", { addBOM: true }).toString("hex"), body)
  })

  it("adds UTF-16 BOMs when addBOM=true", () => {
    var body = Buffer.concat([utf16leBOM, iconv.encode(sampleStr, "utf16le")]).toString(
      "hex"
    )
    assert.equal(
      iconv.encode(sampleStr, "utf16le", { addBOM: true }).toString("hex"),
      body
    )

    var body = Buffer.concat([utf16beBOM, iconv.encode(sampleStr, "utf16be")]).toString(
      "hex"
    )
    assert.equal(
      iconv.encode(sampleStr, "utf16be", { addBOM: true }).toString("hex"),
      body
    )
  })

  it("'UTF-16' encoding adds BOM by default, but can be overridden with addBOM=false", () => {
    var body = Buffer.concat([utf16leBOM, iconv.encode(sampleStr, "utf16le")]).toString(
      "hex"
    )
    assert.equal(iconv.encode(sampleStr, "utf16").toString("hex"), body)

    var body = Buffer.concat([iconv.encode(sampleStr, "utf16le")]).toString("hex")
    assert.equal(
      iconv.encode(sampleStr, "utf16", { addBOM: false }).toString("hex"),
      body
    )
  })

  it("when stripping BOM, calls callback 'stripBOM' if provided", () => {
    let bomStripped = false
    const stripBOM = () => {
      bomStripped = true
    }

    let body = Buffer.concat([utf8BOM, Buffer.from(sampleStr)])
    assert.equal(iconv.decode(body, "utf8", { stripBOM }), sampleStr)
    assert(bomStripped)

    bomStripped = false

    body = Buffer.from(sampleStr)
    assert.equal(iconv.decode(body, "utf8", { stripBOM }), sampleStr)
    assert(!bomStripped)
  })
})
