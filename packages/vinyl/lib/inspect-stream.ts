function inspectStream({ constructor }) {
  let streamType = constructor.name
  // Avoid StreamStream
  if (streamType === "Stream") {
    streamType = ""
  }

  return `<${streamType}Stream>`
}

export default inspectStream
