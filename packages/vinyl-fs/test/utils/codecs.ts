import { expect } from "chai"

function checkCodec(codec) {
  expect(codec).to.be.a("object")
  expect(codec.constructor.name).to.equal("Codec")
  expect(codec.enc).to.be.a("string")
  expect(codec.bomAware).to.be.a("boolean")
  expect(codec.encode).to.be.a("function")
  expect(codec.encodeStream).to.be.a("function")
  expect(codec.decode).to.be.a("function")
  expect(codec.decodeStream).to.be.a("function")
}

export default checkCodec
