function isStream(stream) {
  if (!stream) {
    return false
  }

  if (typeof stream.pipe !== "function") {
    return false
  }

  return true
}

export default isStream
