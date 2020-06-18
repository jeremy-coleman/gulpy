# stream-shift

Last upstream update: [6b002a5 on 12 Dec 2019](https://github.com/mafintosh/stream-shift/commit/6b002a583b8a748094dcb1d8a55703bc718a7226).

Returns the next buffer/object in a stream's readable queue

```
npm install stream-shift
```

[![build status](http://img.shields.io/travis/mafintosh/stream-shift.svg?style=flat)](http://travis-ci.org/mafintosh/stream-shift)

## Usage

```js
var shift = require("stream-shift")

console.log(shift(someStream)) // first item in its buffer
```

## Credit

Thanks [@dignifiedquire](https://github.com/dignifiedquire) for making this work on node 6

## License

MIT
