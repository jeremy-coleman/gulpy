const config = {
  cwd: {
    type: "string",
    default: process.cwd,
  },
  dirMode: {
    type: "number",
  },
  overwrite: {
    type: "boolean",
    default: true,
  },
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
