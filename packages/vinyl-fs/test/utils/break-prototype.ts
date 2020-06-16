import File from "vinyl"

function breakPrototype(file) {
  // Set up a broken prototype
  const oldProto = {}
  Object.getOwnPropertyNames(File.prototype).forEach(key => {
    if (key !== "isSymbolic") {
      const desc = Object.getOwnPropertyDescriptor(File.prototype, key)
      Object.defineProperty(oldProto, key, desc)
    }
  })

  // Assign the broken prototype to our instance
  if (typeof Object.setPrototypeOf === "function") {
    Object.setPrototypeOf(file, oldProto)
  } else {
    file.__proto__ = oldProto
  }
}

export default breakPrototype
