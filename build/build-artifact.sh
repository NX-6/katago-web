#!/bin/bash -xe

ARTIFACT=$1
GITHUB_TOKEN=$2

IMG="docker.pkg.github.com/${GITHUB_REPOSITORY,,}/build-${ARTIFACT}"

echo $GITHUB_TOKEN | \
  docker login docker.pkg.github.com -u $GITHUB_ACTOR --password-stdin

docker pull      $IMG || true
docker build -t  $IMG --cache-from $IMG -f build-${ARTIFACT}.Dockerfile ..
docker push      $IMG
docker create    $IMG | xargs -I ID \
docker cp        ID:/out out
