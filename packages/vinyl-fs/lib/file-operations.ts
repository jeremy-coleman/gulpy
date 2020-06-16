import * as fs from "fs"
import assign from "object.assign"
import { date } from "value-or-function"
import { Writable } from "readable-stream"
import * as constants from "./constants"

const APPEND_MODE_REGEXP = /a/

function closeFd(propagatedErr, fd, callback) {
  if (typeof fd !== "number") {
    return callback(propagatedErr)
  }

  fs.close(fd, onClosed)

  function onClosed(closeErr) {
    if (propagatedErr || closeErr) {
      return callback(propagatedErr || closeErr)
    }

    callback()
  }
}

function isValidUnixId(id) {
  if (typeof id !== "number") {
    return false
  }

  if (id < 0) {
    return false
  }

  return true
}

function getFlags({ append, overwrite }) {
  let flags = !append ? "w" : "a"
  if (!overwrite) {
    flags += "x"
  }
  return flags
}

function isFatalOverwriteError(err, flags) {
  if (!err) {
    return false
  }

  if (err.code === "EEXIST" && flags[1] === "x") {
    // Handle scenario for file overwrite failures.
    return false
  }

  // Otherwise, this is a fatal error
  return true
}

function isFatalUnlinkError(err) {
  if (!err || err.code === "ENOENT") {
    return false
  }

  return true
}

function getModeDiff(fsMode, vinylMode) {
  let modeDiff = 0

  if (typeof vinylMode === "number") {
    modeDiff = (vinylMode ^ fsMode) & constants.MASK_MODE
  }

  return modeDiff
}

function getTimesDiff(fsStat, vinylStat) {
  const mtime = date(vinylStat.mtime) || 0
  if (!mtime) {
    return
  }

  let atime = date(vinylStat.atime) || 0
  if (+mtime === +fsStat.mtime && +atime === +fsStat.atime) {
    return
  }

  if (!atime) {
    atime = date(fsStat.atime) || undefined
  }

  const timesDiff = {
    mtime: vinylStat.mtime,
    atime,
  }

  return timesDiff
}

function getOwnerDiff(fsStat, vinylStat) {
  if (!isValidUnixId(vinylStat.uid) && !isValidUnixId(vinylStat.gid)) {
    return
  }

  if (
    (!isValidUnixId(fsStat.uid) && !isValidUnixId(vinylStat.uid)) ||
    (!isValidUnixId(fsStat.gid) && !isValidUnixId(vinylStat.gid))
  ) {
    return
  }

  let uid = fsStat.uid // Default to current uid.
  if (isValidUnixId(vinylStat.uid)) {
    uid = vinylStat.uid
  }

  let gid = fsStat.gid // Default to current gid.
  if (isValidUnixId(vinylStat.gid)) {
    gid = vinylStat.gid
  }

  if (uid === fsStat.uid && gid === fsStat.gid) {
    return
  }

  const ownerDiff = {
    uid,
    gid,
  }

  return ownerDiff
}

function isOwner(fsStat) {
  const hasGetuid = typeof process.getuid === "function"
  const hasGeteuid = typeof process.geteuid === "function"

  // If we don't have either, assume we don't have permissions.
  // This should only happen on Windows.
  // Windows basically noops fchmod and errors on futimes called on directories.
  if (!hasGeteuid && !hasGetuid) {
    return false
  }

  let uid
  if (hasGeteuid) {
    uid = process.geteuid()
  } else {
    uid = process.getuid()
  }

  if (fsStat.uid !== uid && uid !== 0) {
    return false
  }

  return true
}

function reflectStat(path, file, callback) {
  // Set file.stat to the reflect current state on disk
  fs.stat(path, onStat)

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr)
    }

    file.stat = stat
    callback()
  }
}

function reflectLinkStat(path, file, callback) {
  // Set file.stat to the reflect current state on disk
  fs.lstat(path, onLstat)

  function onLstat(lstatErr, stat) {
    if (lstatErr) {
      return callback(lstatErr)
    }

    file.stat = stat
    callback()
  }
}

function updateMetadata(fd, file, callback) {
  fs.fstat(fd, onStat)

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr)
    }

    // Check if mode needs to be updated
    const modeDiff = getModeDiff(stat.mode, file.stat.mode)

    // Check if atime/mtime need to be updated
    const timesDiff = getTimesDiff(stat, file.stat)

    // Check if uid/gid need to be updated
    const ownerDiff = getOwnerDiff(stat, file.stat)

    // Set file.stat to the reflect current state on disk
    assign(file.stat, stat)

    // Nothing to do
    if (!modeDiff && !timesDiff && !ownerDiff) {
      return callback()
    }

    // Check access, `futimes`, `fchmod` & `fchown` only work if we own
    // the file, or if we are effectively root (`fchown` only when root).
    if (!isOwner(stat)) {
      return callback()
    }

    if (modeDiff) {
      return mode()
    }
    if (timesDiff) {
      return times()
    }
    owner()

    function mode() {
      const mode = stat.mode ^ modeDiff

      fs.fchmod(fd, mode, onFchmod)

      function onFchmod(fchmodErr) {
        if (!fchmodErr) {
          file.stat.mode = mode
        }
        if (timesDiff) {
          return times(fchmodErr)
        }
        if (ownerDiff) {
          return owner(fchmodErr)
        }
        callback(fchmodErr)
      }
    }

    function times(propagatedErr) {
      fs.futimes(fd, timesDiff.atime, timesDiff.mtime, onFutimes)

      function onFutimes(futimesErr) {
        if (!futimesErr) {
          file.stat.atime = timesDiff.atime
          file.stat.mtime = timesDiff.mtime
        }
        if (ownerDiff) {
          return owner(propagatedErr || futimesErr)
        }
        callback(propagatedErr || futimesErr)
      }
    }

    function owner(propagatedErr) {
      fs.fchown(fd, ownerDiff.uid, ownerDiff.gid, onFchown)

      function onFchown(fchownErr) {
        if (!fchownErr) {
          file.stat.uid = ownerDiff.uid
          file.stat.gid = ownerDiff.gid
        }
        callback(propagatedErr || fchownErr)
      }
    }
  }
}

function symlink(srcPath, destPath, { flags, type }, callback) {
  // Because fs.symlink does not allow atomic overwrite option with flags, we
  // delete and recreate if the link already exists and overwrite is true.
  if (flags === "w") {
    // TODO What happens when we call unlink with windows junctions?
    fs.unlink(destPath, onUnlink)
  } else {
    fs.symlink(srcPath, destPath, type, onSymlink)
  }

  function onUnlink(unlinkErr) {
    if (isFatalUnlinkError(unlinkErr)) {
      return callback(unlinkErr)
    }
    fs.symlink(srcPath, destPath, type, onSymlink)
  }

  function onSymlink(symlinkErr) {
    if (isFatalOverwriteError(symlinkErr, flags)) {
      return callback(symlinkErr)
    }
    callback()
  }
}

/*
  Custom writeFile implementation because we need access to the
  file descriptor after the write is complete.
  Most of the implementation taken from node core.
 */
function writeFile(filepath, data, options, callback) {
  if (typeof options === "function") {
    callback = options
    options = {}
  }

  if (!Buffer.isBuffer(data)) {
    return callback(new TypeError("Data must be a Buffer"))
  }

  if (!options) {
    options = {}
  }

  // Default the same as node
  const mode = options.mode || constants.DEFAULT_FILE_MODE
  const flags = options.flags || "w"
  const position = APPEND_MODE_REGEXP.test(flags) ? null : 0

  fs.open(filepath, flags, mode, onOpen)

  function onOpen(openErr, fd) {
    if (openErr) {
      return onComplete(openErr)
    }

    fs.write(fd, data, 0, data.length, position, onComplete)

    function onComplete(writeErr) {
      callback(writeErr, fd)
    }
  }
}

function createWriteStream(path, options, flush) {
  return new WriteStream(path, options, flush)
}

// Taken from node core and altered to receive a flush function and simplified
// To be used for cleanup (like updating times/mode/etc)
class WriteStream extends Writable {
  constructor(path, options, flush) {
    // Not exposed so we can avoid the case where someone doesn't use `new`

    if (typeof options === "function") {
      flush = options
      options = null
    }

    options = options || {}

    super(options)

    this.flush = flush
    this.path = path

    this.mode = options.mode || constants.DEFAULT_FILE_MODE
    this.flags = options.flags || "w"

    // Used by node's `fs.WriteStream`
    this.fd = null
    this.start = null

    this.open()

    // Dispose on finish.
    this.once("finish", this.close)
  }

  open() {
    const self = this

    fs.open(this.path, this.flags, this.mode, onOpen)

    function onOpen(openErr, fd) {
      if (openErr) {
        self.destroy()
        self.emit("error", openErr)
        return
      }

      self.fd = fd
      self.emit("open", fd)
    }
  }

  _destroy(err, cb) {
    this.close(err2 => {
      cb(err || err2)
    })
  }

  close(cb) {
    const that = this

    if (cb) {
      this.once("close", cb)
    }

    if (this.closed || typeof this.fd !== "number") {
      if (typeof this.fd !== "number") {
        this.once("open", closeOnOpen)
        return
      }

      return process.nextTick(() => {
        that.emit("close")
      })
    }

    this.closed = true

    fs.close(this.fd, er => {
      if (er) {
        that.emit("error", er)
      } else {
        that.emit("close")
      }
    })

    this.fd = null
  }

  _final(callback) {
    if (typeof this.flush !== "function") {
      return callback()
    }

    this.flush(this.fd, callback)
  }

  _write(data, encoding, callback) {
    const self = this

    // This is from node core but I have no idea how to get code coverage on it
    if (!Buffer.isBuffer(data)) {
      return this.emit("error", new Error("Invalid data"))
    }

    if (typeof this.fd !== "number") {
      return this.once("open", onOpen)
    }

    fs.write(this.fd, data, 0, data.length, null, onWrite)

    function onOpen() {
      self._write(data, encoding, callback)
    }

    function onWrite(writeErr) {
      if (writeErr) {
        self.destroy()
        callback(writeErr)
        return
      }

      callback()
    }
  }
}

// Use our `end` method since it is patched for flush
WriteStream.prototype.destroySoon = WriteStream.prototype.end

function closeOnOpen() {
  this.close()
}

export {
  closeFd,
  isValidUnixId,
  getFlags,
  isFatalOverwriteError,
  isFatalUnlinkError,
  getModeDiff,
  getTimesDiff,
  getOwnerDiff,
  isOwner,
  reflectStat,
  reflectLinkStat,
  updateMetadata,
  symlink,
  writeFile,
  createWriteStream,
}
