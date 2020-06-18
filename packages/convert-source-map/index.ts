import * as fs from "fs"
import * as path from "path"

export const commentRegex = /^\s*\/(?:\/|\*)[@#]\s+sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(?:.*)$/gm

// Matches sourceMappingURL in either // or /* comment styles.
export const mapFileCommentRegex = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"`]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/){1}[ \t]*$)/gm

function decodeBase64(base64) {
  return Buffer.from(base64, "base64").toString()
}

function stripComment(sm) {
  return sm.split(",").pop()
}

function readFromFileMap(sm, dir) {
  // NOTE: this will only work on the server since it attempts to read the map file

  const r = exports.mapFileCommentRegex.exec(sm)

  // for some odd reason //# .. captures in 1 and /* .. */ in 2
  const filename = r[1] || r[2]
  const filepath = path.resolve(dir, filename)

  try {
    return fs.readFileSync(filepath, "utf8")
  } catch (e) {
    throw new Error(
      `An error occurred while trying to read the map file at ${filepath}\n${e}`
    )
  }
}

class Converter {
  constructor(sm, opts = {}) {
    if (opts.isFileComment) sm = readFromFileMap(sm, opts.commentFileDir)
    if (opts.hasComment) sm = stripComment(sm)
    if (opts.isEncoded) sm = decodeBase64(sm)
    if (opts.isJSON || opts.isEncoded) sm = JSON.parse(sm)

    this.sourcemap = sm
  }

  toJSON(space) {
    return JSON.stringify(this.sourcemap, null, space)
  }

  toBase64() {
    const json = this.toJSON()
    return Buffer.from(json, "utf8").toString("base64")
  }

  toComment(options) {
    const base64 = this.toBase64()
    const data = `sourceMappingURL=data:application/json;charset=utf-8;base64,${base64}`
    return options && options.multiline ? `/*# ${data} */` : `//# ${data}`
  }

  // returns copy instead of original
  toObject() {
    return JSON.parse(this.toJSON())
  }

  addProperty(key, value) {
    if (this.sourcemap.hasOwnProperty(key))
      throw new Error(
        `property "${key}" already exists on the sourcemap, use set property instead`
      )
    return this.setProperty(key, value)
  }

  setProperty(key, value) {
    this.sourcemap[key] = value
    return this
  }

  getProperty(key) {
    return this.sourcemap[key]
  }
}

export function fromObject(obj) {
  return new Converter(obj)
}

export function fromJSON(json) {
  return new Converter(json, { isJSON: true })
}

export function fromBase64(base64) {
  return new Converter(base64, { isEncoded: true })
}

export function fromComment(comment) {
  comment = comment.replace(/^\/\*/g, "//").replace(/\*\/$/g, "")

  return new Converter(comment, { isEncoded: true, hasComment: true })
}

export function fromMapFileComment(comment, dir) {
  return new Converter(comment, {
    commentFileDir: dir,
    isFileComment: true,
    isJSON: true,
  })
}

// Finds last sourcemap comment in file or returns null if none was found
export function fromSource(content) {
  const m = content.match(exports.commentRegex)
  return m ? exports.fromComment(m.pop()) : null
}

// Finds last sourcemap comment in file or returns null if none was found
export function fromMapFileSource(content, dir) {
  const m = content.match(exports.mapFileCommentRegex)
  return m ? exports.fromMapFileComment(m.pop(), dir) : null
}

export function removeComments(src) {
  return src.replace(exports.commentRegex, "")
}

export function removeMapFileComments(src) {
  return src.replace(exports.mapFileCommentRegex, "")
}

export function generateMapFileComment(file, options) {
  const data = `sourceMappingURL=${file}`
  return options && options.multiline ? `/*# ${data} */` : `//# ${data}`
}
