import lead from "lead"
import * as pumpify from "pumpify"
import mkdirpStream from "fs-mkdirp-stream"
import createResolver from "resolve-options"
import config from "./options"
import prepare from "./prepare"
import sourcemap from "./sourcemap"
import writeContents from "./write-contents"

const folderConfig = {
  outFolder: {
    type: "string",
  },
}

export function dest(outFolder, opt) {
  if (!outFolder) {
    throw Error(
      "Invalid dest() folder argument. Please specify a non-empty string or a function."
    )
  }

  const optResolver = createResolver(config, opt)
  const folderResolver = createResolver(folderConfig, { outFolder })

  function dirpath(file, callback) {
    const dirMode = optResolver.resolve("dirMode", file)

    callback(null, file.dirname, dirMode)
  }

  const saveStream = pumpify.obj(
    prepare(folderResolver, optResolver),
    sourcemap(optResolver),
    mkdirpStream.obj(dirpath),
    writeContents(optResolver)
  )

  // Sink the output stream to start flowing
  return lead(saveStream)
}
