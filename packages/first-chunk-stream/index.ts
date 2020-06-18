import { Duplex as DuplexStream, DuplexOptions as DuplexStreamOption } from "stream"
import { isObject, isFunction, isNumber, isString } from "lodash"

/**
	Symbol used to end the stream early.

	@example
	```
	new FirstChunkStream({chunkSize: 7}, async (chunk, encoding) => {
		return FirstChunkStream.stop;
	});
	```
	*/
const stop = Symbol("FirstChunkStream.stop")

interface Options extends Readonly<DuplexStreamOption> {
  /**
	How many bytes you want to buffer.
	*/
  readonly chunkSize: number
}

type StopSymbol = typeof stop

type BufferLike = string | Buffer | Uint8Array

type TransformFunction = (
  chunk: Buffer,
  encoding: string
) => Promise<StopSymbol | BufferLike | { buffer: BufferLike; encoding?: string }>

export default FirstChunkStream

/**
	Buffer and transform the `n` first bytes of a stream.

	@param options - The options object is passed to the [`Duplex` stream](https://nodejs.org/api/stream.html#stream_class_stream_duplex) constructor allowing you to customize your stream behavior.
	@param transform - Async function that receives the required `options.chunkSize` bytes.

	Note that the buffer can have a smaller length than the required one. In that case, it will be due to the fact that the complete stream contents has a length less than the `options.chunkSize` value. You should check for this yourself if you strictly depend on the length.

	@example
	```
	import * as fs from 'fs';
	import getStream = require('get-stream');
	import FirstChunkStream = require('first-chunk-stream');

	// unicorn.txt => unicorn rainbow
	const stream = fs.createReadStream('unicorn.txt')
		.pipe(new FirstChunkStream({chunkSize: 7}, async (chunk, encoding) => {
			return chunk.toString(encoding).toUpperCase();
		}));

	(async () => {
		const data = await getStream(stream);

		if (data.length < 7) {
			throw Error('Couldn\'t get the minimum required first chunk length');
		}

		console.log(data);
		//=> 'UNICORN rainbow'
	})();
	```
	*/
export class FirstChunkStream extends DuplexStream {
  constructor(options: Options, callback: TransformFunction) {
    const state = {
      sent: false,
      chunks: [],
      size: 0,
    }

    if (!isObject(options) || options === null) {
      throw TypeError("FirstChunkStream constructor requires `options` to be an object.")
    }

    if (!isFunction(callback)) {
      throw TypeError(
        "FirstChunkStream constructor requires a callback as its second argument."
      )
    }

    if (!isNumber(options.chunkSize)) {
      throw TypeError(
        "FirstChunkStream constructor requires `options.chunkSize` to be a number."
      )
    }

    if (options.objectMode) {
      throw Error("FirstChunkStream doesn't support `objectMode` yet.")
    }

    super(options)

    // Initialize the internal state
    state.manager = createReadStreamBackpressureManager(this)

    const processCallback = (buffer, encoding, done) => {
      state.sent = true
      ;(async () => {
        let result
        try {
          result = await callback(buffer, encoding)
        } catch (error) {
          setImmediate(() => {
            this.emit("error", error)
            done()
          })
          return
        }

        if (result === stop) {
          state.manager.programPush(null, undefined, done)
        } else if (
          Buffer.isBuffer(result) ||
          result instanceof Uint8Array ||
          isString(result)
        ) {
          state.manager.programPush(result, undefined, done)
        } else {
          state.manager.programPush(result.buffer, result.encoding, done)
        }
      })()
    }

    // Writes management
    this._write = (chunk, encoding, done) => {
      state.encoding = encoding
      if (state.sent) {
        state.manager.programPush(chunk, state.encoding, done)
      } else if (chunk.length < options.chunkSize - state.size) {
        state.chunks.push(chunk)
        state.size += chunk.length
        done()
      } else {
        state.chunks.push(chunk.slice(0, options.chunkSize - state.size))
        chunk = chunk.slice(options.chunkSize - state.size)
        state.size += state.chunks[state.chunks.length - 1].length

        processCallback(Buffer.concat(state.chunks, state.size), state.encoding, () => {
          if (chunk.length === 0) {
            done()
            return
          }

          state.manager.programPush(chunk, state.encoding, done)
        })
      }
    }

    this.on("finish", () => {
      if (!state.sent) {
        return processCallback(
          Buffer.concat(state.chunks, state.size),
          state.encoding,
          () => {
            state.manager.programPush(null, state.encoding)
          }
        )
      }

      state.manager.programPush(null, state.encoding)
    })
  }
}

// Utils to manage readable stream backpressure
function createReadStreamBackpressureManager(readableStream) {
  const manager = {
    waitPush: true,
    programmedPushs: [],
    programPush(chunk, encoding, isDone = () => {}) {
      // Store the current write
      manager.programmedPushs.push([chunk, encoding, isDone])
      // Need to be async to avoid nested push attempts
      // Programm a push attempt
      setImmediate(manager.attemptPush)
      // Let's say we're ready for a read
      readableStream.emit("readable")
      readableStream.emit("drain")
    },
    attemptPush() {
      let nextPush

      if (manager.waitPush) {
        if (manager.programmedPushs.length > 0) {
          nextPush = manager.programmedPushs.shift()
          manager.waitPush = readableStream.push(nextPush[0], nextPush[1])
          nextPush[2]()
        }
      } else {
        setImmediate(() => {
          // Need to be async to avoid nested push attempts
          readableStream.emit("readable")
        })
      }
    },
  }

  function streamFilterRestoreRead() {
    manager.waitPush = true
    // Need to be async to avoid nested push attempts
    setImmediate(manager.attemptPush)
  }

  // Patch the readable stream to manage reads
  readableStream._read = streamFilterRestoreRead

  return manager
}

FirstChunkStream.stop = stop
