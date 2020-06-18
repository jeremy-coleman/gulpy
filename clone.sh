#!/bin/bash

function main() {
  cd packages || return

  repo=$(curl -s -L "https://unpkg.com/$1/package.json" | jq --raw-output "(.repository | strings) // .repository.url")

  if ! [[ "$repo" =~ ^(git|http).+$ ]]; then
    repo="https://github.com/${repo}.git"
  fi

  if [[ "$repo" =~ git\+https ]]; then
    repo=${repo:4}
  fi

  git clone --depth=1 "$repo"
  cd "$1" || return
  rm -rf .git .gitignore .travis.yml .github .eslintrc .editorconfig .gitattributes .jscsrc appveyor.yml CONTRIBUTING.md .ci
  ren .js .ts

  jq '.main = "index.ts" | del(.files, .keywords, .engines) | .scripts //= {} | .scripts.test = "mocha -r ts-node/register \"test/**/*.ts\"" | .name = "@local/\(.name)"' package.tson > package.json
  rm -rf *.tson
  ncu -u
  mkdir -p test

  if [ -f test.js ]; then
    mv test.js test/test.ts
  fi
}

main "$@"