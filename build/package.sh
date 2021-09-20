#!/bin/bash -xe

pwd
ls

mv web/             build/public/
mv build/web_models build/public/web_models
mv build/em_build/* build/public/
mkdir -p            build/public/libs/@tensorflow
cd                  build/public/libs/@tensorflow

TF_VER=3.0.0

curl -o TF -L https://registry.npmjs.org/@tensorflow/tfjs/-/tfjs-${TF_VER}.tgz
tar -xf TF package/dist/tf.min.js
mv         package tfjs@${TF_VER}
rm  -rf TF

curl -o TFB -L https://registry.npmjs.org/@tensorflow/tfjs-backend-wasm/-/tfjs-backend-wasm-${TF_VER}.tgz
tar -xf TFB package/dist/tf-backend-wasm.min.js
tar -xf TFB package/dist/tfjs-backend-wasm-threaded-simd.wasm
mv          package tfjs-backend-wasm@${TF_VER}
rm  -rf TFB
