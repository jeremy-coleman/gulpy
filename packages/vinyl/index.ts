import * as path from "path"
import * as util from "util"
import * as fs from "fs"

import clone from "clone"
import cloneable from "cloneable-readable"
import replaceExt from "replace-ext"
import cloneStats from "clone-stats"
import cloneBuffer from "clone-buffer"
import removeTrailingSep from "remove-trailing-separator"
import isStream from "./lib/is-stream"
import normalize from "./lib/normalize"
import inspectStream from "./lib/inspect-stream"

const builtInFields = [
  "_contents",
  "_symlink",
  "contents",
  "stat",
  "history",
  "path",
  "_base",
  "base",
  "_cwd",
  "cwd",
]

// Type definitions for vinyl 2.0
// Project: https://github.com/gulpjs/vinyl
// Definitions by: vvakame <https://github.com/vvakame>, jedmao <https://github.com/jedmao>, Georgii Dolzhykov <https://github.com/thorn0>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

interface ConstructorOptions {
  /**
   * The current working directory of the file. Default: process.cwd()
   */
  cwd?: string

  /**
   * Used for relative pathing. Typically where a glob starts. Default: options.cwd
   */
  base?: string

  /**
   * Full path to the file.
   */
  path?: string

  /**
   * Stores the path history. If `options.path` and `options.history` are both passed,
   * `options.path` is appended to `options.history`. All `options.history` paths are
   * normalized by the `file.path` setter.
   * Default: `[]` (or `[options.path]` if `options.path` is passed)
   */
  history?: string[]

  /**
   * The result of an fs.stat call. This is how you mark the file as a directory or
   * symbolic link. See `isDirectory()`, `isSymbolic()` and `fs.Stats` for more information.
   * http://nodejs.org/api/fs.html#fs_class_fs_stats
   */
  stat?: fs.Stats

  /**
   * File contents.
   * Type: `Buffer`, `Stream`, or null
   * Default: null
   */
  contents?: Buffer | NodeJS.ReadableStream | null

  /**
   * Any custom option properties will be directly assigned to the new Vinyl object.
   */
  [customOption: string]: any
}

interface FileConstructor {
  new (options: ConstructorOptions & { contents: null }): File.NullFile
  new (options: ConstructorOptions & { contents: Buffer }): File.BufferFile
  new (options: ConstructorOptions & { contents: NodeJS.ReadableStream }): File.StreamFile
  new (options?: ConstructorOptions): File

  /**
   * Checks if a given object is a vinyl file.
   */
  isVinyl(obj: any): obj is File

  /**
   * Checks if a property is not managed internally.
   */
  isCustomProp(name: string): boolean

  prototype: File
}

interface File {
  /**
   * Gets and sets the contents of the file. If set to a `Stream`, it is wrapped in
   * a `cloneable-readable` stream.
   *
   * Throws when set to any value other than a `Stream`, a `Buffer` or `null`.
   */
  contents: Buffer | NodeJS.ReadableStream | null

  /**
   * Gets and sets current working directory. Will always be normalized and have trailing
   * separators removed.
   *
   * Throws when set to any value other than non-empty strings.
   */
  cwd: string

  //
  /**
   * Gets and sets base directory. Used for relative pathing (typically where a glob starts).
   * When `null` or `undefined`, it simply proxies the `file.cwd` property. Will always be
   * normalized and have trailing separators removed.
   *
   * Throws when set to any value other than non-empty strings or `null`/`undefined`.
   *
   * The setter's type is actually `string | null | undefined`, but TypeScript doesn't allow
   * get/set accessors to be of different type. The property is declared as `string` for the
   * compiler not to require useless null checks for the getter. (Hopefully, noone will need
   * to assign `null` to this property.)
   */
  base: string

  /**
   * Gets and sets the absolute pathname string or `undefined`. Setting to a different value
   * appends the new path to `file.history`. If set to the same value as the current path, it
   * is ignored. All new values are normalized and have trailing separators removed.
   *
   * Throws when set to any value other than a string.
   *
   * The getter is actually of type `string | undefined` whereas the setter is just `string`,
   * however TypeScript doesn't allow get/set accessors to be of different type. See the
   * comment for the `base` properties.
   */
  path: string

  /**
   * Array of `file.path` values the Vinyl object has had, from `file.history[0]` (original)
   * through `file.history[file.history.length - 1]` (current). `file.history` and its elements
   * should normally be treated as read-only and only altered indirectly by setting `file.path`.
   */
  readonly history: ReadonlyArray<string>

  /**
   * Gets the result of `path.relative(file.base, file.path)`.
   *
   * Throws when set or when `file.path` is not set.
   *
   * Example:
   *
   * ```js
   * var file = new File({
   *   cwd: '/',
   *   base: '/test/',
   *   path: '/test/file.js'
   * });
   *
   * console.log(file.relative); // file.js
   * ```
   */
  relative: string

  /**
   * Gets and sets the dirname of `file.path`. Will always be normalized and have trailing
   * separators removed.
   *
   * Throws when `file.path` is not set.
   *
   * Example:
   *
   * ```js
   * var file = new File({
   *   cwd: '/',
   *   base: '/test/',
   *   path: '/test/file.js'
   * });
   *
   * console.log(file.dirname); // /test
   *
   * file.dirname = '/specs';
   *
   * console.log(file.dirname); // /specs
   * console.log(file.path); // /specs/file.js
   * ```
   */
  dirname: string

  /**
   * Gets and sets the basename of `file.path`.
   *
   * Throws when `file.path` is not set.
   *
   * Example:
   *
   * ```js
   * var file = new File({
   *   cwd: '/',
   *   base: '/test/',
   *   path: '/test/file.js'
   * });
   *
   * console.log(file.basename); // file.js
   *
   * file.basename = 'file.txt';
   *
   * console.log(file.basename); // file.txt
   * console.log(file.path); // /test/file.txt
   * ```
   */
  basename: string

  /**
   * Gets and sets stem (filename without suffix) of `file.path`.
   *
   * Throws when `file.path` is not set.
   *
   * Example:
   *
   * ```js
   * var file = new File({
   *   cwd: '/',
   *   base: '/test/',
   *   path: '/test/file.js'
   * });
   *
   * console.log(file.stem); // file
   *
   * file.stem = 'foo';
   *
   * console.log(file.stem); // foo
   * console.log(file.path); // /test/foo.js
   * ```
   */
  stem: string

  /**
   * Gets and sets extname of `file.path`.
   *
   * Throws when `file.path` is not set.
   *
   * Example:
   *
   * ```js
   * var file = new File({
   *   cwd: '/',
   *   base: '/test/',
   *   path: '/test/file.js'
   * });
   *
   * console.log(file.extname); // .js
   *
   * file.extname = '.txt';
   *
   * console.log(file.extname); // .txt
   * console.log(file.path); // /test/file.txt
   * ```
   */
  extname: string

  /**
   * Gets and sets the path where the file points to if it's a symbolic link. Will always
   * be normalized and have trailing separators removed.
   *
   * Throws when set to any value other than a string.
   */
  symlink: string | null

  stat: fs.Stats | null

  [customProperty: string]: any

  /**
   * Returns `true` if the file contents are a `Buffer`, otherwise `false`.
   */
  isBuffer(): this is File.BufferFile

  /**
   * Returns `true` if the file contents are a `Stream`, otherwise `false`.
   */
  isStream(): this is File.StreamFile

  /**
   * Returns `true` if the file contents are `null`, otherwise `false`.
   */
  isNull(): this is File.NullFile

  /**
   * Returns `true` if the file represents a directory, otherwise `false`.
   *
   * A file is considered a directory when:
   *
   * - `file.isNull()` is `true`
   * - `file.stat` is an object
   * - `file.stat.isDirectory()` returns `true`
   *
   * When constructing a Vinyl object, pass in a valid `fs.Stats` object via `options.stat`.
   * If you are mocking the `fs.Stats` object, you may need to stub the `isDirectory()` method.
   */
  isDirectory(): this is File.DirectoryFile

  /**
   * Returns `true` if the file represents a symbolic link, otherwise `false`.
   *
   * A file is considered symbolic when:
   *
   * - `file.isNull()` is `true`
   * - `file.stat` is an object
   * - `file.stat.isSymbolicLink()` returns `true`
   *
   * When constructing a Vinyl object, pass in a valid `fs.Stats` object via `options.stat`.
   * If you are mocking the `fs.Stats` object, you may need to stub the `isSymbolicLink()` method.
   */
  isSymbolic(): this is File.SymbolicFile

  /**
   * Returns a new Vinyl object with all attributes cloned.
   *
   * __By default custom attributes are cloned deeply.__
   *
   * If `options` or `options.deep` is `false`, custom attributes will not be cloned deeply.
   *
   * If `file.contents` is a `Buffer` and `options.contents` is `false`, the `Buffer` reference
   * will be reused instead of copied.
   */
  clone(opts?: { contents?: boolean; deep?: boolean } | boolean): this

  /**
   * Returns a formatted-string interpretation of the Vinyl object.
   * Automatically called by node's `console.log`.
   */
  inspect(): string

  /**
   * @deprecated This method was removed in v2.0.
   * If file.contents is a Buffer, it will write it to the stream.
   * If file.contents is a Stream, it will pipe it to the stream.
   * If file.contents is null, it will do nothing.
   */
  pipe<T extends NodeJS.WritableStream>(
    stream: T,
    opts?: {
      /**
       * If false, the destination stream will not be ended (same as node core).
       */
      end?: boolean
    }
  ): T
}

declare namespace File {
  // See https://github.com/Microsoft/TypeScript/issues/11796

  interface BufferFile extends File {
    contents: Buffer
    isStream(): this is never
    isBuffer(): true
    isNull(): this is never
    isDirectory(): this is never
    isSymbolic(): this is never
  }

  interface StreamFile extends File {
    contents: NodeJS.ReadableStream
    isStream(): true
    isBuffer(): this is never
    isNull(): this is never
    isDirectory(): this is never
    isSymbolic(): this is never
  }

  interface NullFile extends File {
    contents: null
    isStream(): this is never
    isBuffer(): this is never
    isNull(): true
    isDirectory(): this is DirectoryFile
    isSymbolic(): this is SymbolicFile
  }

  interface DirectoryFile extends NullFile {
    isDirectory(): true
    isSymbolic(): this is never
  }

  interface SymbolicFile extends NullFile {
    isDirectory(): this is never
    isSymbolic(): true
  }
}

class File {
  constructor(file) {
    const self = this

    if (!file) {
      file = {}
    }

    // Stat = files stats object
    this.stat = file.stat || null

    // Contents = stream, buffer, or null if not read
    this.contents = file.contents || null

    // Replay path history to ensure proper normalization and trailing sep
    const history = Array.prototype.slice.call(file.history || [])
    if (file.path) {
      history.push(file.path)
    }
    this.history = []
    history.forEach(path => {
      self.path = path
    })

    this.cwd = file.cwd || process.cwd()
    this.base = file.base

    this._isVinyl = true

    this._symlink = null

    // Set custom properties
    Object.keys(file).forEach(key => {
      if (self.constructor.isCustomProp(key)) {
        self[key] = file[key]
      }
    })
  }

  isBuffer() {
    return Buffer.isBuffer(this.contents)
  }

  isStream() {
    return isStream(this.contents)
  }

  isNull() {
    return this.contents === null
  }

  isDirectory() {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && typeof this.stat.isDirectory === "function") {
      return this.stat.isDirectory()
    }

    return false
  }

  isSymbolic() {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && typeof this.stat.isSymbolicLink === "function") {
      return this.stat.isSymbolicLink()
    }

    return false
  }

  clone(opt) {
    const self = this

    if (typeof opt === "boolean") {
      opt = {
        deep: opt,
        contents: true,
      }
    } else if (!opt) {
      opt = {
        deep: true,
        contents: true,
      }
    } else {
      opt.deep = opt.deep === true
      opt.contents = opt.contents !== false
    }

    // Clone our file contents
    let contents
    if (this.isStream()) {
      contents = this.contents.clone()
    } else if (this.isBuffer()) {
      contents = opt.contents ? cloneBuffer(this.contents) : this.contents
    }

    const file = new this.constructor({
      cwd: this.cwd,
      base: this.base,
      stat: this.stat ? cloneStats(this.stat) : null,
      history: this.history.slice(),
      contents,
    })

    // Clone our custom properties
    Object.keys(this).forEach(key => {
      if (self.constructor.isCustomProp(key)) {
        file[key] = opt.deep ? clone(self[key], true) : self[key]
      }
    })
    return file
  }

  inspect() {
    const inspect = []

    // Use relative path if possible
    const filePath = this.path ? this.relative : null

    if (filePath) {
      inspect.push(`"${filePath}"`)
    }

    if (this.isBuffer()) {
      inspect.push(this.contents.inspect())
    }

    if (this.isStream()) {
      inspect.push(inspectStream(this.contents))
    }

    return `<File ${inspect.join(" ")}>`
  }

  // Virtual attributes
  // Or stuff with extra logic
  get contents() {
    return this._contents
  }

  set contents(val) {
    if (!Buffer.isBuffer(val) && !isStream(val) && val !== null) {
      throw new Error("File.contents can only be a Buffer, a Stream, or null.")
    }

    // Ask cloneable if the stream is a already a cloneable
    // this avoid piping into many streams
    // reducing the overhead of cloning
    if (isStream(val) && !cloneable.isCloneable(val)) {
      val = cloneable(val)
    }

    this._contents = val
  }

  get cwd() {
    return this._cwd
  }

  set cwd(cwd) {
    if (!cwd || typeof cwd !== "string") {
      throw new Error("cwd must be a non-empty string.")
    }
    this._cwd = removeTrailingSep(normalize(cwd))
  }

  get base() {
    return this._base || this._cwd
  }

  set base(base) {
    if (base == null) {
      delete this._base
      return
    }
    if (typeof base !== "string" || !base) {
      throw new Error("base must be a non-empty string, or null/undefined.")
    }
    base = removeTrailingSep(normalize(base))
    if (base !== this._cwd) {
      this._base = base
    } else {
      delete this._base
    }
  }

  // TODO: Should this be moved to vinyl-fs?
  get relative() {
    if (!this.path) {
      throw new Error("No path specified! Can not get relative.")
    }
    return path.relative(this.base, this.path)
  }

  set relative() {
    throw new Error(
      "File.relative is generated from the base and path attributes. Do not modify it."
    )
  }

  get dirname() {
    if (!this.path) {
      throw new Error("No path specified! Can not get dirname.")
    }
    return path.dirname(this.path)
  }

  set dirname(dirname) {
    if (!this.path) {
      throw new Error("No path specified! Can not set dirname.")
    }
    this.path = path.join(dirname, this.basename)
  }

  get basename() {
    if (!this.path) {
      throw new Error("No path specified! Can not get basename.")
    }
    return path.basename(this.path)
  }

  set basename(basename) {
    if (!this.path) {
      throw new Error("No path specified! Can not set basename.")
    }
    this.path = path.join(this.dirname, basename)
  }

  // Property for getting/setting stem of the filename.
  get stem() {
    if (!this.path) {
      throw new Error("No path specified! Can not get stem.")
    }
    return path.basename(this.path, this.extname)
  }

  set stem(stem) {
    if (!this.path) {
      throw new Error("No path specified! Can not set stem.")
    }
    this.path = path.join(this.dirname, stem + this.extname)
  }

  get extname() {
    if (!this.path) {
      throw new Error("No path specified! Can not get extname.")
    }
    return path.extname(this.path)
  }

  set extname(extname) {
    if (!this.path) {
      throw new Error("No path specified! Can not set extname.")
    }
    this.path = replaceExt(this.path, extname)
  }

  get path() {
    return this.history[this.history.length - 1]
  }

  set path(path) {
    if (typeof path !== "string") {
      throw new Error("path should be a string.")
    }
    path = removeTrailingSep(normalize(path))

    // Record history only when path changed
    if (path && path !== this.path) {
      this.history.push(path)
    }
  }

  get symlink() {
    return this._symlink
  }

  set symlink(symlink) {
    // TODO: should this set the mode to symbolic if set?
    if (typeof symlink !== "string") {
      throw new Error("symlink should be a string")
    }

    this._symlink = removeTrailingSep(normalize(symlink))
  }
}

// Newer Node.js versions use this symbol for custom inspection.
if (util.inspect.custom) {
  File.prototype[util.inspect.custom] = File.prototype.inspect
}

File.isCustomProp = key => !builtInFields.includes(key)

File.isVinyl = file => (file && file._isVinyl === true) || false

export default File
