FROM emscripten/emsdk:2.0.30

WORKDIR /
COPY /cpp         /cpp
COPY /em_build.sh /em_build.sh

RUN ./em_build.sh
RUN mkdir /out && cp em_build/katago.* /out
