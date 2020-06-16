import * as path from "path"

// Input/output relative paths
const inputRelative = "./fixtures"
const outputRelative = "./out-fixtures"
// Input/Output base directories
const inputBase = path.join(__dirname, "..", inputRelative)
const outputBase = path.join(__dirname, "..", outputRelative)
// Used for file tests
const inputPath = path.join(inputBase, "./test.txt")
const outputPath = path.join(outputBase, "./test.txt")
// Used for directory tests
const inputDirpath = path.join(inputBase, "./foo")
const outputDirpath = path.join(outputBase, "./foo")
// Used for nested tests
const inputNestedPath = path.join(inputDirpath, "./test.txt")
const outputNestedPath = path.join(outputDirpath, "./test.txt")
// Used for rename tests
const outputRenamePath = path.join(outputBase, "./foo2.txt")
// Used for not-owned tests
const notOwnedBase = path.join(inputBase, "./not-owned/")
const notOwnedPath = path.join(notOwnedBase, "not-owned.txt")
// Used for BOM tests
const bomInputPath = path.join(inputBase, "./bom-utf8.txt")
const beBomInputPath = path.join(inputBase, "./bom-utf16be.txt")
const leBomInputPath = path.join(inputBase, "./bom-utf16le.txt")
const bomContents = "This file is saved as UTF-X with the appropriate BOM.\n"
const beNotBomInputPath = path.join(inputBase, "./not-bom-utf16be.txt")
const leNotBomInputPath = path.join(inputBase, "./not-bom-utf16le.txt")
const notBomContents =
  "This file is saved as UTF-16-X. It contains some garbage at the start that looks like a UTF-8-encoded BOM (but isn't).\n"
const ranBomInputPath = path.join(inputBase, "./ranbom.bin")
// Used for encoding tests
const encodedInputPath = path.join(inputBase, "./enc-gb2312.txt")
const encodedContents = "\u5b54\u5b50\u8bf4\u590d\u6d3b\u8282\u5f69\u86cb\n"
// Used for symlink tests
const symlinkNestedTarget = path.join(inputBase, "./foo/bar/baz.txt")
const symlinkPath = path.join(outputBase, "./test-symlink")
const symlinkDirpath = path.join(outputBase, "./test-symlink-dir")
const symlinkMultiDirpath = path.join(outputBase, "./test-multi-layer-symlink-dir")
const symlinkMultiDirpathSecond = path.join(outputBase, "./test-multi-layer-symlink-dir2")
const symlinkNestedFirst = path.join(outputBase, "./test-multi-layer-symlink")
const symlinkNestedSecond = path.join(outputBase, "./foo/baz-link.txt")
// Paths that don't exist
const neInputBase = path.join(inputBase, "./not-exists/")
const neOutputBase = path.join(outputBase, "./not-exists/")
const neInputDirpath = path.join(neInputBase, "./foo")
const neOutputDirpath = path.join(neOutputBase, "./foo")
// Used for contents of files
const contents = "Hello World!\n"
const sourcemapContents =
  "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9maXh0dXJlcyIsIm5hbWVzIjpbXSwibWFwcGluZ3MiOiIiLCJzb3VyY2VzIjpbIi4vZml4dHVyZXMiXSwic291cmNlc0NvbnRlbnQiOlsiSGVsbG8gV29ybGQhXG4iXX0="

export default {
  inputRelative,
  outputRelative,
  inputBase,
  outputBase,
  inputPath,
  outputPath,
  inputDirpath,
  outputDirpath,
  inputNestedPath,
  outputNestedPath,
  outputRenamePath,
  notOwnedBase,
  notOwnedPath,
  bomInputPath,
  beBomInputPath,
  leBomInputPath,
  beNotBomInputPath,
  leNotBomInputPath,
  notBomContents,
  ranBomInputPath,
  bomContents,
  encodedInputPath,
  encodedContents,
  symlinkNestedTarget,
  symlinkPath,
  symlinkDirpath,
  symlinkMultiDirpath,
  symlinkMultiDirpathSecond,
  symlinkNestedFirst,
  symlinkNestedSecond,
  neInputBase,
  neOutputBase,
  neInputDirpath,
  neOutputDirpath,
  contents,
  sourcemapContents,
}
