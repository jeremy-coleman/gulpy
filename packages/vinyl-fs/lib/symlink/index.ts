import pumpify from "pumpify"
import lead from "lead"
import mkdirpStream from "fs-mkdirp-stream"
import createResolver from "resolve-options"
import config from "./options"
import prepare from "./prepare"
import linkFile from "./link-file"

const folderConfig = {
  outFolder: {
    type: "string",
  },
}

export function symlink(outFolder, opt) {
  if (!outFolder) {
    throw new Error(
      "Invalid symlink() folder argument." +
        " Please specify a non-empty string or a function."
    )
  }

  const optResolver = createResolver(config, opt)
  const folderResolver = createResolver(folderConfig, { outFolder })

  function dirpath(file, callback) {
    const dirMode = optResolver.resolve("dirMode", file)

    callback(null, file.dirname, dirMode)
  }

  const stream = pumpify.obj(
    prepare(folderResolver, optResolver),
    mkdirpStream.obj(dirpath),
    linkFile(optResolver)
  )

  // Sink the stream to start flowing
  return lead(stream)
}
