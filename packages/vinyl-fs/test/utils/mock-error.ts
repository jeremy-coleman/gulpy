function mockError(...args) {
  const callback = args[args.length - 1]
  callback(new Error("mocked error"))
}

export default mockError
