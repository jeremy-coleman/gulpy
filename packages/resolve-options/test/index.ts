import expect from "expect"
import createResolver from "../"

describe("createResolver", () => {
  it("does not need a config or options object", done => {
    const resolver = createResolver()

    expect(resolver).toExist()

    done()
  })

  it("returns a resolver that contains a `resolve` method", done => {
    const resolver = createResolver()

    expect(resolver.resolve).toBeA("function")

    done()
  })

  it("accepts a config object", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const resolver = createResolver(config)

    expect(resolver).toExist()

    done()
  })

  it("accepts an options object", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const options = {}

    const resolver = createResolver(config, options)

    expect(resolver).toExist()

    done()
  })

  it("coerces just once for constant options", done => {
    let coerced = 0
    const config = {
      myOpt: {
        type(value) {
          coerced++
          return value
        },
        default: "bye bye",
      },
    }

    const options = {
      myOpt: "hello world",
    }

    const resolver = createResolver(config, options)

    expect(resolver).toExist()
    expect(coerced).toBe(0)

    const myOpt1 = resolver.resolve("myOpt")
    expect(myOpt1).toEqual("hello world")
    expect(coerced).toBe(1)

    const myOpt2 = resolver.resolve("myOpt")
    expect(myOpt2).toEqual("hello world")
    expect(coerced).toBe(1)

    done()
  })
})

describe("resolver.resolve", () => {
  it("takes a string key and returns a resolved option", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const resolver = createResolver(config)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual("hello world")

    done()
  })

  it("returns undefined if a string key is not given", done => {
    const resolver = createResolver()

    const myOpt = resolver.resolve({})

    expect(myOpt).toEqual(undefined)

    done()
  })

  it("returns undefined if the key is not defined in the config object", done => {
    const resolver = createResolver()

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual(undefined)

    done()
  })

  it("resolves values against the defined type", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const validOptions = {
      myOpt: "foo",
    }

    const validResolver = createResolver(config, validOptions)

    const validOpt = validResolver.resolve("myOpt")

    expect(validOpt).toEqual("foo")

    const invalidOptions = {
      myOpt: 123,
    }

    const invalidResolver = createResolver(config, invalidOptions)

    const invalidOpt = invalidResolver.resolve("myOpt")

    expect(invalidOpt).toEqual("hello world")

    done()
  })

  it("resolves options that are given as a function, validating the return type", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const validOptions = {
      myOpt() {
        return "foo"
      },
    }

    const validResolver = createResolver(config, validOptions)

    const validOpt = validResolver.resolve("myOpt")

    expect(validOpt).toEqual("foo")

    const invalidOptions = {
      myOpt() {
        return 123
      },
    }

    const invalidResolver = createResolver(config, invalidOptions)

    const invalidOpt = invalidResolver.resolve("myOpt")

    expect(invalidOpt).toEqual("hello world")

    done()
  })

  it("forwards extra arguments to an option function", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const options = {
      myOpt(arg1, arg2) {
        expect(arg1).toEqual("arg1")
        expect(arg2).toEqual("arg2")
        return arg2
      },
    }

    const resolver = createResolver(config, options)

    const myOpt = resolver.resolve("myOpt", "arg1", "arg2")

    expect(myOpt).toEqual("arg2")

    done()
  })

  it("binds the resolver to an option function", done => {
    let resolver

    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const options = {
      myOpt() {
        expect(this).toBe(resolver)
        return "foo"
      },
    }

    resolver = createResolver(config, options)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual("foo")

    done()
  })

  it("allows non-recursive nested resolution of options", done => {
    const config = {
      myOpt1: {
        type: "string",
      },
      myOpt2: {
        type: "string",
      },
    }

    const options = {
      myOpt1() {
        return `hello ${this.resolve("myOpt2")}`
      },
      myOpt2: "world",
    }

    const resolver = createResolver(config, options)

    const myOpt = resolver.resolve("myOpt1")
    expect(myOpt).toEqual("hello world")

    done()
  })

  it("allows non-recursive deeply nested resolution of options", done => {
    const config = {
      myOpt1: {
        type: "string",
      },
      myOpt2: {
        type: "string",
      },
      myOpt3: {
        type: "string",
      },
    }

    const options = {
      myOpt1() {
        return `hello${this.resolve("myOpt2")}`
      },
      myOpt2() {
        return ` ${this.resolve("myOpt3")}`
      },
      myOpt3: "world",
    }

    const resolver = createResolver(config, options)

    const myOpt = resolver.resolve("myOpt1")
    expect(myOpt).toEqual("hello world")

    done()
  })

  it("does not allow recursive resolution of options (to avoid blowing the stack)", done => {
    const config = {
      myOpt: {
        type: "string",
        default: "hello world",
      },
    }

    const options = {
      myOpt() {
        return this.resolve("myOpt")
      },
    }

    const resolver = createResolver(config, options)

    function recursive() {
      resolver.resolve("myOpt")
    }

    expect(recursive).toThrow("Recursive resolution denied.")

    done()
  })

  it("does not allow indirectly recursive resolution (to avoid blowing the stack)", done => {
    const config = {
      myOpt1: {
        type: "string",
        default: "hello world",
      },
      myOpt2: {
        type: "string",
        default: "bye bye",
      },
    }

    const options = {
      myOpt1() {
        return this.resolve("myOpt2")
      },
      myOpt2() {
        return this.resolve("myOpt1")
      },
    }

    const resolver = createResolver(config, options)

    function recursive() {
      resolver.resolve("myOpt1")
    }

    expect(recursive).toThrow("Recursive resolution denied.")

    done()
  })

  it("supports custom type resolution with functions", done => {
    const now = new Date()

    const config = {
      myOpt: {
        type(value) {
          return value.constructor === Date ? value : null
        },
        default: "hello world",
      },
    }

    const options = {
      myOpt: now,
    }

    const resolver = createResolver(config, options)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toBe(now)

    done()
  })

  it("supports arrays of types", done => {
    const config = {
      myOpt: {
        type: ["string", "boolean"],
        default: false,
      },
    }

    const strOptions = {
      myOpt: "foo",
    }

    const strResolver = createResolver(config, strOptions)

    const strOpt = strResolver.resolve("myOpt")

    expect(strOpt).toEqual("foo")

    const boolOptions = {
      myOpt: true,
    }

    const boolResolver = createResolver(config, boolOptions)

    const boolOpt = boolResolver.resolve("myOpt")

    expect(boolOpt).toEqual(true)

    const invalidOptions = {
      myOpt: 123,
    }

    const invalidResolver = createResolver(config, invalidOptions)

    const invalidOpt = invalidResolver.resolve("myOpt")

    expect(invalidOpt).toEqual(false)

    done()
  })

  it("allows functions as default values", done => {
    const config = {
      myOpt: {
        type: "string",
        default() {
          return "hello world"
        },
      },
    }

    const resolver = createResolver(config)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual("hello world")

    done()
  })

  it("forwards extra arguments to a default function", done => {
    const config = {
      myOpt: {
        type: "string",
        default(arg1, arg2) {
          expect(arg1).toEqual("arg1")
          expect(arg2).toEqual("arg2")
          return arg2
        },
      },
    }

    const resolver = createResolver(config)

    const myOpt = resolver.resolve("myOpt", "arg1", "arg2")

    expect(myOpt).toEqual("arg2")

    done()
  })

  it("binds the resolver to a default function", done => {
    let resolver

    const config = {
      myOpt: {
        type: "string",
        default() {
          expect(this).toBe(resolver)
          return "hello world"
        },
      },
    }

    resolver = createResolver(config)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual("hello world")

    done()
  })

  it("does not allow recursive resolution in defaults (to avoid blowing the stack)", done => {
    const config = {
      myOpt: {
        type: "string",
        default() {
          return this.resolve("myOpt")
        },
      },
    }

    const resolver = createResolver(config)

    function recursive() {
      resolver.resolve("myOpt")
    }

    expect(recursive).toThrow("Recursive resolution denied.")

    done()
  })

  it("does not allow indirectly recursive resolution in defaults (to avoid blowing the stack)", done => {
    const config = {
      myOpt1: {
        type: "string",
        default() {
          return this.resolve("myOpt2")
        },
      },
      myOpt2: {
        type: "string",
        default() {
          return this.resolve("myOpt1")
        },
      },
    }

    const resolver = createResolver(config)

    function recursive() {
      resolver.resolve("myOpt1")
    }

    expect(recursive).toThrow("Recursive resolution denied.")

    done()
  })

  it("does not verify your default matches the type", done => {
    const config = {
      myOpt: {
        type: "string",
        default: 123,
      },
    }

    const resolver = createResolver(config)

    const myOpt = resolver.resolve("myOpt")

    expect(myOpt).toEqual(123)

    done()
  })
})
