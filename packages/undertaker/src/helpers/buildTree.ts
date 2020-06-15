import { metadata } from "./metadata"
import type { TaskFunction } from "../index"

export function buildTree(tasks: TaskFunction[]) {
  return tasks.map(task => {
    let meta = metadata.get(task)
    if (meta) {
      return meta.tree
    }

    const name = task.displayName || task.name || "<anonymous>"
    meta = {
      name,
      tree: {
        label: name,
        type: "function",
        nodes: [],
      },
    }

    metadata.set(task, meta)
    return meta.tree
  })
}
