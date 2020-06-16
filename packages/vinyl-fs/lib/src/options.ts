import { DEFAULT_ENCODING } from "../constants"

const config = {
  buffer: {
    type: "boolean",
    default: true,
  },
  read: {
    type: "boolean",
    default: true,
  },
  since: {
    type: "date",
  },
  removeBOM: {
    type: "boolean",
    default: true,
  },
  encoding: {
    type: ["string", "boolean"],
    default: DEFAULT_ENCODING,
  },
  sourcemaps: {
    type: "boolean",
    default: false,
  },
  resolveSymlinks: {
    type: "boolean",
    default: true,
  },
}

export default config
