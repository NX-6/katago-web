FROM ubuntu:focal

ARG  MODEL=b6c96-s175395328-d26788732
ARG  MODEL_PATH=https://media.katagotraining.org/uploaded/networks/zips/kata1
ARG  MODEL_FILE=kata1-${MODEL}.zip

RUN  apt-get update && \
     apt-get install -y \
             curl unzip python3 python3-pip

RUN  ln -s /usr/bin/python3 /usr/bin/python

RUN  pip3 install --upgrade pip
RUN  pip3 install tensorflow==2.6.0
RUN  pip3 install tensorflowjs

RUN     mkdir models
WORKDIR /models
RUN     curl -OL ${MODEL_PATH}/${MODEL_FILE} && unzip ${MODEL_FILE}

COPY    /python /python
COPY    /tfjs   /tfjs
WORKDIR /tfjs

RUN     mkdir /out
RUN     make SIZE=19 && mv web_model/ /out/${MODEL}_19 && make clean
RUN     make SIZE=13 && mv web_model/ /out/${MODEL}_13 && make clean
RUN     make SIZE=9  && mv web_model/ /out/${MODEL}_9  && make clean
