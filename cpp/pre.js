const defaultCfg =
  `logAllGTPCommunication = true
   logSearchInfo = true
   logToStderr = false
   rules = tromp-taylor
   ponderingEnabled = false
   lagBuffer = 1.0
   numSearchThreads = 1`

if (!ENVIRONMENT_IS_PTHREAD) {
  Module["arguments"] = [
    Module["subcommand"] || "gtp",
    "-model", Module["model"],
    "-config", Module["configFile"] || "default.cfg",
    "-override-config",
      Object.entries(Module["config"] || {})
        .filter(([k, v]) => v)
        .map(([k, v]) => k + "=" + v)
        .join(",")
  ];
}

if (!("preRun" in Module))
  Module["preRun"] = [];

Module["preRun"].push(function() {
  let outBuf = "";
  function stdout(char) {
    switch (char) {
      case 0:
      case 0x0a: Module["onmessage"](outBuf); outBuf = ""; return;
      case 0x0d: return;
      default:   outBuf += String.fromCharCode(char);
    }
  }
  FS.init(null, stdout, stdout);

  if (Module["configFile"])
    FS.createPreloadedFile(
      FS.cwd(), Module["configFile"], Module["configFile"], true, false
    );
  else
    FS.writeFile("default.cfg", defaultCfg
  );
});


Module["onRuntimeInitialized"] = function() {
  Module["postCommand"] = function(cmdStr) {
    Module.ccall("enqueueCmd", "void", ["string"], [cmdStr + "\n"]);
  }
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
          case backend.WEBGL: backendName = "webgl"; break;
          case backend.WASM:  backendName = "wasm"; break;
          // case backend.CPU:   backendName = "cpu"; break;
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
        case "webgl": return backend.WEBGL;
        case "wasm":  return backend.WASM;
        // case "cpu":   return backend.CPU;
        default:      return 0;
    }
}

GraphModelWrapper.prototype.downloadMetadata_async = function(charp) {
    return Asyncify.handleSleep(wakeUp => {
        const modelPath = UTF8ToString(charp);
        fetch(modelPath + "/metadata.json")
          .then(res => res.json())
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

function setHeap(data, v) {
  Module.HEAPF32.set(data, v / Module.HEAPF32.BYTES_PER_ELEMENT);
}

GraphModelWrapper.prototype.predict_async = function(
    batches,
    inputBuffer, boardWH, inputBufferChannels,
    inputGlobalBuffer, inputGlobalBufferChannels,
    values, miscvalues, ownerships, policies) {

    const bin_inputs    = new Float32Array(Module.HEAPF32.buffer, inputBuffer,       batches * boardWH * inputBufferChannels);
    const global_inputs = new Float32Array(Module.HEAPF32.buffer, inputGlobalBuffer, batches *           inputGlobalBufferChannels);
    const start = Date.now();
    const inputs = {
      "swa_model/bin_inputs":    tf.tensor(bin_inputs,    [batches, boardWH, inputBufferChannels], 'float32'),
      "swa_model/global_inputs": tf.tensor(global_inputs, [batches,    inputGlobalBufferChannels], 'float32'),
    };

    return Asyncify.handleSleep(wakeUp => {
      this.model.executeAsync(inputs).then(results => {
        const miscvaluesSize = this.modelVersion === 8 ? 10 : 6;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const data = result.dataSync();
            switch (result.size) {
              case 3:                 setHeap(data, values); break;
              case miscvaluesSize:    setHeap(data, miscvalues); break;
              case boardWH:           setHeap(data, ownerships); break;
              case (boardWH + 1) * 2: setHeap(data, policies); break;
            }
        }
        return wakeUp(1);
      }).catch(err => {
        console.error(err);
        return wakeUp(0);
      });
    });

};
