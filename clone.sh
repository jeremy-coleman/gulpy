#!/bin/bash

function main() {
  cd packages || return

  repo=$(curl -s -L "https://unpkg.com/$1/package.json" | jq --raw-output "(.repository | strings) // .repository.url")

  if ! [[ "$repo" =~ ^(git|http).+$ ]]; then
    repo="https://github.com/${repo}.git"
  fi

  git clone --depth=1 "$repo"
  cd "$1" || return
  rm -rf .git .gitignore .travis.yml .github .eslintrc .editorconfig .gitattributes .jscsrc appveyor.xml CONTRIBUTING.md
  ren .js .ts

  jq '.main = "index.ts" | del(.files, .keywords) | .scripts //= {} | .scripts.test = "mocha -r ts-node/register \"test/**/*.ts\""' package.tson > package.json
  rm -rf *.tson
  ncu -u
}

main "$@"