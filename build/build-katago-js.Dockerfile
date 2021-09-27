# FROM emscripten/emsdk:2.0.30

## 'RuntimeError: abort(Assertion failed: emscripten_is_main_runtime_thread()'
# FROM emscripten/emsdk:2.0.{26, 30}

## high CPU load even after init
# FROM emscripten/emsdk:2.0.{5, 15, 20, 25}

FROM emscripten/emsdk:2.0.30

WORKDIR /
COPY /cpp         /cpp
COPY /em_build.sh /em_build.sh

RUN ./em_build.sh
RUN mkdir /out && cp em_build/katago.* /out
