import { DEFAULT_ENCODING } from "../constants"

interface PartialConfig {
  buffer?: boolean
  read?: boolean
  since: Date
  removeBOM?: boolean
  encoding?: string | boolean
  sourcemaps?: boolean
  resolveSymlinks?: boolean
}

export type Config = Required<PartialConfig>

export function resolve(config: PartialConfig): Config {
  return {
    buffer: true,
    read: true,
    removeBOM: true,
    encoding: DEFAULT_ENCODING,
    sourcemaps: false,
    resolveSymlinks: true,
    ...config,
  }
}
