import * as path from "path"
import * as fs from "fs"
import * as nal from "now-and-later"
import { File } from "vinyl"
import * as convert from "@local/convert-source-map"
import removeBOM from "remove-bom-buffer"
import appendBuffer from "append-buffer"
import normalizePath from "normalize-path"

const urlRegex = /^(https?|webpack(-[^:]+)?):\/\//

function isRemoteSource(source) {
  return source.match(urlRegex)
}

function parse(data) {
  try {
    return JSON.parse(removeBOM(data))
  } catch (err) {
    // TODO: should this log a debug?
  }
}

function loadSourceMap(file, state, callback) {
  // Try to read inline source map
  state.map = convert.fromSource(state.content)

  if (state.map) {
    state.map = state.map.toObject()
    // Sources in map are relative to the source file
    state.path = file.dirname
    state.content = convert.removeComments(state.content)
    // Remove source map comment from source
    file.contents = new Buffer(state.content, "utf8")
    return callback()
  }

  // Look for source map comment referencing a source map file
  const mapComment = convert.mapFileCommentRegex.exec(state.content)

  let mapFile
  if (mapComment) {
    mapFile = path.resolve(file.dirname, mapComment[1] || mapComment[2])
    state.content = convert.removeMapFileComments(state.content)
    // Remove source map comment from source
    file.contents = new Buffer(state.content, "utf8")
  } else {
    // If no comment try map file with same name as source file
    mapFile = `${file.path}.map`
  }

  // Sources in external map are relative to map file
  state.path = path.dirname(mapFile)

  fs.readFile(mapFile, onRead)

  function onRead(err, data) {
    if (err) {
      return callback()
    }
    state.map = parse(data)
    callback()
  }
}

// Fix source paths and sourceContent for imported source map
function fixImportedSourceMap(file, state, callback) {
  if (!state.map) {
    return callback()
  }

  state.map.sourcesContent = state.map.sourcesContent || []

  nal.map(state.map.sources, normalizeSourcesAndContent, callback)

  function assignSourcesContent(sourceContent, idx) {
    state.map.sourcesContent[idx] = sourceContent
  }

  function normalizeSourcesAndContent(sourcePath, idx, cb) {
    const sourceRoot = state.map.sourceRoot || ""
    const sourceContent = state.map.sourcesContent[idx] || null

    if (isRemoteSource(sourcePath)) {
      assignSourcesContent(sourceContent, idx)
      return cb()
    }

    if (state.map.sourcesContent[idx]) {
      return cb()
    }

    if (sourceRoot && isRemoteSource(sourceRoot)) {
      assignSourcesContent(sourceContent, idx)
      return cb()
    }

    const basePath = path.resolve(file.base, sourceRoot)
    const absPath = path.resolve(state.path, sourceRoot, sourcePath)
    const relPath = path.relative(basePath, absPath)
    const unixRelPath = normalizePath(relPath)

    state.map.sources[idx] = unixRelPath

    if (absPath !== file.path) {
      // Load content from file async
      return fs.readFile(absPath, onRead)
    }

    // If current file: use content
    assignSourcesContent(state.content, idx)
    cb()

    function onRead(err, data) {
      if (err) {
        assignSourcesContent(null, idx)
        return cb()
      }
      assignSourcesContent(removeBOM(data).toString("utf8"), idx)
      cb()
    }
  }
}

function mapsLoaded(file, state, callback) {
  if (!state.map) {
    state.map = {
      version: 3,
      names: [],
      mappings: "",
      sources: [normalizePath(file.relative)],
      sourcesContent: [state.content],
    }
  }

  state.map.file = normalizePath(file.relative)
  file.sourceMap = state.map

  callback()
}

function addSourceMaps(file, state, callback) {
  const tasks = [loadSourceMap, fixImportedSourceMap, mapsLoaded]

  function apply(fn, key, cb) {
    fn(file, state, cb)
  }

  nal.mapSeries(tasks, apply, done)

  function done() {
    callback(null, file)
  }
}

/* Write Helpers */
function createSourceMapFile(opts) {
  return new File({
    cwd: opts.cwd,
    base: opts.base,
    path: opts.path,
    contents: new Buffer(JSON.stringify(opts.content)),
    stat: {
      isFile() {
        return true
      },
      isDirectory() {
        return false
      },
      isBlockDevice() {
        return false
      },
      isCharacterDevice() {
        return false
      },
      isSymbolicLink() {
        return false
      },
      isFIFO() {
        return false
      },
      isSocket() {
        return false
      },
    },
  })
}

const needsMultiline = [".css"]

function getCommentOptions(extname) {
  const opts = {
    multiline: needsMultiline.includes(extname),
  }

  return opts
}

function writeSourceMaps(file, destPath, callback) {
  let sourceMapFile
  const commentOpts = getCommentOptions(file.extname)

  let comment
  if (destPath == null) {
    // Encode source map into comment
    comment = convert.fromObject(file.sourceMap).toComment(commentOpts)
  } else {
    const mapFile = `${path.join(destPath, file.relative)}.map`
    const sourceMapPath = path.join(file.base, mapFile)

    // Create new sourcemap File
    sourceMapFile = createSourceMapFile({
      cwd: file.cwd,
      base: file.base,
      path: sourceMapPath,
      content: file.sourceMap,
    })

    let sourcemapLocation = path.relative(file.dirname, sourceMapPath)

    sourcemapLocation = normalizePath(sourcemapLocation)

    comment = convert.generateMapFileComment(sourcemapLocation, commentOpts)
  }

  // Append source map comment
  file.contents = appendBuffer(file.contents, comment)

  callback(null, file, sourceMapFile)
}

export default {
  addSourceMaps,
  writeSourceMaps,
}
