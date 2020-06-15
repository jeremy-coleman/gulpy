import { expect } from "chai"
import type { Registry } from "undertaker-registry"
import { noop } from "lodash-es"
import { Undertaker } from "../mod"
import { DefaultRegistry } from "undertaker-registry"
import { CommonRegistry } from "undertaker-common-tasks"
import { MetadataRegistry } from "undertaker-task-metadata"

type invalid = any

interface CustomRegistry extends Registry {}
class CustomRegistry implements Registry {
  get(): any {}
  init(): any {}
  set(): any {}
  tasks(): any {}
}

interface SetNoReturnRegistry extends Registry {}
class SetNoReturnRegistry implements Registry {
  protected _tasks = new Map<string, any>()
  get(name: string) {
    return this._tasks.get(name)
  }
  set(name: string, fn): any {
    this._tasks.set(name, fn)
  }
  init() {}
  tasks(): any {}
}

function InvalidRegistry() {}

describe("registry", () => {
  describe("method", () => {
    it("should return the current registry when no arguments are given", done => {
      const taker = new Undertaker()
      expect(taker.registry()).to.equal(taker["_registry"])
      done()
    })

    it("should set the registry to the given registry instance argument", done => {
      const taker = new Undertaker()
      const customRegistry = new CustomRegistry()
      taker.registry(customRegistry)
      expect(taker.registry()).to.equal(customRegistry)
      done()
    })

    it("should validate the custom registry instance", done => {
      const taker = new Undertaker()
      const invalid = new InvalidRegistry()

      function invalidSet() {
        taker.registry(invalid)
      }

      expect(invalidSet).to.throw("Custom registry must have `get` function")
      done()
    })

    it("should transfer all tasks from old registry to new", done => {
      const taker = new Undertaker(new CommonRegistry())
      const customRegistry = new DefaultRegistry()
      taker.registry(customRegistry)

      expect(taker.task("clean")).to.be.a("function")
      expect(taker.task("serve")).to.be.a("function")
      done()
    })

    it("allows multiple custom registries to used", done => {
      const taker = new Undertaker()
      taker.registry(new CommonRegistry())

      expect(taker.task("clean")).to.be.a("function")
      expect(taker.task("serve")).to.be.a("function")

      taker.registry(new MetadataRegistry())
      taker.task("context", function (cb) {
        expect(this).to.deep.equal({ name: "context" })
        cb()
        done()
      })

      taker.registry(new DefaultRegistry())

      expect(taker.task("clean")).to.be.a("function")
      expect(taker.task("serve")).to.be.a("function")
      expect(taker.task("context")).to.be.a("function")
      taker.series("context")(noop)
    })

    it("throws with a descriptive method when constructor is passed", done => {
      const taker = new Undertaker()

      function ctor() {
        taker.registry(CommonRegistry as invalid)
      }

      expect(ctor).to.throw(
        "Custom registries must be instantiated, but it looks like you passed a constructor"
      )
      done()
    })

    it("calls into the init function after tasks are transferred", done => {
      const taker = new Undertaker(new CommonRegistry())

      const ogInit = DefaultRegistry.prototype.init

      DefaultRegistry.prototype.init = inst => {
        expect(inst).to.equal(taker)
        expect(inst.task("clean")).to.be.a("function")
        expect(inst.task("serve")).to.be.a("function")
      }

      taker.registry(new DefaultRegistry())

      DefaultRegistry.prototype.init = ogInit
      done()
    })
  })

  describe("constructor", () => {
    it("should take a custom registry on instantiation", done => {
      const taker = new Undertaker(new CustomRegistry())
      expect(taker.registry()).to.be.instanceOf(CustomRegistry)
      expect(taker.registry()).to.not.be.instanceOf(DefaultRegistry)
      done()
    })

    it("should default to undertaker-registry if not constructed with custom registry", done => {
      const taker = new Undertaker()
      expect(taker.registry()).to.be.instanceOf(DefaultRegistry)
      expect(taker.registry()).to.not.be.instanceOf(CustomRegistry)
      done()
    })

    it("should take a registry that pre-defines tasks", done => {
      const taker = new Undertaker(new CommonRegistry())
      expect(taker.registry()).to.be.instanceOf(CommonRegistry)
      expect(taker.registry()).to.be.instanceOf(DefaultRegistry)
      expect(taker.task("clean")).to.be.a("function")
      expect(taker.task("serve")).to.be.a("function")
      done()
    })

    it("should throw upon invalid registry", done => {
      /*eslint no-unused-vars: 0*/
      let taker: Undertaker

      function noGet() {
        taker = new Undertaker(new InvalidRegistry())
      }

      expect(noGet).to.throw("Custom registry must have `get` function")
      InvalidRegistry.prototype.get = noop

      function noSet() {
        taker = new Undertaker(new InvalidRegistry())
      }

      expect(noSet).to.throw("Custom registry must have `set` function")
      InvalidRegistry.prototype.set = noop

      function noInit() {
        taker = new Undertaker(new InvalidRegistry())
      }

      expect(noInit).to.throw("Custom registry must have `init` function")
      InvalidRegistry.prototype.init = noop

      function noTasks() {
        taker = new Undertaker(new InvalidRegistry())
      }

      expect(noTasks).to.throw("Custom registry must have `tasks` function")
      InvalidRegistry.prototype.tasks = noop

      taker = new Undertaker(new InvalidRegistry())
      done()

      // TS6133: 'taker' is declared but its value is never read.
      taker
    })
  })

  it("does not require the `set` method to return a task", done => {
    const taker = new Undertaker()
    taker.registry(new SetNoReturnRegistry())
    taker.task("test", noop)
    taker.on("start", ({ name }) => {
      expect(name).to.equal("test")
      done()
    })
    taker.series("test")(noop)
  })
})
