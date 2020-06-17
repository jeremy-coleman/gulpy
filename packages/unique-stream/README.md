# unique-stream

Last upstream commit: [8c20fce on 17 Dec 2018](https://github.com/eugeneware/unique-stream/commit/8c20fce4c5cd58a13334a30b09a027195a93a6a9).

node.js through stream that emits a unique stream of objects based on criteria

[![Build Status](https://travis-ci.org/eugeneware/unique-stream.svg?branch=master)](https://travis-ci.org/eugeneware/unique-stream)
[![Coverage Status](https://coveralls.io/repos/eugeneware/unique-stream/badge.svg?branch=master&service=github)](https://coveralls.io/github/eugeneware/unique-stream?branch=master)

## Installation

Install via [npm](https://www.npmjs.com/):

```
$ npm install unique-stream
```

## Examples

### Dedupe a ReadStream based on JSON.stringify:

```ts
import unique from "unique-stream"
import Stream from "stream"

// return a stream of 3 identical objects
function makeStreamOfObjects() {
  const s = new Stream()
  s.readable = true
  let count = 3
  for (let i = 0; i < 3; i++) {
    setImmediate(() => {
      s.emit("data", { name: "Bob", number: 123 })
      --count || end()
    })
  }

  function end() {
    s.emit("end")
  }

  return s
}

// Will only print out one object as the rest are dupes. (Uses JSON.stringify)
makeStreamOfObjects().pipe(unique()).on("data", console.log)
```

### Dedupe a ReadStream based on an object property:

```js
// Use name as the key field to dedupe on. Will only print one object
makeStreamOfObjects().pipe(unique("name")).on("data", console.log)
```

### Dedupe a ReadStream based on a custom function:

```js
// Use a custom function to dedupe on. Use the 'number' field. Will only print one object.
makeStreamOfObjects()
  .pipe(data => data.number)
  .on("data", console.log)
```

## Dedupe multiple streams

The reason I wrote this was to dedupe multiple object streams:

```js
const aggregator = unique()

// Stream 1
makeStreamOfObjects().pipe(aggregator)

// Stream 2
makeStreamOfObjects().pipe(aggregator)

// Stream 3
makeStreamOfObjects().pipe(aggregator)

aggregator.on("data", console.log)
```

## Use a custom store to record keys that have been encountered

By default a set is used to store keys encountered so far, in order to check new ones for
uniqueness. You can supply your own store instead, providing it supports the add(key) and
has(key) methods. This could allow you to use a persistent store so that already encountered
objects are not re-streamed when node is reloaded.

```js
const keyStore = {
  store: {},

  add(key) {
    this.store[key] = true
  },

  has(key) {
    return this.store[key] !== undefined
  },
}

makeStreamOfObjects().pipe(unique("name", keyStore)).on("data", console.log)
```

## Contributing

unique-stream is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [CONTRIBUTING.md](https://github.com/eugeneware/unique-stream/blob/master/CONTRIBUTING.md) file for more details.

### Contributors

unique-stream is only possible due to the excellent work of the following contributors:

<table><tbody>
<tr><th align="left">Eugene Ware</th><td><a href="https://github.com/eugeneware">GitHub/eugeneware</a></td></tr>
<tr><th align="left">Craig Ambrose</th><td><a href="https://github.com/craigambrose">GitHub/craigambrose</a></td></tr>
<tr><th align="left">Shinnosuke Watanabe</th><td><a href="https://github.com/shinnn">GitHub/shinnn</a></td></tr>
<tr><th align="left">Rouven Weßling</th><td><a href="https://github.com/realityking">GitHub/realityking</a></td></tr>
</tbody></table>
