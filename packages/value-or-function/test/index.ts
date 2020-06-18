import expect from "expect"
import normalize from "../"

describe("normalize", () => {
  it("compares a type and the type of a value", () => {
    const type = "string"
    const value = "test string"
    const result = normalize(type, value)
    expect(result).toBe(value)
  })

  it("returns undefined if value does not match type", () => {
    const type = "string"
    const value = 1
    const result = normalize(type, value)
    expect(result).toBe(undefined)
  })

  it("supports arrays for the type parameter", () => {
    const type = ["string"]
    const value = "test string"
    const result = normalize(type, value)
    expect(result).toBe(value)
  })

  it("compares each type and the type of the value", () => {
    const type = ["number", "string", "object"]
    const value = "test string"
    const result = normalize(type, value)
    expect(result).toBe(value)
  })

  it("returns undefined if value does not match any type", () => {
    const type = ["string", "undefined"]
    const value = 1
    const result = normalize(type, value)
    expect(result).toBe(undefined)
  })

  it("supports coercer functions for the type parameter", () => {
    const type = () => true
    const value = 1
    const result = normalize(type, value)
    expect(result).toBe(true)
  })

  it("calls the coercer function to attempt coercion", () => {
    const expected = 1
    const type = expect.createSpy().andCall(value => value)
    const result = normalize(type, expected)
    expect(result).toBe(expected)
    expect(type).toHaveBeenCalled()
  })

  it("calls the coercer functions with context, if bound", () => {
    const expected = 1
    const context = {}
    const type = expect.createSpy().andCall(function (value) {
      expect(this).toBe(context)
      return value
    })
    const result = normalize.call(context, type, expected)
    expect(result).toEqual(expected)
    expect(type).toHaveBeenCalled()
  })

  it("calls the value if it is a function", () => {
    const type = "string"
    const expected = "test string"
    const value = expect.createSpy().andCall(() => expected)
    const result = normalize(type, value)
    expect(result).toBe(expected)
    expect(value).toHaveBeenCalled()
  })

  it("calls the value function with context, if bound", () => {
    const type = "string"
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.call(context, type, value)
    expect(value).toHaveBeenCalled()
  })

  it("checks the result of function against coercer", () => {
    const expected = "test string"
    const coercer = expect
      .createSpy()
      .andCall(value => (typeof value === "string" ? value : undefined))
    const value = expect.createSpy().andCall(() => expected)
    const result = normalize(coercer, value)
    expect(result).toBe(expected)
    expect(coercer).toHaveBeenCalled()
    expect(value).toHaveBeenCalled()
  })

  it("calls the function, passing extra arguments", () => {
    const type = "string"
    const expected = "test string"
    const value = expect.createSpy().andCall(arg => arg)
    const result = normalize(type, value, expected)
    expect(result).toBe(expected)
    expect(value).toHaveBeenCalled()
  })

  it("returns null if result of function does not match type", () => {
    const type = "string"
    const value = expect.createSpy().andCall(() => 123)
    const result = normalize(type, value)
    expect(result).toBe(undefined)
    expect(value).toHaveBeenCalled()
  })

  it("rejects if function return val doesn't satisfy custom coercer", () => {
    const coercer = expect
      .createSpy()
      .andCall(value => (typeof value === "string" ? value : undefined))
    const value = expect.createSpy().andCall(() => 123)
    const result = normalize(coercer, value)
    expect(result).toBe(undefined)
    expect(coercer).toHaveBeenCalled()
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.object", () => {
  it("compares value to typeof object", () => {
    const obj = {}
    const arr = []
    const numObj = new Number(1)
    const strObj = new String("test")
    const objResult = normalize.object(obj)
    const arrResult = normalize.object(arr)
    const numObjResult = normalize.object(numObj)
    const strObjResult = normalize.object(strObj)
    expect(objResult).toBe(obj)
    expect(arrResult).toBe(arr)
    expect(numObjResult).toBe(numObj)
    expect(strObjResult).toBe(strObj)
  })

  it("accpets value if it is null", () => {
    const value = null
    const result = normalize.object(value)
    expect(result).toBe(null)
  })

  it("rejects values if not Object", () => {
    const value = "invalid"
    const result = normalize.object(value)
    expect(result).toBe(undefined)
  })

  it("calls the object function with context, if bound", () => {
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.object.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.number", () => {
  it("accepts value if typeof number", () => {
    const value = 1
    const result = normalize.number(value)
    expect(result).toBe(value)
  })

  it("accepts value if it is not-a-number", () => {
    const value = Number.NaN
    const result = normalize.number(value)
    expect(Number.isNaN(result)).toBe(true)
  })

  it("accepts value if it is infinite", () => {
    const value = Number.NEGATIVE_INFINITY
    const result = normalize.number(value)
    expect(result).toBe(value)
  })

  it("accepts value if instanceof Number", () => {
    const expected = 1
    const value = new Number(expected)
    const result = normalize.number(value)
    expect(result).toBe(expected)
  })

  it("rejects values that won't coerce to number", () => {
    const value = "invalid"
    const result = normalize.number(value)
    expect(result).toBe(undefined)
  })

  it("calls the number function with context, if bound", () => {
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.number.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.string", () => {
  it("accepts value if typeof string", () => {
    const value = "test string"
    const result = normalize.string(value)
    expect(result).toBe(value)
  })

  it("accepts value if instanceof String", () => {
    const expected = "test string"
    const value = new String(expected)
    const result = normalize.string(value)
    expect(result).toBe(expected)
  })

  it("accepts value if it is an Object", () => {
    const expected = "test string"
    const value = {
      toString() {
        return expected
      },
    }
    const result = normalize.string(value)
    expect(result).toBe(expected)
  })

  it("rejects Object if its toString doesn't return string", () => {
    const value = {
      toString() {
        return {}
      },
    }
    const result = normalize.string(value)
    expect(result).toBe(undefined)
  })

  it("rejects values that won't coerce to string", () => {
    const value = undefined
    const result = normalize.string(value)
    expect(result).toBe(undefined)
  })

  it("calls the string function with context, if bound", () => {
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.string.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.symbol", () => {
  it("compares value to typeof symbol", function () {
    if (!global.Symbol) {
      console.log("Only available on platforms that support Symbol")
      this.skip()
      return
    }

    const value = Symbol()
    const result = normalize.symbol(value)
    expect(result).toBe(value)
  })

  it("rejects values that are not Symbol", function () {
    if (!global.Symbol) {
      console.log("Only available on platforms that support Symbol")
      this.skip()
      return
    }
    const value = "invalid"
    const result = normalize.symbol(value)
    expect(result).toBe(undefined)
  })

  it("calls the symbol function with context, if bound", function () {
    if (!global.Symbol) {
      console.log("Only available on platforms that support Symbol")
      this.skip()
      return
    }
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.symbol.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.boolean", () => {
  it("accepts value if typeof boolean", () => {
    const value = true
    const result = normalize.boolean(value)
    expect(result).toBe(value)
  })

  it("accepts value if instanceof Boolean", () => {
    const expected = true
    const value = new Boolean(expected)
    const result = normalize.boolean(value)
    expect(result).toBe(expected)
  })

  it("rejects values that won't coerce to boolean", () => {
    const value = "invalid"
    const result = normalize.boolean(value)
    expect(result).toBe(undefined)
  })

  it("calls the boolean function with context, if bound", () => {
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.boolean.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})

describe("normalize.function", () => {
  it("accepts value if typeof function", () => {
    const value = () => {}
    const result = normalize.function(value)
    expect(result).toBe(value)
  })

  it("never calls the function", () => {
    const value = expect.createSpy()
    const result = normalize.function(value)
    expect(result).toBe(value)
    expect(value).toNotHaveBeenCalled()
  })

  it("rejects values that won't coerce to function", () => {
    const value = "invalid"
    const result = normalize.function(value)
    expect(result).toBe(undefined)
  })
})

describe("normalize.date", () => {
  it("coerces a number to a Date object", () => {
    const value = 1
    const expected = new Date(value)
    const result = normalize.date(value)
    expect(result).toEqual(expected)
  })

  it("rejects numbers with not-a-number values", () => {
    const value = Number.NaN
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("rejects numbers with infinite values", () => {
    const value = Number.POSITIVE_INFINITY
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("accepts objects that are Numbers", () => {
    const value = new Number(1)
    const expected = new Date(value)
    const result = normalize.date(value)
    expect(result).toEqual(expected)
  })

  it("rejects Numbers with not-a-number values", () => {
    const value = new Number(Number.NaN)
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("rejects Numbers with infinite values", () => {
    const value = new Number(Number.POSITIVE_INFINITY)
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("accepts objects that are valid Dates", () => {
    const value = new Date()
    const result = normalize.date(value)
    expect(result).toEqual(value)
  })

  it("rejects Dates that are invalid", () => {
    const value = new Date(undefined)
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("rejects object that are not dates", () => {
    const value = "invalid"
    const result = normalize.date(value)
    expect(result).toBe(undefined)
  })

  it("calls the date function with context, if bound", () => {
    const context = {}
    const value = expect.createSpy().andCall(function () {
      expect(this).toBe(context)
    })
    normalize.date.call(context, value)
    expect(value).toHaveBeenCalled()
  })
})
