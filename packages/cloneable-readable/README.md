# cloneable-readable

Last upstream commit: [f6bbe0a on 24 Apr 2020](https://github.com/mcollina/cloneable-readable/commit/f6bbe0a9da6561af84ec14ca1bc75c37c455f11c).

[![Greenkeeper badge](https://badges.greenkeeper.io/mcollina/cloneable-readable.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/mcollina/cloneable-readable.svg?branch=master)](https://travis-ci.org/mcollina/cloneable-readable)

Clone a Readable stream, safely.

```js
"use strict"

const cloneable = require("cloneable-readable")
const fs = require("fs")
const pump = require("pump")

const stream = cloneable(fs.createReadStream("./package.json"))

pump(stream.clone(), fs.createWriteStream("./out1"))

// simulate some asynchronicity
setImmediate(function () {
  pump(stream, fs.createWriteStream("./out2"))
})
```

**cloneable-readable** automatically handles `objectMode: true`.

This module comes out of an healthy discussion on the 'right' way to
clone a Readable in https://github.com/gulpjs/vinyl/issues/85
and https://github.com/nodejs/readable-stream/issues/202. This is my take.

**YOU MUST PIPE ALL CLONES TO START THE FLOW**

You can also attach `'data'` and `'readable'` events to them.

## API

### cloneable(stream)

Create a `Cloneable` stream.
A Cloneable has a `clone()` method to create more clones.
All clones must be resumed/piped to start the flow.

### cloneable.isCloneable(stream)

Check if `stream` needs to be wrapped in a `Cloneable` or not.

## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

## License

MIT
