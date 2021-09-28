if (!("preRun" in Module))
  Module["preRun"] = [];


Module["preRun"].push(function() {
  // only called on PThread.mainRuntimeThread

  let ioState = { bufferOut: "", crFlag: false }

  function writeChar(char) {
    if (char === 0 || char === 0x0a) {
      Module["onmessage"](ioState.bufferOut);

      ioState.crFlag = false;
      ioState.bufferOut = "";
      return;
    }

    if (char === 0x0d)  { ioState.crFlag = true; return; }
    if (ioState.crFlag) { ioState.crFlag = false; ioState.bufferOut = ""; }

    ioState.bufferOut += String.fromCharCode(char);
  }

  FS.init(null, writeChar, writeChar);

  if (Module["cfgFile"])
    FS.createPreloadedFile(FS.cwd(), Module["cfgFile"], Module["cfgFile"], true, false);
});


Module["onRuntimeInitialized"] = function() {
  Module["postCommand"] = function(cmdStr) {
    Module.ccall("enqueueCmd", "void", ["string"], [cmdStr + "\n"]);
  }
}





function loadJSON(path) {
    return new Promise(function(resolve, reject) {
        const xhr = new XMLHttpRequest();
        const url = new URL(path, scriptDirectory);
        xhr.responseType = "json";
        xhr.open("GET", url);
        xhr.addEventListener("load", _ => {
            console.log("model-meta", xhr);
            resolve(xhr.response);
        });
        xhr.addEventListener("error", _ => reject(xhr.statusText));
        xhr.addEventListener("abort", _ => reject(xhr.statusText));
        xhr.send();
    });
}

var GraphModelWrapper = function() {
  this.model = null;
  this.modelVersion = 8;
};

const backend = { AUTO: 0, CPU: 1, WEBGL: 2, WASM: 3 };

GraphModelWrapper.prototype.initBackend_async = function(backendCode) {
    console.log("js_initBackend_async", backendCode);

    return Asyncify.handleSleep(function(wakeUp) {
      console.log("js_initBackend_async/waiting...");

      console.log("loading tfjs...");
      const tf_ver = "3.9.0"
      importScripts(
        `libs/@tensorflow/tfjs@${tf_ver}/dist/tf.min.js`,
        `libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/tf-backend-wasm.min.js`
      );
      tf.wasm.setWasmPaths(`libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/`);

      // https://github.com/tensorflow/tfjs/issues/102
      if (typeof OffscreenCanvas !== 'undefined') {
          console.log("offscreen canvas available");
          self.document = {
              createElement: function() { return new OffscreenCanvas(640, 480); }
          };
          self.window = self;
          self.screen = { width: 640, height: 480 };

          self.HTMLVideoElement = function() {};
          self.HTMLImageElement = function() {};
          self.HTMLCanvasElement = OffscreenCanvas;
      } else {
          console.error("no offscreen canvas");
      }

      var backendName;
      switch (backendCode) {
          case backend.AUTO:  backendName = (typeof OffscreenCanvas !== 'undefined')
                              ? "webgl" : "wasm"; break;
          case backend.CPU:   backendName = "cpu"; break;
          case backend.WEBGL: backendName = "webgl"; break;
          case backend.WASM:  backendName = "wasm"; break;
          // default: return;
      }

      // https://js.tensorflow.org/api/latest/#setBackend
      let tf_backend_promise = tf.setBackend(backendName);
      console.log("tf.setBackend", backendName, tf_backend_promise);
      tf_backend_promise.then(s => {
          console.log("tf.setBackend", backendName, s);
          if (s) {
            wakeUp(1);
          } else if (backendCode === backend.AUTO && backendName === "webgl") {
            // OffscreenCanvasが存在してもsetBackendが失敗するケースがあるのでwasmにフォールバックさせる
            console.warn("tf.setBackend", backendName, "failed, trying wasm...");
            tf.setBackend("wasm").then(s => {
              console.log("setBackend wasm", s ? "successful" : "failed")
              wakeUp(s ? 1 : 0);
            });
          } else {
            wakeUp(0);
          }
      }).catch(err => {
        console.error("tf.setBackend failed with:", err);
      });
    });
};

GraphModelWrapper.prototype.getBackend = function() {
    switch (tf.getBackend()) {
        case "cpu":   return backend.CPU;
        case "webgl": return backend.WEBGL;
        case "wasm":  return backend.WASM;
        default:      return 0;
    }
}

GraphModelWrapper.prototype.downloadMetadata_async = function(charp) {
    return Asyncify.handleSleep(wakeUp => {
        const model = UTF8ToString(charp);
        loadJSON(model + "/metadata.json")
          .then(json => { this.modelVersion = json.version; wakeUp(1); })
          .catch(err => { console.error(err); wakeUp(0); });
    });
};

GraphModelWrapper.prototype.getModelVersion = function() { return this.modelVersion; };

GraphModelWrapper.prototype.removeModel = function() { this.model = null; };

GraphModelWrapper.prototype.downloadModel_async = function(charp) {
    return Asyncify.handleSleep(wakeUp => {
        const modelPath = UTF8ToString(charp);
        tf.loadGraphModel(modelPath + "/model.json")
          .then(model => { this.model = model; wakeUp(1); })
          .catch(err => { console.error(err); wakeUp(0); });
    });
};

GraphModelWrapper.prototype.predict_async = function(
    batches,
    inputBuffer, boardWxH, inputBufferChannels,
    inputGlobalBuffer, inputGlobalBufferChannels,
    values, miscvalues, ownerships, policies) {

    return Asyncify.handleSleep(wakeUp => {
      const bin_inputs = new Float32Array(Module.HEAPF32.buffer, inputBuffer, batches * boardWxH * inputBufferChannels);
      const global_inputs = new Float32Array(Module.HEAPF32.buffer, inputGlobalBuffer, batches * inputGlobalBufferChannels);
      const start = Date.now();

      this.model.executeAsync({
          "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, boardWxH, inputBufferChannels], 'float32'),
          "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32'),
      }).then(results => {
        var i;
        const miscvaluesSize = this.modelVersion === 8 ? 10 : 6;
        function setHeap(data, v) {
          Module.HEAPF32.set(data, v / Module.HEAPF32.BYTES_PER_ELEMENT);
        }
        for (i = 0; i < results.length; i++) {
            const result = results[i];
            const data = result.dataSync();
            switch (result.size) {
              case 3:                   setHeap(data, values); break;
              case miscvaluesSize:      setHeap(data, miscvalues); break;
              case boardWxH:            setHeap(data, ownerships); break;
              case (boardWxH + 1) * 2:  setHeap(data, policies); break;
            }
        }
        return wakeUp(1);
      }).catch(err => {
        console.error(err);
        return wakeUp(0);
      });
    });

};
