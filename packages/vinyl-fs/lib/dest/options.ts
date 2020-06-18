import { DEFAULT_ENCODING } from "../constants"
import type { File } from "vinyl"

interface PartialConfig {
  cwd?: string | (() => string)
  mode?: number | ((file: File) => null | number)
  dirMode: number
  overwrite?: boolean
  append?: boolean
  encoding?: string | boolean
  sourcemaps?: string | boolean
  // Symlink options
  relativeSymlinks?: boolean
  // This option is ignored on non-Windows platforms
  useJunctions?: boolean
}

export type Config = Required<PartialConfig>

export function resolve(config: PartialConfig): Config {
  return {
    cwd: process.cwd,
    mode({ stat }) {
      return stat ? stat.mode : null
    },
    overwrite: true,
    append: false,
    encoding: DEFAULT_ENCODING,
    sourcemaps: false,
    // Symlink options
    relativeSymlinks: false,
    // This option is ignored on non-Windows platforms
    useJunctions: true,
    ...config,
  }
}
