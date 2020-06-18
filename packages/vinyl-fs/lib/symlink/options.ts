interface PartialConfig {
  cwd?: string | (() => string)
  dirMode: number
  overwrite?: boolean
  relativeSymlinks?: boolean
  // This option is ignored on non-Windows platforms
  useJunctions?: boolean
}

export type Config = Required<PartialConfig>

export function resolve(c: PartialConfig): Config {
  return {
    cwd: process.cwd,
    overwrite: true,
    relativeSymlinks: false,
    // This option is ignored on non-Windows platforms
    useJunctions: true,
    ...c,
  }
}
