import { DefaultRegistry } from "undertaker-registry"

export class MetadataRegistry extends DefaultRegistry {
  set(name: string, fn: Function) {
    const metadata = {
      name,
    }

    const task = fn.bind(metadata)
    this._tasks.set(name, task)
    return task
  }
}
