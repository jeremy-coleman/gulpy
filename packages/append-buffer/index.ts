import { EOL } from "os"

const cr = new Buffer("\r\n")
const nl = new Buffer("\n")

/**
 * Append a buffer to another buffer ensuring to preserve line ending characters.
 *
 * ```js
 * console.log([appendBuffer(new Buffer('abc\r\n'), new Buffer('def')).toString()]);
 * //=> [ 'abc\r\ndef\r\n' ]
 *
 * console.log([appendBuffer(new Buffer('abc\n'), new Buffer('def')).toString()]);
 * //=> [ 'abc\ndef\n' ]
 *
 * // uses os.EOL when a line ending is not found
 * console.log([appendBuffer(new Buffer('abc'), new Buffer('def')).toString()]);
 * //=> [ 'abc\ndef' ]
 * * ```
 * @param  {Buffer} `buf` Buffer that will be used to check for an existing line ending. The suffix is appended to this.
 * @param  {Buffer} `suffix` Buffer that will be appended to the buf.
 * @return {Buffer} Final Buffer
 * @api public
 */

export default function appendBuffer(buf: Buffer, suffix: string) {
  if (!suffix || !suffix.length) {
    return buf
  }
  let eol: Buffer
  if (buf.slice(-2).equals(cr)) {
    eol = cr
  } else if (buf.slice(-1).equals(nl)) {
    eol = nl
  } else {
    return Buffer.concat([buf, Buffer.from(EOL), Buffer.from(suffix)])
  }
  return Buffer.concat([buf, Buffer.from(suffix), eol])
}
