#!/bin/bash
cd packages || return

repo=$(curl -s -L "https://unpkg.com/$1/package.json" | jq --raw-output "(.repository | strings) // .repository.url")

if [[ $repo = gulpjs* ]]; then
  repo="https://github.com/${repo}.git"
fi

git clone "$repo"
cd "$1" || return
rm -rf .git .gitignore .travis.yml .github .eslintrc .editorconfig .gitattributes .jscsrc appveyor.xml
ren .js .ts
ren .tson .json
ncu -u