import { Undertaker, TaskFunction } from "undertaker"
import * as vfs from "vinyl-fs"
import watch from "glob-watcher"
import { isString, isFunction } from "lodash"

import type { Transform } from "stream"
import type * as chokidar from "chokidar"
import type { File } from "vinyl"
import type { FSWatcher } from "fs"

export interface SourceOptions {
  /**
   * When true, file contents are buffered into memory. If false, the Vinyl
   * object’s contents property will be a paused stream. It may not be
   * possible to buffer the contents of large files.
   *
   * Note: Plugins may not implement support for streaming contents.
   */
  buffer: boolean | ((file: File) => boolean)

  /**
   * If false, files will be not be read and their Vinyl objects won’t be writable to disk via .dest().
   */
  read: boolean | ((file: File) => boolean)

  /**
   * When set, only creates Vinyl objects for files modified since the specified time.
   */
  since: Date | any

  /**
   * When true, removes the BOM from UTF-8 encoded files. If false, ignores a BOM.
   */
  removeBOM: boolean | ((file: File) => boolean)

  /**
   * If true, enables sourcemaps support on Vinyl objects created. Loads inline
   * sourcemaps and resolves external sourcemap links.
   */
  sourcemaps: boolean | ((file: File) => boolean)

  /**
   * When true, recursively resolves symbolic links to their targets. If false,
   * preserves the symbolic links and sets the Vinyl object’s `symlink` property
   * to the original file’s path.
   */
  resolveSymlinks: boolean | ((file: File) => boolean)

  /**
   * The directory that will be combined with any relative path to form an
   * absolute path. Is ignored for absolute paths. Use to avoid combining
   * `globs` with `path.join()`.
   *
   * This option is passed directly to `glob-stream`.
   */
  cwd: string

  /**
   * Explicitly set the `base` property on created Vinyl objects. Detailed in API Concepts.
   *
   * This option is passed directly to `glob-stream`.
   */
  base: string

  /**
   * If true, `cwd` and `base` options should be aligned.
   *
   * This option is passed directly to `glob-stream`.
   */
  cwdbase: boolean

  /**
   * The root path that `globs` are resolved against.
   *
   * This option is passed directly to `glob-stream`.
   */
  root: string

  /**
   * When false, `globs` which can only match one file (such as `foo/bar.js`)
   * causes an error to be thrown if they don’t find a match. If true,
   * suppresses glob failures.
   *
   * This option is passed directly to `glob-stream`.
   */
  allowEmpty: boolean

  /**
   * Remove duplicates from the stream by comparing the string property name or
   * the result of the function.
   *
   * Note: When using a function, the function receives the streamed data (objects containing cwd, base, path properties).
   */
  uniqueBy: string | ((data: any) => string)

  /**
   * If true, compare `globs` against dot files, like `.gitignore`.
   *
   * This option is passed directly to `node-glob`.
   */
  dot: boolean

  /**
   * When true, suppresses warnings from printing on stderr.
   *
   * Note: This option is passed directly to `node-glob` but defaulted to true instead of false.
   */
  silent: boolean

  /**
   * If true, a / character will be appended to directory matches. Generally
   * not needed because paths are normalized within the pipeline.
   *
   * This option is passed directly to `node-glob`.
   */
  mark: boolean

  /**
   * If true, disables sorting the glob results.
   *
   * This option is passed directly to `node-glob`.
   */
  nosort: boolean

  /**
   * If true, `fs.stat()` is called on all results. This adds extra overhead
   * and generally should not be used.
   *
   * This option is passed directly to `node-glob`.
   */
  stat: boolean

  /**
   * If true, an error will be thrown if an unexpected problem is encountered
   * while attempting to read a directory.
   *
   * This option is passed directly to `node-glob`.
   */
  strict: boolean

  /** When false, prevents duplicate files in the result set.
   *
   * This option is passed directly to `node-glob`.
   */
  nounique: boolean

  /**
   * If true, debugging information will be logged to the command line.
   *
   * This option is passed directly to `node-glob`.
   */
  debug: boolean

  /**
   * If true, avoids expanding brace sets - e.g. {a,b} or {1..3}.
   *
   * This option is passed directly to `node-glob`.
   */
  nobrace: boolean

  /**
   * If true, treats double-star glob character as single-star glob character.
   *
   * This option is passed directly to `node-glob`.
   */
  noglobstar: boolean

  /**
   * If true, avoids matching extglob patterns - e.g. +(ab).
   *
   * This option is passed directly to `node-glob`.
   */
  noext: boolean

  /**
   * If true, performs a case-insensitive match.
   *
   * Note: On case-insensitive file systems, non-magic patterns will match by default.
   *
   * This option is passed directly to `node-glob`.
   */
  nocase: boolean

  /**
   * If true and globs don’t contain any / characters, traverses all
   * directories and matches that glob - e.g. `*.js` would be treated as equivalent to `**​/*.js`.
   *
   * This option is passed directly to `node-glob`.
   */
  matchBase: boolean

  /**
   * If true, only matches files, not directories.
   * Note: To match only directories, end your glob with a /.
   *
   * This option is passed directly to `node-glob`.
   */
  nodir: boolean

  /** Globs to exclude from matches. This option is combined with negated globs.
   * Note: These globs are always matched against dot files, regardless of any other settings
   *
   * .This option is passed directly to `node-glob`.
   */
  ignore: string[]

  /**
   * If true, symlinked directories will be traversed when expanding `**` globs.
   * Note: This can cause problems with cyclical links.
   *
   * This option is passed directly to `node-glob`.
   */
  follow: boolean

  /**
   * If true, fs.realpath() is called on all results. This may result in dangling links.
   *
   * This option is passed directly to `node-glob`.
   */
  realpath: boolean

  /**
   * A previously generated cache object - avoids some file system calls.
   *
   * This option is passed directly to `node-glob`.
   */
  cache: object

  /**
   * A previously generated cache of fs.Stat results - avoids some file system calls.
   *
   * This option is passed directly to `node-glob`.
   */
  statCache: object

  /**
   * A previously generated cache of symbolic links - avoids some file system calls.
   *
   * This option is passed directly to `node-glob`.
   */
  symlinks: object

  /**
   * When false, treat a # character at the start of a glob as a comment.
   *
   * This option is passed directly to `node-glob`.
   */
  nocomment: boolean
}

type Provider<T> = T | ((file: File) => T)

export interface DestOptions {
  /** The directory that will be combined with any relative path to form an absolute path. Is ignored for absolute paths. Use to avoid combining directory with path.join().*/
  cwd: Provider<string>

  /** The mode used when creating files. If not set and stat.mode is missing, the process’ mode will be used instead.*/
  mode: Provider<number>

  /** The mode used when creating directories. If not set, the process’ mode will be used.*/
  dirMode: Provider<number>

  /** When true, overwrites existing files with the same path.*/
  overwrite: Provider<boolean>

  /** If true, adds contents to the end of the file, instead of replacing existing contents.*/
  append: Provider<boolean>

  /** If true, writes inline sourcemaps to the output file. Specifying a string path will write external sourcemaps at the given path.*/
  sourcemaps: Provider<boolean | string>

  /** When false, any symbolic links created will be absolute.Note: Ignored if a junction is being created, as they must be absolute.*/
  relativeSymlinks: Provider<boolean>

  /** This option is only relevant on Windows and ignored elsewhere. When true, creates directory symbolic link as a junction. Detailed in Symbolic links on Windows below.*/
  useJunctions: Provider<boolean>
}

export interface SymlinkOptions {
  /** The directory that will be combined with any relative path to form an absolute path. Is ignored for absolute paths. Use to avoid combining directory with path.join().*/
  cwd: Provider<string>

  /** The mode used when creating directories. If not set, the process’ mode will be used.*/
  dirMode: Provider<number>

  /** When true, overwrites existing files with the same path.*/
  overwrite: Provider<boolean>

  /** When false, any symbolic links created will be absolute.
   * Note: Ignored if a junction is being created, as they must be absolute.*/
  relativeSymlinks: Provider<boolean>

  /** This option is only relevant on Windows and ignored elsewhere. When true, creates directory symbolic link as a junction. Detailed in Symbolic links on Windows below.*/
  useJunctions: Provider<boolean>
}

export interface GulpWatchOptions {
  /** If false, the task is called during instantiation as file paths are discovered. Use to trigger the task during startup.Note: This option is passed to chokidar but is defaulted to true instead of false.*/
  ignoreInitial: boolean

  /** The millisecond delay between a file change and task execution. Allows for waiting on many changes before executing a task, e.g. find-and-replace on many files.*/
  delay: number

  /** When true and the task is already running, any file changes will queue a single task execution. Keeps long running tasks from overlapping.*/
  queue: boolean

  /** The events being watched to trigger task execution. Can be 'add', 'addDir', 'change', 'unlink', 'unlinkDir', 'ready', and/or 'error'. Additionally 'all' is available, which represents all events other than 'ready' and 'error'.This option is passed directly to chokidar.*/
  events: Provider<string | string[]>

  /** If false, the watcher will not keep the Node process running. Disabling this option is not recommended.This option is passed directly to chokidar.*/
  persistent: boolean

  /** Defines globs to be ignored. If a function is provided, it will be called twice per path - once with just the path, then with the path and the fs.Stats object of that file.This option is passed directly to chokidar.*/
  ignored: Provider<string[] | string | RegExp>

  /** When true, changes to both symbolic links and the linked files trigger events. If false, only changes to the symbolic links trigger events.This option is passed directly to chokidar.*/
  followSymlinks: boolean

  /** The directory that will be combined with any relative path to form an absolute path. Is ignored for absolute paths. Use to avoid combining globs with path.join().This option is passed directly to chokidar.*/
  cwd: string

  /** If true, all globs are treated as literal path names, even if they have special characters.This option is passed directly to chokidar.*/
  disableGlobbing: boolean

  /** When false, the watcher will use fs.watch() (or fsevents on Mac) for watching. If true, use fs.watchFile() polling instead - needed for successfully watching files over a network or other non-standard situations. Overrides the useFsEvents default.This option is passed directly to chokidar.*/
  usePolling: boolean

  /** Combine with usePolling: true. Interval of file system polling.This option is passed directly to chokidar.*/
  interval: number

  /** Combine with usePolling: true. Interval of file system polling for binary files.This option is passed directly to chokidar.*/
  binaryInterval: number

  /** When true, uses fsevents for watching if available. If explicitly set to true, supersedes the usePolling option. If set to false, automatically sets usePolling to true.This option is passed directly to chokidar.*/
  useFsEvents: boolean

  /** If true, always calls fs.stat() on changed files - will slow down file watcher. The fs.Stat object is only available if you are using the chokidar instance directly.This option is passed directly to chokidar.*/
  alwaysStat: boolean

  /** Indicates how many nested levels of directories will be watched.This option is passed directly to chokidar.*/
  depth: number

  /** Do not use this option, use delay instead.This option is passed directly to chokidar.*/
  awaitWriteFinish: boolean

  /** Set to true to watch files that don’t have read permissions. Then, if watching fails due to EPERM or EACCES errors, they will be skipped silently.This option is passed directly to chokidar.*/
  ignorePermissionErrors: boolean

  /** Only active if useFsEvents and usePolling are false. Automatically filters out artifacts that occur from “atomic writes” by some editors. If a file is re-added within the specified milliseconds of being deleted, a change event - instead of unlink then add - will be emitted.This option is passed directly to chokidar.*/
  atomic: number
}

export interface TaskMetadata {
  /** undefined*/
  name: string

  /** undefined*/
  displayName: string

  /** undefined*/
  description: string

  /** undefined*/
  flags: object
}

export interface TreeOptions {
  /** If true, the entire tree will be returned. When false, only top level tasks will be returned.*/
  deep: boolean
}

// Type definitions for Gulp 4.0
// Project: http://gulpjs.com
// Definitions by: Drew Noakes <https://drewnoakes.com>
//                 Juan Arroyave <http://jarroyave.co>
//                 Giedrius Grabauskas <https://github.com/GiedriusGrabauskas>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
class Gulp extends Undertaker {
  /**
   * Emits files matching provided glob or array of globs. Returns a stream of Vinyl files that can be piped to plugins.
   * @param globs Glob or array of globs to read.
   * @param options Options to pass to node-glob through glob-stream.
   */
  src = (globs: string | string[], options: Partial<SourceOptions>): Transform => {
    return vfs.src(globs, options)
  }

  /**
   * Can be piped to and it will write files. Re-emits all data passed to it so you can pipe to multiple folders.
   * Folders that don't exist will be created.
   * @param path The path (output folder) to write files to. Or a function that returns it, the function will be provided a vinyl File instance.
   */
  dest = (globs: string | string[], options: Partial<DestOptions>): Transform => {
    return vfs.dest(globs, options)
  }

  /**
   * Functions exactly like gulp.dest, but will create symlinks instead of copying a directory.
   * @param folder A folder path or a function that receives in a file and returns a folder path.
   */
  symlink = (folder: string, options: Partial<SymlinkOptions>) => {
    return vfs.symlink(folder, options)
  }

  // Let people use this class from our instance
  Gulp = Gulp

  constructor() {
    super()

    // Bind the functions for destructuring
    this.watch = this.watch.bind(this)
    this.task = this.task.bind(this)
    this.series = this.series.bind(this)
    this.parallel = this.parallel.bind(this)
    this.registry = this.registry.bind(this)
    this.tree = this.tree.bind(this)
    this.lastRun = this.lastRun.bind(this)
  }

  /**
   * Takes a path string, an array of path strings, a glob string or an array of glob strings as globs to watch on the filesystem.
   * Also optionally takes options to configure the watcher and a fn to execute when a file changes.
   * @globs A path string, an array of path strings, a glob string or an array of glob strings that indicate which files to watch for changes.
   * @opts Options that are passed to chokidar.
   * @fn Once async completion is signalled, if another run is queued, it will be executed.
   */
  watch(globs: Globs, fn?: TaskFunction): FSWatcher
  watch(globs: Globs, opts?: WatchOptions, fn?: TaskFunction): FSWatcher

  watch(glob: Globs, opt?: TaskFunction | WatchOptions, task?: TaskFunction) {
    if (isString(opt) || isString(task) || Array.isArray(opt) || Array.isArray(task)) {
      throw Error(
        `watching ${glob}: watch task has to be a function (optionally generated by using gulp.parallel or gulp.series)`
      )
    }

    if (isFunction(opt)) {
      task = opt
      opt = undefined
    }

    const fn = isFunction(task) ? this.parallel(task) : undefined
    return watch(glob, opt || {}, fn)
  }
}

export type Globs = string | string[]

export interface WatchOptions extends chokidar.WatchOptions {
  /**
   * The delay to wait before triggering the fn.
   * Useful for waiting on many changes before doing the work on changed files, e.g. find-and-replace on many files.
   * @default 200
   */
  delay?: number
  /**
   * Whether or not a file change should queue the fn execution if the fn is already running. Useful for a long running fn.
   * @default true
   */
  queue?: boolean
}

const inst = new Gulp()
export default inst
