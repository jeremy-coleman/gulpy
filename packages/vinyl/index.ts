import * as path from "path"
import { inspect } from "util"
import * as fs from "fs"

import { clone, forEach, isBoolean, last, isString, isFunction, cloneDeep } from "lodash"
import cloneable from "@local/cloneable-readable"
import replaceExt from "replace-ext"
import { removeTrailingSeparator } from "@local/shared"
import { isStream } from "./lib/is-stream"
import { normalize } from "./lib/normalize"
import { inspectStream } from "./lib/inspect-stream"

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
  (options: ConstructorOptions & { contents: null }): NullFile
  (options: ConstructorOptions & { contents: Buffer }): BufferFile
  (options: ConstructorOptions & { contents: NodeJS.ReadableStream }): StreamFile
  (options?: ConstructorOptions): File
}

// See https://github.com/Microsoft/TypeScript/issues/11796
export interface BufferFile extends FileSansContents {
  contents: Buffer
  clone(opt?: CloneOptions): BufferFile
  isStream(): this is never
  isBuffer(): true
  isNull(): this is never
  isDirectory(): this is never
  isSymbolic(): this is never
}

export interface StreamFile extends FileSansContents {
  contents: NodeJS.ReadableStream
  clone(opt?: CloneOptions): StreamFile
  isStream(): true
  isBuffer(): this is never
  isNull(): this is never
  isDirectory(): this is never
  isSymbolic(): this is never
}

export interface NullFile extends FileSansContents {
  contents: null
  clone(opt?: CloneOptions): NullFile
  isStream(): this is never
  isBuffer(): this is never
  isNull(): true
  isDirectory(): this is DirectoryFile
  isSymbolic(): this is SymbolicFile
}

export interface DirectoryFile extends NullFile {
  isDirectory(): true
  clone(opt?: CloneOptions): DirectoryFile
  isSymbolic(): this is never
}

export interface SymbolicFile extends NullFile {
  isDirectory(): this is never
  clone(opt?: CloneOptions): SymbolicFile
  isSymbolic(): true
}

type CloneOptions =
  | boolean
  | {
      contents?: boolean
      deep?: boolean
    }

type FileSansContents = Omit<File, "contents" | "clone">

export class File {
  /**
   * Array of `file.path` values the Vinyl object has had, from `file.history[0]` (original)
   * through `file.history[file.history.length - 1]` (current). `file.history` and its elements
   * should normally be treated as read-only and only altered indirectly by setting `file.path`.
   */
  readonly history: string[]

  stat?: fs.Stats
  custom?: any

  _isVinyl = true
  private _symlink: null
  private _contents: Buffer | NodeJS.ReadableStream | null
  private _cwd: string
  private _base?: string

  static of: FileConstructor = (file?: ConstructorOptions) => new File(file) as any

  constructor(file: ConstructorOptions = {}) {
    // Stat = files stats object
    this.stat = file.stat || undefined

    // Contents = stream, buffer, or null if not read
    this.contents = file.contents || null

    // Replay path history to ensure proper normalization and trailing sep
    const history = file.history?.slice() ?? []
    if (file.path) {
      history.push(file.path)
    }
    this.history = []
    history.forEach(path => {
      this.path = path
    })

    this.cwd = file.cwd || process.cwd()
    this.base = file.base!

    this._symlink = null

    // Set custom properties
    forEach(file, (value, key) => {
      if (File.isCustomProp(key)) {
        this[key] = value
      }
    })
  }

  /**
   * Returns `true` if the file contents are a `Buffer`, otherwise `false`.
   */
  isBuffer(): this is BufferFile & { contents: Buffer } {
    return Buffer.isBuffer(this.contents)
  }

  /**
   * Returns `true` if the file contents are a `Stream`, otherwise `false`.
   */
  isStream(): this is StreamFile & { contents: StreamFile } {
    return isStream(this.contents)
  }

  /**
   * Returns `true` if the file contents are `null`, otherwise `false`.
   */
  isNull(): this is NullFile {
    return this.contents === null
  }

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
  isDirectory(): this is DirectoryFile {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && isFunction(this.stat.isDirectory)) {
      return this.stat.isDirectory()
    }

    return false
  }

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
  isSymbolic(): this is SymbolicFile {
    if (!this.isNull()) {
      return false
    }

    if (this.stat && isFunction(this.stat.isSymbolicLink)) {
      return this.stat.isSymbolicLink()
    }

    return false
  }

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
  clone(opt?: CloneOptions): this {
    let deep: boolean
    let _contents: boolean
    if (isBoolean(opt)) {
      deep = opt
      _contents = true
    } else if (!opt) {
      deep = true
      _contents = true
    } else {
      deep = opt.deep === true
      _contents = opt.contents !== false
    }

    // Clone our file contents
    let contents
    if (this.isStream()) {
      contents = this.contents.clone()
    } else if (this.isBuffer()) {
      contents = _contents ? Buffer.from(this.contents) : this.contents
    }

    const file = new (this.constructor as typeof File)({
      cwd: this.cwd,
      base: this.base,
      stat: this.stat && clone(this.stat),
      history: this.history.slice(),
      contents,
    })

    // Clone our custom properties
    forEach(this, (value, key) => {
      if (File.isCustomProp(key)) {
        file[key] = deep ? cloneDeep(value) : value
      }
    })
    return file as this
  }

  /**
   * Returns a formatted-string interpretation of the Vinyl object.
   * Automatically called by node's `console.log`.
   */
  inspect(): string {
    const inspection: string[] = []

    // Use relative path if possible
    const filePath = this.path ? this.relative : null

    if (filePath) {
      inspection.push(`"${filePath}"`)
    }

    if (this.isBuffer()) {
      inspection.push(this.contents[inspect.custom]())
    }

    if (this.isStream()) {
      inspection.push(inspectStream(this.contents))
    }

    return `<File ${inspection.join(" ")}>`
  }

  // Virtual attributes
  // Or stuff with extra logic
  /**
   * Gets and sets the contents of the file. If set to a `Stream`, it is wrapped in
   * a `cloneable-readable` stream.
   *
   * Throws when set to any value other than a `Stream`, a `Buffer` or `null`.
   */
  get contents(): Buffer | NodeJS.ReadableStream | null {
    return this._contents
  }

  set contents(val) {
    if (!Buffer.isBuffer(val) && !isStream(val) && val !== null) {
      throw Error("File.contents can only be a Buffer, a Stream, or null.")
    }

    // Ask cloneable if the stream is a already a cloneable
    // this avoid piping into many streams
    // reducing the overhead of cloning
    if (isStream(val) && !cloneable.isCloneable(val)) {
      val = cloneable(val)
    }

    this._contents = val
  }

  /**
   * Gets and sets current working directory. Will always be normalized and have trailing
   * separators removed.
   *
   * Throws when set to any value other than non-empty strings.
   */
  get cwd(): string {
    return this._cwd
  }

  set cwd(cwd) {
    if (!cwd || !isString(cwd)) {
      throw Error("cwd must be a non-empty string.")
    }
    this._cwd = removeTrailingSeparator(normalize(cwd))
  }

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
  get base(): string {
    return this._base || this._cwd
  }

  set base(base) {
    if (base == null) {
      delete this._base
      return
    }
    if (!isString(base) || !base) {
      throw Error("base must be a non-empty string, or null/undefined.")
    }
    base = removeTrailingSeparator(normalize(base))
    if (base !== this._cwd) {
      this._base = base
    } else {
      delete this._base
    }
  }

  // TODO: Should this be moved to vinyl-fs?
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
  get relative(): string {
    if (!this.path) {
      throw Error("No path specified! Can not get relative.")
    }
    return path.relative(this.base, this.path)
  }

  set relative(value) {
    throw Error(
      "File.relative is generated from the base and path attributes. Do not modify it."
    )
  }

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
  get dirname(): string {
    if (!this.path) {
      throw Error("No path specified! Can not get dirname.")
    }
    return path.dirname(this.path)
  }

  set dirname(dirname) {
    if (!this.path) {
      throw Error("No path specified! Can not set dirname.")
    }
    this.path = path.join(dirname, this.basename)
  }

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
  get basename(): string {
    if (!this.path) {
      throw Error("No path specified! Can not get basename.")
    }
    return path.basename(this.path)
  }

  set basename(basename) {
    if (!this.path) {
      throw Error("No path specified! Can not set basename.")
    }
    this.path = path.join(this.dirname, basename)
  }

  // Property for getting/setting stem of the filename.

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
  get stem(): string {
    if (!this.path) {
      throw Error("No path specified! Can not get stem.")
    }
    return path.basename(this.path, this.extname)
  }

  set stem(stem) {
    if (!this.path) {
      throw Error("No path specified! Can not set stem.")
    }
    this.path = path.join(this.dirname, stem + this.extname)
  }

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
  get extname(): string {
    if (!this.path) {
      throw Error("No path specified! Can not get extname.")
    }
    return path.extname(this.path)
  }

  set extname(extname) {
    if (!this.path) {
      throw Error("No path specified! Can not set extname.")
    }
    this.path = replaceExt(this.path, extname)
  }

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
  get path(): string {
    return last(this.history)!
  }

  set path(path) {
    if (!isString(path)) {
      throw Error("path should be a string.")
    }
    path = removeTrailingSeparator(normalize(path))

    // Record history only when path changed
    if (path && path !== this.path) {
      this.history.push(path)
    }
  }

  /**
   * Gets and sets the path where the file points to if it's a symbolic link. Will always
   * be normalized and have trailing separators removed.
   *
   * Throws when set to any value other than a string.
   */
  get symlink(): string | null {
    return this._symlink
  }

  set symlink(symlink) {
    // TODO: should this set the mode to symbolic if set?
    if (!isString(symlink)) {
      throw Error("symlink should be a string")
    }

    this._symlink = removeTrailingSeparator(normalize(symlink))
  }

  /**
   * @deprecated This method was removed in v2.0.
   * If file.contents is a Buffer, it will write it to the stream.
   * If file.contents is a Stream, it will pipe it to the stream.
   * If file.contents is null, it will do nothing.
   */
  pipe: <T extends NodeJS.WritableStream>(
    stream: T,
    opts?: {
      /**
       * If false, the destination stream will not be ended (same as node core).
       */
      end?: boolean
    }
  ) => T

  /**
   * Checks if a property is not managed internally.
   */
  static isCustomProp(key: string): boolean {
    return !builtInFields.includes(key)
  }

  /**
   * Checks if a given object is a vinyl file.
   */
  static isVinyl(file: any): file is File {
    return (file && file._isVinyl === true) || false
  }
}

// Newer Node.js versions use this symbol for custom inspection.
if (inspect.custom) {
  File.prototype[inspect.custom] = File.prototype.inspect
}

export default File
