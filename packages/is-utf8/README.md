#utf8 detector

Last upstream commit: [cc4c44c on 18 Dec 2015](https://github.com/wayfind/is-utf8/commit/cc4c44ce979a7c0ca0a6308f64b017baba3616ed).

Detect if a Buffer is utf8 encoded.
It need The minimum amount of bytes is 4.

```javascript
import * as fs from "fs"
import * as isUtf8 from "is-utf8"
const ansi = fs.readFileSync("ansi.txt")
const utf8 = fs.readFileSync("utf8.txt")

console.log("ansi.txt is utf8: " + isUtf8(ansi)) //false
console.log("utf8.txt is utf8: " + isUtf8(utf8)) //true
```
