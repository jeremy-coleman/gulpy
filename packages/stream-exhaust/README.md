# stream-exhaust

Last upstream commit: [3142d2e on 30 Aug 2017](https://github.com/chrisdickinson/stream-exhaust/commit/3142d2e2ac0eb301d561ddf501407fbd75ebb1ee).

Ensure that the provided stream is flowing data, even if the stream hasn't been
piped to another stream.

```javascript
import exhaustively from "stream-exhaust"

exhaustively(fs.createReadStream(__filename)).on("close", () => {
  console.log("all done, despite being streams{1+N}!")
})
```

## Prior Art

This is based on [stream-consume](https://github.com/aroneous/stream-consume)
by [aroneous](https://github.com/aroneous). It is a separate package because it has
different semantics:

1. It does not call `.resume()` on streams2+ streams. streams2 streams monkeypatch `.pipe`
   when entering flowing mode; avoiding `resume()` avoids that fate.
2. It does not examine `._readableState`; instead it checks for the presence of `._read`.

## API

### exhaust(Stream s) -> Stream s

Takes a stream, `s`, and returns it. Ensures that the stream is flowing, either by calling
`.resume()` if the stream is a streams1 stream, or by piping it to a "black hole" stream that
continually asks for more data.

## License

MIT
