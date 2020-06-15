import { expect } from "chai"
import { DefaultRegistry as Registry } from "../"

function noop() {}

describe("undertaker-registry", () => {
  describe("constructor", () => {
    it("can be constructed with new", () => {
      const reg = new Registry()
      expect(reg.get).to.be.a("function")
      expect(reg.set).to.be.a("function")
      expect(reg.tasks).to.be.a("function")
    })
  })

  describe("init", () => {
    it("is a noop", () => {
      const reg = new Registry()
      expect(reg.init).to.be.a("function")
    })
  })

  describe("get", () => {
    it("returns a task from the registry", () => {
      const reg = new Registry()
      reg["_tasks"].set("test", noop)
      expect(reg.get("test")).to.equal(noop)
    })
  })

  describe("set", () => {
    it("registers a task", () => {
      const reg = new Registry()
      reg.set("test", noop)
      expect(reg["_tasks"].get("test")).to.equal(noop)
    })

    it("returns the task (useful for inheriting)", () => {
      const reg = new Registry()
      const task = reg.set("test", noop)
      expect(task).to.equal(noop)
    })
  })

  describe("tasks", () => {
    it("returns an object of task name->functions", () => {
      const reg = new Registry()
      reg.set("test1", noop)
      reg.set("test2", noop)
      expect(reg.tasks()).to.deep.equal({ test1: noop, test2: noop })
    })
  })
})
