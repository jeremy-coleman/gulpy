#!/bin/bash
function main() {
  cd "packages/$1" || return
  export_name=$(grep "export default" index.ts)

  tsc --noImplicitUseStrict index.ts >/dev/null
  sed -i '' "1s;^;module.exports=exports=${export_name:15}\\;;" index.js
  prettier --write index.js
}

main "$@"
