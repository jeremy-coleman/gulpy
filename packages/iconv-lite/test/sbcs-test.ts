import assert from "assert"
import unorm from "unorm"
import exports from "../"
import { Iconv } from "iconv"

function convertWithDefault(converter, buf, def) {
  const res = converter.convert(buf)
  return res.length > 0 ? res : def
}

const aliases = {
  armscii8: "ARMSCII-8",
  georgianacademy: "GEORGIAN-ACADEMY",
  georgianps: "GEORGIAN-PS",
  iso646cn: "ISO646-CN",
  iso646jp: "ISO646-JP",
  hproman8: "HP-ROMAN8",
}

function iconvAlias(enc) {
  let r
  if ((r = /windows(\d+)/.exec(enc))) return `WINDOWS-${r[1]}`
  if ((r = /iso8859(\d+)/.exec(enc))) return `ISO8859-${r[1]}`
  if ((r = /koi8(\w+)/.exec(enc))) return `KOI8-${r[1]}`
  if (aliases[enc]) return aliases[enc]
  return enc
}

const normalizedEncodings = { windows1255: true, windows1258: true, tcvn: true }

const combClass = { "\u0327": 202, "\u0323": 220, "\u031B": 216 } // Combining class of unicode characters.
for (let i = 0x300; i < 0x315; i++) combClass[String.fromCharCode(i)] = 230

const iconvEquivChars = {
  cp1163: { Ð: "\u0110", "\u203E": "\u00AF" },
}

function swapBytes(buf) {
  for (let i = 0; i < buf.length; i += 2) buf.writeUInt16LE(buf.readUInt16BE(i), i)
  return buf
}
function spacify2(str) {
  return str.replace(/(..)/g, "$1 ").trim()
}
function spacify4(str) {
  return str.replace(/(....)/g, "$1 ").trim()
}
function strToHex(str) {
  return spacify4(swapBytes(Buffer.from(str, "ucs2")).toString("hex"))
}

// Generate tests for all SBCS encodings.
exports.encode("", "utf8") // Load all encodings.

const sbcsEncodingTests = {}
describe("Full SBCS encoding tests", function () {
  this.timeout(10000)

  for (const enc in exports.encodings)
    if (exports.encodings[enc].type === "_sbcs")
      (enc => {
        const iconvName = iconvAlias(enc)
        const testEncName = enc + (enc !== iconvName ? ` (${iconvName})` : "")

        it(`Decode SBCS encoding ${testEncName}`, function () {
          try {
            var conv = new Iconv(iconvName, "utf-8//IGNORE")
          } catch (e) {
            this.skip()
          }
          const errors = []
          for (let i = 0; i < 0x100; i++) {
            const buf = Buffer.from([i])
            const strActual = exports.decode(buf, enc)
            const strExpected = convertWithDefault(
              conv,
              buf,
              exports.defaultCharUnicode
            ).toString()

            if (strActual != strExpected)
              errors.push({
                input: buf.toString("hex"),
                strExpected,
                strActual,
              })
          }
          if (errors.length > 0)
            assert.fail(
              null,
              null,
              `Decoding mismatch: <input> | <expected> | <actual> | <expected char> | <actual char>\n${errors
                .map(
                  ({ input, strExpected, strActual }) =>
                    `          ${spacify2(input)} | ${strToHex(strExpected)} | ${strToHex(
                      strActual
                    )} | ${strExpected} | ${strActual}`
                )
                .join("\n")}\n       `
            )
        })

        it(`Encode SBCS encoding ${testEncName}`, function () {
          try {
            var conv = new Iconv("utf-8", `${iconvName}//IGNORE`)
          } catch (e) {
            this.skip()
          }
          const errors = []

          for (let i = 0; i < 0xfff0; i++) {
            if (i == 0xd800) i = 0xf900 // Skip surrogates & private use

            const str = String.fromCharCode(i)
            const strExpected = convertWithDefault(
              conv,
              str,
              Buffer.from(exports.defaultCharSingleByte)
            ).toString("hex")
            const strActual = exports.encode(str, enc).toString("hex")

            if (strExpected == strActual) continue

            // We are not supporting unicode normalization/decomposition of input, so skip it.
            // (when single unicode char results in >1 encoded chars because of diacritics)
            if (
              normalizedEncodings[enc] &&
              strActual == exports.defaultCharSingleByte.charCodeAt(0).toString(16)
            ) {
              const strDenormStrict = unorm.nfd(str) // Strict decomposition
              if (strExpected == exports.encode(strDenormStrict, enc).toString("hex"))
                continue

              const strDenorm = unorm.nfkd(str) // Check also compat decomposition.
              if (strExpected == exports.encode(strDenorm, enc).toString("hex")) continue

              // Try semicomposition if we have 2 combining characters.
              if (
                strDenorm.length == 3 &&
                !combClass[strDenorm[0]] &&
                combClass[strDenorm[1]] &&
                combClass[strDenorm[2]]
              ) {
                // Semicompose without swapping.
                const strDenorm2 = unorm.nfc(strDenorm[0] + strDenorm[1]) + strDenorm[2]
                if (strExpected == exports.encode(strDenorm2, enc).toString("hex"))
                  continue

                // Swap combining characters if they have different combining classes, making swap unicode-equivalent.
                const strDenorm3 = unorm.nfc(strDenorm[0] + strDenorm[2]) + strDenorm[1]
                if (strExpected == exports.encode(strDenorm3, enc).toString("hex"))
                  if (combClass[strDenorm[1]] != combClass[strDenorm[2]]) continue
                  // In theory, if combining classes are the same, we can not swap them. But iconv thinks otherwise.
                  // So we skip this too.
                  else continue
              }
            }

            // Iconv sometimes treats some characters as equivalent. Check it and skip.
            if (
              iconvEquivChars[enc] &&
              iconvEquivChars[enc][str] &&
              strExpected ==
                exports.encode(iconvEquivChars[enc][str], enc).toString("hex")
            )
              continue

            errors.push({
              input: strToHex(str),
              inputChar: str,
              strExpected,
              strActual,
            })
          }

          if (errors.length > 0)
            assert.fail(
              null,
              null,
              `Encoding mismatch: <input> | <input char> | <expected> | <actual>\n${errors
                .map(
                  ({ input, inputChar, strExpected, strActual }) =>
                    `          ${input} | ${inputChar} | ${spacify2(
                      strExpected
                    )} | ${spacify2(strActual)}`
                )
                .join("\n")}\n       `
            )
        })

        /*
            // TODO: Implement unicode composition. After that, this test will be meaningful.

            // Create a large random text.
            var buf2 = Buffer.alloc(100);
            for (var i = 0; i < buf2.length; i++)
                buf2[i] = buf[(Math.random()*buf.length) | 0];

            // Check both encoding and decoding.
            assert.strictEqual(JSON.stringify(iconv.decode(buf2, enc)), JSON.stringify(str = conv.convert(buf2).toString()));
            assert.strictEqual(iconv.encode(str, enc).toString('hex'), convBack.convert(Buffer.from(str)).toString('hex'));
            */
      })(enc)
})
