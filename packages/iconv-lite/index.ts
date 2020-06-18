import * as bomHandling from "./lib/bom-handling"
import { IconvLiteDecoderStream, IconvLiteEncoderStream } from "./lib/streams"
import { isString } from "lodash"

// All codecs and aliases are kept here, keyed by encoding name/alias.
// They are lazy loaded in `iconv.getCodec` from `encodings/index.js`.
export var encodings = null

// Characters emitted in case of error.
export var defaultCharUnicode = "�"

export var defaultCharSingleByte = "?"

// Public API.
export function encode(str, encoding, options) {
  str = `${str || ""}` // Ensure string.

  const encoder = exports.getEncoder(encoding, options)

  const res = encoder.write(str)
  const trail = encoder.end()

  return trail && trail.length > 0 ? Buffer.concat([res, trail]) : res
}

let skipDecodeWarning = false

export function decode(buf, encoding, options) {
  if (isString(buf)) {
    if (!skipDecodeWarning) {
      console.error(
        "Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding"
      )
      skipDecodeWarning = true
    }

    buf = Buffer.from(`${buf || ""}`, "binary") // Ensure buffer.
  }

  const decoder = exports.getDecoder(encoding, options)

  const res = decoder.write(buf)
  const trail = decoder.end()

  return trail ? res + trail : res
}

export function encodingExists(enc) {
  try {
    exports.getCodec(enc)
    return true
  } catch (e) {
    return false
  }
}

// Legacy aliases to convert functions
export var toEncoding = exports.encode

export var fromEncoding = exports.decode

// Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.
export var _codecDataCache = {}

export function getCodec(encoding) {
  if (!exports.encodings) exports.encodings = require("../encodings") // Lazy load all encoding definitions.

  // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
  let enc = exports._canonicalizeEncoding(encoding)

  // Traverse iconv.encodings to find actual codec.
  const codecOptions = {}
  while (true) {
    let codec = exports._codecDataCache[enc]
    if (codec) return codec

    const codecDef = exports.encodings[enc]

    switch (typeof codecDef) {
      case "string": // Direct alias to other encoding.
        enc = codecDef
        break

      case "object": // Alias with options. Can be layered.
        for (const key in codecDef) codecOptions[key] = codecDef[key]

        if (!codecOptions.encodingName) codecOptions.encodingName = enc

        enc = codecDef.type
        break

      case "function": // Codec itself.
        if (!codecOptions.encodingName) codecOptions.encodingName = enc

        // The codec function must load all tables and return object with .encoder and .decoder methods.
        // It'll be called only once (for each different options object).
        codec = new codecDef(codecOptions, exports)

        exports._codecDataCache[codecOptions.encodingName] = codec // Save it to be reused later.
        return codec

      default:
        throw Error(`Encoding not recognized: '${encoding}' (searched as: '${enc}')`)
    }
  }
}

export function _canonicalizeEncoding(encoding) {
  return (
    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
    `${encoding}`.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, "")
  )
}

export function getEncoder(encoding, options) {
  const codec = exports.getCodec(encoding)
  let encoder = new codec.encoder(options, codec)

  if (codec.bomAware && options && options.addBOM)
    encoder = new bomHandling.PrependBOM(encoder, options)

  return encoder
}

export function getDecoder(encoding, options) {
  const codec = exports.getCodec(encoding)
  let decoder = new codec.decoder(options, codec)

  if (codec.bomAware && !(options && options.stripBOM === false))
    decoder = new bomHandling.StripBOM(decoder, options)

  return decoder
}

export { IconvLiteEncoderStream, IconvLiteDecoderStream } from "./lib/streams"

// Streaming API.
export function encodeStream(encoding, options) {
  return new IconvLiteEncoderStream(getEncoder(encoding, options), options)
}

export function decodeStream(encoding, options) {
  return new IconvLiteDecoderStream(getDecoder(encoding, options), options)
}

let supportsStreams = false

// Streaming API
// NOTE: Streaming API naturally depends on 'stream' module from Node.js. Unfortunately in browser environments this module can add
// up to 100Kb to the output bundle. To avoid unnecessary code bloat, we don't enable Streaming API in browser by default.
// If you would like to enable it explicitly, please add the following code to your app:
// > iconv.enableStreamingAPI(require('stream'));
export function enableStreamingAPI() {
  if (supportsStreams) return

  supportsStreams = true
}

if ("Ā" != "\u0100") {
  console.error(
    "iconv-lite warning: js files use non-utf8 encoding. See https://github.com/ashtuchkin/iconv-lite/wiki/Javascript-source-file-encodings for more info."
  )
}
