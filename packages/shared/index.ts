export function removeTrailingSeparator(path: string) {
  return path.replace(/(?<=.)\/+$/, "")
}
