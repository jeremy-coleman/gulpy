import { ok as assert } from "assert"
import { EventEmitter } from "events"
import type { Duplex } from "stream"
import * as bach from "bach"
import type { Registry } from "undertaker-registry"
import { DefaultRegistry } from "undertaker-registry"
import { defaults, map, isString, forEach, isFunction } from "lodash-es"
import { metadata } from "./helpers/metadata"
import { buildTree } from "./helpers/buildTree"
import { normalizeArgs } from "./helpers/normalizeArgs"
import { createExtensions } from "./helpers/createExtensions"
import { lastRun } from "last-run"
import { validateRegistry } from "./helpers/validateRegistry"

export interface TaskFunctionParams {
  readonly name?: string
  displayName?: string
  description?: string
  flags?: TaskFlags
}

export interface TaskFlags {
  [arg: string]: string
}

export interface Done<T = any> {
  (error?: any, results?: T): void
}

export interface TaskFunctionBase {
  (done: Done): void | Duplex | NodeJS.Process | Promise<never> | any
}

export interface TaskFunction extends TaskFunctionBase, TaskFunctionParams {}

export type Task = string | TaskFunction

export interface TaskFunctionWrapped extends TaskFunctionBase {
  displayName: string
  unwrap(): TaskFunction
}

export interface TreeOptions {
  /**
   * Whether or not the whole tree should be returned.
   * Default: false
   */
  deep?: boolean
}

export interface TreeResult {
  label: "Tasks"
  nodes: (string | Node)[]
}

export interface Node {
  label: string
  nodes: Node[]
  type?: string
  branch?: boolean
}

// Type definitions for undertaker 1.2
// Project: https://github.com/gulpjs/undertaker
// Definitions by: Qubo <https://github.com/tkqubo>
//                 Giedrius Grabauskas <https://github.com/GiedriusGrabauskas>
//                 Evan Yamanishi <https://github.com/sh0ji>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export class Undertaker extends EventEmitter {
  private _registry = new DefaultRegistry()
  private _settle: boolean

  constructor(customRegistry?: Registry) {
    super()

    if (customRegistry) {
      this.registry(customRegistry)
    }

    this._settle = process.env.UNDERTAKER_SETTLE === "true"
  }

  /**
   * Optionally takes an object (options) and returns an object representing the tree of registered tasks.
   * @param options - Tree options.
   */
  tree(options?: TreeOptions): TreeResult {
    options = defaults(options || {}, {
      deep: false,
    })

    const tasks = this._registry.tasks()
    const nodes = map(tasks, task => {
      const meta = metadata.get(task)!
      if (options!.deep) {
        return meta.tree
      }
      return meta.tree.label
    })

    return {
      label: "Tasks",
      nodes,
    }
  }

  /**
   * Returns the wrapped registered function.
   * @param taskName - Task name.
   */
  task(taskName: string): TaskFunctionWrapped

  /**
   * Register the task by the taskName.
   * @param taskName - Task name.
   * @param fn - Task function.
   */
  task(taskName: string, fn: TaskFunction): void

  /**
   * Register the task by the name property of the function.
   * @param fn - Task function.
   */
  task(fn: TaskFunction): void

  task(name: string | TaskFunction, fn?: TaskFunction) {
    if (isFunction(name)) {
      fn = name
      name = fn.displayName || fn.name!
      assert(name != null, "Function must have a name")
    }

    if (!fn) {
      return this._getTask(name)
    }

    this._setTask(name, fn)
  }

  /**
   * Takes a variable amount of strings (taskName) and/or functions (fn)
   * and returns a function of the composed tasks or functions.
   * Any taskNames are retrieved from the registry using the get method.
   *
   * When the returned function is executed, the tasks or functions will be executed in series,
   * each waiting for the prior to finish. If an error occurs, execution will stop.
   * @param tasks - List of tasks.
   */
  series(...tasks: Task[]): TaskFunction

  /**
   * Takes a variable amount of strings (taskName) and/or functions (fn)
   * and returns a function of the composed tasks or functions.
   * Any taskNames are retrieved from the registry using the get method.
   *
   * When the returned function is executed, the tasks or functions will be executed in series,
   * each waiting for the prior to finish. If an error occurs, execution will stop.
   * @param tasks - List of tasks.
   */
  series(tasks: Task[]): TaskFunction

  series(...rest: Task[] | [Task[]]) {
    const create = this._settle ? bach.settleSeries : bach.series

    const args = normalizeArgs(this._registry, rest)
    const extensions = createExtensions(this)
    const fn = create(args, extensions)
    const name = "<series>"

    metadata.set(fn, {
      name,
      branch: true,
      tree: {
        label: name,
        type: "function",
        branch: true,
        nodes: buildTree(args),
      },
    })
    return fn
  }

  /**
   * Takes a string or function (task) and returns a timestamp of the last time the task was run successfully.
   * The time will be the time the task started.  Returns undefined if the task has not been run.
   * @param task - Task.
   * @param [timeResolution] - Time resolution.
   */
  lastRun(task: Task, timeResolution?: string | number): number | undefined {
    if (timeResolution == null) {
      timeResolution = process.env.UNDERTAKER_TIME_RESOLUTION
    }

    let fn = isString(task) ? this._getTask(task) : task
    const meta = metadata.get(fn)

    if (meta) {
      fn = meta.orig || fn
    }

    return lastRun(fn, timeResolution)
  }

  /**
   * Takes a variable amount of strings (taskName) and/or functions (fn)
   * and returns a function of the composed tasks or functions.
   * Any taskNames are retrieved from the registry using the get method.
   *
   * When the returned function is executed, the tasks or functions will be executed in parallel,
   * all being executed at the same time. If an error occurs, all execution will complete.
   * @param tasks - list of tasks.
   */
  parallel(...tasks: Task[]): TaskFunction

  /**
   * Takes a variable amount of strings (taskName) and/or functions (fn)
   * and returns a function of the composed tasks or functions.
   * Any taskNames are retrieved from the registry using the get method.
   *
   * When the returned function is executed, the tasks or functions will be executed in parallel,
   * all being executed at the same time. If an error occurs, all execution will complete.
   * @param tasks - list of tasks.
   */
  parallel(tasks: Task[]): TaskFunction

  parallel(...rest: Task[] | [Task[]]) {
    const create = this._settle ? bach.settleParallel : bach.parallel

    const args = normalizeArgs(this._registry, rest)
    const extensions = createExtensions(this)
    const fn = create(args, extensions)
    const name = "<parallel>"

    metadata.set(fn, {
      name,
      branch: true,
      tree: {
        label: name,
        type: "function",
        branch: true,
        nodes: buildTree(args),
      },
    })
    return fn
  }

  /**
   * Returns the current registry object.
   */
  registry(): Registry

  /**
   * The tasks from the current registry will be transferred to it
   * and the current registry will be replaced with the new registry.
   * @param registry - Instance of registry.
   */
  registry(registry: Registry): void

  registry(newRegistry?: Registry) {
    if (!newRegistry) {
      return this._registry
    }

    validateRegistry(newRegistry)

    const tasks = this._registry.tasks()

    forEach(tasks, (task, name) => {
      newRegistry.set(name, task)
    })

    this._registry = newRegistry
    this._registry.init(this)
  }

  private _getTask(name: string): TaskFunction {
    return this._registry.get<TaskFunction>(name)
  }

  private _setTask(name: string, fn: (...args: any[]) => void) {
    assert(name, "Task name must be specified")

    function taskWrapper(...args: any[]) {
      return fn.apply(this, args)
    }

    function unwrap() {
      return fn
    }

    taskWrapper.unwrap = unwrap
    taskWrapper.displayName = name

    const meta = metadata.get(fn)
    const nodes: any[] = []
    if (meta?.branch) {
      nodes.push(meta.tree)
    }

    const task = this._registry.set(name, taskWrapper) || taskWrapper

    metadata.set(task, {
      name,
      orig: fn,
      tree: {
        label: name,
        type: "task",
        nodes,
      },
    })
  }
}
