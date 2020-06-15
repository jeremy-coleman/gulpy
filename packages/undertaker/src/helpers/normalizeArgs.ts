import { ok as assert } from "assert"
import { isFunction } from "lodash-es"
import type { Registry } from "undertaker-registry"
import type { Task, TaskFunction } from "../index"

export function normalizeArgs(registry: Registry, args: Task[][] | Task[]) {
  function getFunction(task: Task) {
    if (isFunction(task)) {
      return task
    }

    const fn = registry.get<TaskFunction>(task)
    assert(fn, `Task never defined: ${task}`)
    return fn
  }

  const flattenArgs = args.flat(Infinity) as Task[]
  assert(
    flattenArgs.length,
    "One or more tasks should be combined using series or parallel"
  )

  return flattenArgs.map(getFunction)
}
