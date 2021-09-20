FROM ubuntu:focal

RUN  apt-get update && \
     apt-get install -y \
             curl unzip python3 python3-pip

RUN  ln -s /usr/bin/python3 /usr/bin/python

RUN  pip3 install --upgrade pip
RUN  pip3 install tensorflow==2.6.0
RUN  pip3 install tensorflowjs

RUN     mkdir models
WORKDIR /models
RUN     curl -OL https://media.katagotraining.org/uploaded/networks/zips/kata1/kata1-b6c96-s175395328-d26788732.zip
RUN     unzip kata1-b6c96-s175395328-d26788732.zip

COPY    /python /python
COPY    /tfjs   /tfjs
WORKDIR /tfjs

RUN     make saved_model/saved_model.pb
RUN     make
RUN     mkdir /out && \
        mv web_model/ /out/kata1-b6c96-s175395328-d26788732
