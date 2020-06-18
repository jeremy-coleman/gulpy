import cloneable from "./"
import fs from "fs"
import pump from "pump"

const stream = cloneable(fs.createReadStream("./package.json"))

pump(stream.clone(), fs.createWriteStream("./out1"))

// simulate some asynchronicity
setImmediate(() => {
  pump(stream, fs.createWriteStream("./out2"))
})
