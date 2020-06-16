import { DEFAULT_ENCODING } from "../constants"

const config = {
  cwd: {
    type: "string",
    default: process.cwd,
  },
  mode: {
    type: "number",
    default({ stat }) {
      return stat ? stat.mode : null
    },
  },
  dirMode: {
    type: "number",
  },
  overwrite: {
    type: "boolean",
    default: true,
  },
  append: {
    type: "boolean",
    default: false,
  },
  encoding: {
    type: ["string", "boolean"],
    default: DEFAULT_ENCODING,
  },
  sourcemaps: {
    type: ["string", "boolean"],
    default: false,
  },
  // Symlink options
  relativeSymlinks: {
    type: "boolean",
    default: false,
  },
  // This option is ignored on non-Windows platforms
  useJunctions: {
    type: "boolean",
    default: true,
  },
}

export default config
