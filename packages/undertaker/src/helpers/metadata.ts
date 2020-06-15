import type { TaskFunction, Node } from "../index"

export interface Metadata {
  branch?: boolean
  name: string
  orig?: (...args: any[]) => void
  tree: Node
}

// WeakMap for storing metadata
export const metadata = new WeakMap<TaskFunction, Metadata>()
