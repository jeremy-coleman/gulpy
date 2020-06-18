// Multibyte codec. In this scheme, a character is represented by 1 or more bytes.
// Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.
// To save memory and loading time, we read table files only when requested.

import { isFunction, isNumber, isString } from "lodash"
import { isObject } from "@local/picomatch/lib/utils"

export { DBCSCodec as _dbcs }

const UNASSIGNED = -1
const GB18030_CODE = -2
const SEQ_START = -10
const NODE_START = -1000
const UNASSIGNED_NODE = new Array(0x100)
const DEF_CHAR = -1

for (let i = 0; i < 0x100; i++) UNASSIGNED_NODE[i] = UNASSIGNED

// Class DBCSCodec reads and initializes mapping tables.
class DBCSCodec {
  decodeTables: number[][]

  constructor(codecOptions, { defaultCharUnicode, defaultCharSingleByte }) {
    this.encodingName = codecOptions.encodingName
    if (!codecOptions) throw Error("DBCS codec is called without the data.")
    if (!codecOptions.table) throw Error(`Encoding '${this.encodingName}' has no data.`)

    // Load tables.
    const mappingTable = codecOptions.table()

    // Decode tables: MBCS -> Unicode.

    // decodeTables is a trie, encoded as an array of arrays of integers. Internal arrays are trie nodes and all have len = 256.
    // Trie root is decodeTables[0].
    // Values: >=  0 -> unicode character code. can be > 0xFFFF
    //         == UNASSIGNED -> unknown/unassigned sequence.
    //         == GB18030_CODE -> this is the end of a GB18030 4-byte sequence.
    //         <= NODE_START -> index of the next node in our trie to process next byte.
    //         <= SEQ_START  -> index of the start of a character code sequence, in decodeTableSeq.
    this.decodeTables = []
    this.decodeTables[0] = UNASSIGNED_NODE.slice(0) // Create root node.

    // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here.
    this.decodeTableSeq = []

    // Actual mapping tables consist of chunks. Use them to fill up decode tables.
    for (var i = 0; i < mappingTable.length; i++) this._addDecodeChunk(mappingTable[i])

    // Load & create GB18030 tables when needed.
    if (isFunction(codecOptions.gb18030)) {
      this.gb18030 = codecOptions.gb18030() // Load GB18030 ranges.

      // Add GB18030 common decode nodes.
      const commonThirdByteNodeIdx = this.decodeTables.length
      this.decodeTables.push(UNASSIGNED_NODE.slice(0))

      const commonFourthByteNodeIdx = this.decodeTables.length
      this.decodeTables.push(UNASSIGNED_NODE.slice(0))

      // Fill out the tree
      const firstByteNode = this.decodeTables[0]
      for (var i = 0x81; i <= 0xfe; i++) {
        const secondByteNode = this.decodeTables[NODE_START - firstByteNode[i]]
        for (var j = 0x30; j <= 0x39; j++) {
          if (secondByteNode[j] === UNASSIGNED) {
            secondByteNode[j] = NODE_START - commonThirdByteNodeIdx
          } else if (secondByteNode[j] > NODE_START) {
            throw Error("gb18030 decode tables conflict at byte 2")
          }

          const thirdByteNode = this.decodeTables[NODE_START - secondByteNode[j]]
          for (let k = 0x81; k <= 0xfe; k++) {
            if (thirdByteNode[k] === UNASSIGNED) {
              thirdByteNode[k] = NODE_START - commonFourthByteNodeIdx
            } else if (thirdByteNode[k] === NODE_START - commonFourthByteNodeIdx) {
              continue
            } else if (thirdByteNode[k] > NODE_START) {
              throw Error("gb18030 decode tables conflict at byte 3")
            }

            const fourthByteNode = this.decodeTables[NODE_START - thirdByteNode[k]]
            for (let l = 0x30; l <= 0x39; l++) {
              if (fourthByteNode[l] === UNASSIGNED) fourthByteNode[l] = GB18030_CODE
            }
          }
        }
      }
    }

    this.defaultCharUnicode = defaultCharUnicode

    // Encode tables: Unicode -> DBCS.

    // `encodeTable` is array mapping from unicode char to encoded char. All its values are integers for performance.
    // Because it can be sparse, it is represented as array of buckets by 256 chars each. Bucket can be null.
    // Values: >=  0 -> it is a normal char. Write the value (if <=256 then 1 byte, if <=65536 then 2 bytes, etc.).
    //         == UNASSIGNED -> no conversion found. Output a default char.
    //         <= SEQ_START  -> it's an index in encodeTableSeq, see below. The character starts a sequence.
    this.encodeTable = []

    // `encodeTableSeq` is used when a sequence of unicode characters is encoded as a single code. We use a tree of
    // objects where keys correspond to characters in sequence and leafs are the encoded dbcs values. A special DEF_CHAR key
    // means end of sequence (needed when one sequence is a strict subsequence of another).
    // Objects are kept separately from encodeTable to increase performance.
    this.encodeTableSeq = []

    // Some chars can be decoded, but need not be encoded.
    const skipEncodeChars = {}
    if (codecOptions.encodeSkipVals)
      for (var i = 0; i < codecOptions.encodeSkipVals.length; i++) {
        const val = codecOptions.encodeSkipVals[i]
        if (isNumber(val)) skipEncodeChars[val] = true
        else for (var j = val.from; j <= val.to; j++) skipEncodeChars[j] = true
      }

    // Use decode trie to recursively fill out encode tables.
    this._fillEncodeTable(0, 0, skipEncodeChars)

    // Add more encoding pairs when needed.
    if (codecOptions.encodeAdd) {
      for (const uChar in codecOptions.encodeAdd)
        if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar))
          this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar])
    }

    this.defCharSB = this.encodeTable[0][defaultCharSingleByte.charCodeAt(0)]
    if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]["?"]
    if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0)
  }

  // Decoder helpers
  _getDecodeTrieNode(addr) {
    const bytes = []
    for (; addr > 0; addr >>>= 8) bytes.push(addr & 0xff)
    if (bytes.length == 0) bytes.push(0)

    let node = this.decodeTables[0]
    for (let i = bytes.length - 1; i > 0; i--) {
      // Traverse nodes deeper into the trie.
      const val = node[bytes[i]]

      if (val == UNASSIGNED) {
        // Create new node.
        node[bytes[i]] = NODE_START - this.decodeTables.length
        this.decodeTables.push((node = UNASSIGNED_NODE.slice(0)))
      } else if (val <= NODE_START) {
        // Existing node.
        node = this.decodeTables[NODE_START - val]
      } else
        throw Error(`Overwrite byte in ${this.encodingName}, addr: ${addr.toString(16)}`)
    }
    return node
  }

  _addDecodeChunk(chunk) {
    // First element of chunk is the hex mbcs code where we start.
    let curAddr = parseInt(chunk[0], 16)

    // Choose the decoding node where we'll write our chars.
    const writeTable = this._getDecodeTrieNode(curAddr)
    curAddr = curAddr & 0xff

    // Write all other elements of the chunk to the table.
    for (let k = 1; k < chunk.length; k++) {
      const part = chunk[k]
      if (isString(part)) {
        // String, write as-is.
        for (var l = 0; l < part.length; ) {
          const code = part.charCodeAt(l++)
          if (0xd800 <= code && code < 0xdc00) {
            // Decode surrogate
            const codeTrail = part.charCodeAt(l++)
            if (0xdc00 <= codeTrail && codeTrail < 0xe000)
              writeTable[curAddr++] =
                0x10000 + (code - 0xd800) * 0x400 + (codeTrail - 0xdc00)
            else
              throw Error(
                `Incorrect surrogate pair in ${this.encodingName} at chunk ${chunk[0]}`
              )
          } else if (0x0ff0 < code && code <= 0x0fff) {
            // Character sequence (our own encoding used)
            const len = 0xfff - code + 2
            const seq = []
            for (let m = 0; m < len; m++) seq.push(part.charCodeAt(l++)) // Simple variation: don't support surrogates or subsequences in seq.

            writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length
            this.decodeTableSeq.push(seq)
          } else writeTable[curAddr++] = code // Basic char
        }
      } else if (isNumber(part)) {
        // Integer, meaning increasing sequence starting with prev character.
        let charCode = writeTable[curAddr - 1] + 1
        for (var l = 0; l < part; l++) writeTable[curAddr++] = charCode++
      } else
        throw Error(
          `Incorrect type '${typeof part}' given in ${this.encodingName} at chunk ${
            chunk[0]
          }`
        )
    }
    if (curAddr > 0xff)
      throw Error(
        `Incorrect chunk in ${this.encodingName} at addr ${chunk[0]}: too long${curAddr}`
      )
  }

  // Encoder helpers
  _getEncodeBucket(uCode) {
    const high = uCode >> 8 // This could be > 0xFF because of astral characters.
    if (this.encodeTable[high] === undefined)
      this.encodeTable[high] = UNASSIGNED_NODE.slice(0) // Create bucket on demand.
    return this.encodeTable[high]
  }

  _setEncodeChar(uCode, dbcsCode) {
    const bucket = this._getEncodeBucket(uCode)
    const low = uCode & 0xff
    if (bucket[low] <= SEQ_START)
      this.encodeTableSeq[SEQ_START - bucket[low]][DEF_CHAR] = dbcsCode
    // There's already a sequence, set a single-char subsequence of it.
    else if (bucket[low] == UNASSIGNED) bucket[low] = dbcsCode
  }

  _setEncodeSequence(seq, dbcsCode) {
    // Get the root of character tree according to first character of the sequence.
    let uCode = seq[0]
    const bucket = this._getEncodeBucket(uCode)
    const low = uCode & 0xff

    let node
    if (bucket[low] <= SEQ_START) {
      // There's already a sequence with  - use it.
      node = this.encodeTableSeq[SEQ_START - bucket[low]]
    } else {
      // There was no sequence object - allocate a new one.
      node = {}
      if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low] // If a char was set before - make it a single-char subsequence.
      bucket[low] = SEQ_START - this.encodeTableSeq.length
      this.encodeTableSeq.push(node)
    }

    // Traverse the character tree, allocating new nodes as needed.
    for (let j = 1; j < seq.length - 1; j++) {
      const oldVal = node[uCode]
      if (isObject(oldVal)) {
        node = oldVal
      } else {
        node = node[uCode] = {}
        if (oldVal !== undefined) node[DEF_CHAR] = oldVal
      }
    }

    // Set the leaf to given dbcsCode.
    uCode = seq[seq.length - 1]
    node[uCode] = dbcsCode
  }

  _fillEncodeTable(nodeIdx, prefix, skipEncodeChars) {
    const node = this.decodeTables[nodeIdx]
    let hasValues = false
    const subNodeEmpty = {}
    for (let i = 0; i < 0x100; i++) {
      const uCode = node[i]
      const mbCode = prefix + i
      if (skipEncodeChars[mbCode]) continue

      if (uCode >= 0) {
        this._setEncodeChar(uCode, mbCode)
        hasValues = true
      } else if (uCode <= NODE_START) {
        const subNodeIdx = NODE_START - uCode
        if (!subNodeEmpty[subNodeIdx]) {
          // Skip empty subtrees (they are too large in gb18030).
          const newPrefix = (mbCode << 8) >>> 0 // NOTE: '>>> 0' keeps 32-bit num positive.
          if (this._fillEncodeTable(subNodeIdx, newPrefix, skipEncodeChars))
            hasValues = true
          else subNodeEmpty[subNodeIdx] = true
        }
      } else if (uCode <= SEQ_START) {
        this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode)
        hasValues = true
      }
    }
    return hasValues
  }
}

DBCSCodec.prototype.encoder = DBCSEncoder
DBCSCodec.prototype.decoder = DBCSDecoder

// == Encoder ==================================================================

class DBCSEncoder {
  constructor(options, { encodeTable, encodeTableSeq, defCharSB, gb18030 }) {
    // Encoder state
    this.leadSurrogate = -1
    this.seqObj = undefined

    // Static data
    this.encodeTable = encodeTable
    this.encodeTableSeq = encodeTableSeq
    this.defaultCharSingleByte = defCharSB
    this.gb18030 = gb18030
  }

  write(str) {
    const newBuf = Buffer.alloc(str.length * (this.gb18030 ? 4 : 3))
    let leadSurrogate = this.leadSurrogate
    let seqObj = this.seqObj
    let nextChar = -1
    let i = 0
    let j = 0

    while (true) {
      // 0. Get next character.
      if (nextChar === -1) {
        if (i == str.length) break
        var uCode = str.charCodeAt(i++)
      } else {
        var uCode = nextChar
        nextChar = -1
      }

      // 1. Handle surrogates.
      if (0xd800 <= uCode && uCode < 0xe000) {
        // Char is one of surrogates.
        if (uCode < 0xdc00) {
          // We've got lead surrogate.
          if (leadSurrogate === -1) {
            leadSurrogate = uCode
            continue
          } else {
            leadSurrogate = uCode
            // Double lead surrogate found.
            uCode = UNASSIGNED
          }
        } else {
          // We've got trail surrogate.
          if (leadSurrogate !== -1) {
            uCode = 0x10000 + (leadSurrogate - 0xd800) * 0x400 + (uCode - 0xdc00)
            leadSurrogate = -1
          } else {
            // Incomplete surrogate pair - only trail surrogate found.
            uCode = UNASSIGNED
          }
        }
      } else if (leadSurrogate !== -1) {
        // Incomplete surrogate pair - only lead surrogate found.
        nextChar = uCode
        uCode = UNASSIGNED // Write an error, then current char.
        leadSurrogate = -1
      }

      // 2. Convert uCode character.
      var dbcsCode = UNASSIGNED
      if (seqObj !== undefined && uCode != UNASSIGNED) {
        // We are in the middle of the sequence
        let resCode = seqObj[uCode]
        if (isObject(resCode)) {
          // Sequence continues.
          seqObj = resCode
          continue
        } else if (isNumber(resCode)) {
          // Sequence finished. Write it.
          dbcsCode = resCode
        } else if (resCode == undefined) {
          // Current character is not part of the sequence.

          // Try default character for this sequence
          resCode = seqObj[DEF_CHAR]
          if (resCode !== undefined) {
            dbcsCode = resCode // Found. Write it.
            nextChar = uCode // Current character will be written too in the next iteration.
          } else {
            // TODO: What if we have no default? (resCode == undefined)
            // Then, we should write first char of the sequence as-is and try the rest recursively.
            // Didn't do it for now because no encoding has this situation yet.
            // Currently, just skip the sequence and write current char.
          }
        }
        seqObj = undefined
      } else if (uCode >= 0) {
        // Regular character
        const subtable = this.encodeTable[uCode >> 8]
        if (subtable !== undefined) dbcsCode = subtable[uCode & 0xff]

        if (dbcsCode <= SEQ_START) {
          // Sequence start
          seqObj = this.encodeTableSeq[SEQ_START - dbcsCode]
          continue
        }

        if (dbcsCode == UNASSIGNED && this.gb18030) {
          // Use GB18030 algorithm to find character(s) to write.
          const idx = findIdx(this.gb18030.uChars, uCode)
          if (idx != -1) {
            var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx])
            newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600)
            dbcsCode = dbcsCode % 12600
            newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260)
            dbcsCode = dbcsCode % 1260
            newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10)
            dbcsCode = dbcsCode % 10
            newBuf[j++] = 0x30 + dbcsCode
            continue
          }
        }
      }

      // 3. Write dbcsCode character.
      if (dbcsCode === UNASSIGNED) dbcsCode = this.defaultCharSingleByte

      if (dbcsCode < 0x100) {
        newBuf[j++] = dbcsCode
      } else if (dbcsCode < 0x10000) {
        newBuf[j++] = dbcsCode >> 8 // high byte
        newBuf[j++] = dbcsCode & 0xff // low byte
      } else if (dbcsCode < 0x1000000) {
        newBuf[j++] = dbcsCode >> 16
        newBuf[j++] = (dbcsCode >> 8) & 0xff
        newBuf[j++] = dbcsCode & 0xff
      } else {
        newBuf[j++] = dbcsCode >>> 24
        newBuf[j++] = (dbcsCode >>> 16) & 0xff
        newBuf[j++] = (dbcsCode >>> 8) & 0xff
        newBuf[j++] = dbcsCode & 0xff
      }
    }

    this.seqObj = seqObj
    this.leadSurrogate = leadSurrogate
    return newBuf.slice(0, j)
  }

  end() {
    if (this.leadSurrogate === -1 && this.seqObj === undefined) return // All clean. Most often case.

    const newBuf = Buffer.alloc(10)
    let j = 0

    if (this.seqObj) {
      // We're in the sequence.
      const dbcsCode = this.seqObj[DEF_CHAR]
      if (dbcsCode !== undefined) {
        // Write beginning of the sequence.
        if (dbcsCode < 0x100) {
          newBuf[j++] = dbcsCode
        } else {
          newBuf[j++] = dbcsCode >> 8 // high byte
          newBuf[j++] = dbcsCode & 0xff // low byte
        }
      } else {
        // See todo above.
      }
      this.seqObj = undefined
    }

    if (this.leadSurrogate !== -1) {
      // Incomplete surrogate pair - only lead surrogate found.
      newBuf[j++] = this.defaultCharSingleByte
      this.leadSurrogate = -1
    }

    return newBuf.slice(0, j)
  }
}

// Export for testing
DBCSEncoder.prototype.findIdx = findIdx

// == Decoder ==================================================================

class DBCSDecoder {
  constructor(options, { decodeTables, decodeTableSeq, defaultCharUnicode, gb18030 }) {
    // Decoder state
    this.nodeIdx = 0
    this.prevBuf = Buffer.alloc(0)

    // Static data
    this.decodeTables = decodeTables
    this.decodeTableSeq = decodeTableSeq
    this.defaultCharUnicode = defaultCharUnicode
    this.gb18030 = gb18030
  }

  write(buf) {
    const newBuf = Buffer.alloc(buf.length * 2)
    let nodeIdx = this.nodeIdx
    let prevBuf = this.prevBuf
    const prevBufOffset = this.prevBuf.length

    let // idx of the start of current parsed sequence.
      seqStart = -this.prevBuf.length

    var uCode

    if (prevBufOffset > 0)
      // Make prev buf overlap a little to make it easier to slice later.
      prevBuf = Buffer.concat([prevBuf, buf.slice(0, 10)])

    for (var i = 0, j = 0; i < buf.length; i++) {
      const curByte = i >= 0 ? buf[i] : prevBuf[i + prevBufOffset]

      // Lookup in current trie node.
      var uCode = this.decodeTables[nodeIdx][curByte]

      if (uCode >= 0) {
        // Normal character, just use it.
      } else if (uCode === UNASSIGNED) {
        // Unknown char.
        // TODO: Callback with seq.
        //var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
        i = seqStart // Try to parse again, after skipping first byte of the sequence ('i' will be incremented by 'for' cycle).
        uCode = this.defaultCharUnicode.charCodeAt(0)
      } else if (uCode === GB18030_CODE) {
        const curSeq =
          seqStart >= 0
            ? buf.slice(seqStart, i + 1)
            : prevBuf.slice(seqStart + prevBufOffset, i + 1 + prevBufOffset)
        const ptr =
          (curSeq[0] - 0x81) * 12600 +
          (curSeq[1] - 0x30) * 1260 +
          (curSeq[2] - 0x81) * 10 +
          (curSeq[3] - 0x30)
        const idx = findIdx(this.gb18030.gbChars, ptr)
        uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx]
      } else if (uCode <= NODE_START) {
        // Go to next trie node.
        nodeIdx = NODE_START - uCode
        continue
      } else if (uCode <= SEQ_START) {
        // Output a sequence of chars.
        const seq = this.decodeTableSeq[SEQ_START - uCode]
        for (let k = 0; k < seq.length - 1; k++) {
          uCode = seq[k]
          newBuf[j++] = uCode & 0xff
          newBuf[j++] = uCode >> 8
        }
        uCode = seq[seq.length - 1]
      } else
        throw Error(
          `iconv-lite internal error: invalid decoding table value ${uCode} at ${nodeIdx}/${curByte}`
        )

      // Write the character to buffer, handling higher planes using surrogate pair.
      if (uCode > 0xffff) {
        uCode -= 0x10000
        const uCodeLead = 0xd800 + Math.floor(uCode / 0x400)
        newBuf[j++] = uCodeLead & 0xff
        newBuf[j++] = uCodeLead >> 8

        uCode = 0xdc00 + (uCode % 0x400)
      }
      newBuf[j++] = uCode & 0xff
      newBuf[j++] = uCode >> 8

      // Reset trie node.
      nodeIdx = 0
      seqStart = i + 1
    }

    this.nodeIdx = nodeIdx
    this.prevBuf =
      seqStart >= 0 ? buf.slice(seqStart) : prevBuf.slice(seqStart + prevBufOffset)
    return newBuf.slice(0, j).toString("ucs2")
  }

  end() {
    let ret = ""

    // Try to parse all remaining chars.
    while (this.prevBuf.length > 0) {
      // Skip 1 character in the buffer.
      ret += this.defaultCharUnicode
      const buf = this.prevBuf.slice(1)

      // Parse remaining as usual.
      this.prevBuf = Buffer.alloc(0)
      this.nodeIdx = 0
      if (buf.length > 0) ret += this.write(buf)
    }

    this.nodeIdx = 0
    return ret
  }
}

// Binary search for GB18030. Returns largest i such that table[i] <= val.
function findIdx(table, val) {
  if (table[0] > val) return -1

  let l = 0
  let r = table.length
  while (l < r - 1) {
    // always table[l] <= val < table[r]
    const mid = l + Math.floor((r - l + 1) / 2)
    if (table[mid] <= val) l = mid
    else r = mid
  }
  return l
}
