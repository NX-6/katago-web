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
      const tf_ver = "3.9.0";
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
          // if 'webgl' is not supported fall back to 'wasm' ('cpu' should never
          // be needed because katago itself already requires wasm)
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

function writeOutput(outputPtr, result) {
  Module.HEAPF32.set(result.dataSync(), outputPtr / Module.HEAPF32.BYTES_PER_ELEMENT );
}

GraphModelWrapper.prototype.predict_async =
  function(N,
           inBufSpatial, WH, C_spatial,
           inBufGlobal, C_global,
           outValuesProb, outValuesMisc, outOwnerships, outPolicies) {

    const t_start = Date.now();
    const spatial_inputs = new Float32Array(Module.HEAPF32.buffer, inBufSpatial, N * WH * C_spatial);
    const global_inputs  = new Float32Array(Module.HEAPF32.buffer, inBufGlobal, N * C_global);
    const inTensors = {
      "swa_model/spatial_inputs": tf.tensor(spatial_inputs, [N, WH, C_spatial], 'float32'),
      "swa_model/global_inputs": tf.tensor(global_inputs, [N, C_global], 'float32'),
    };

    const valuesMiscN = this.modelVersion === 8 ? 10 : 6;

    return Asyncify.handleSleep(wakeUp => {
      this.model.executeAsync(inTensors).then(outTensors => {
        const t_end = Date.now();

        // output order non-deterministic, disambiguate by size
        for (let i = 0; i < outTensors.length; i++) {
          const t = outTensors[i];
          switch(t.size) {
            case (WH + 1) * 2: writeOutput(outPolicies,   t); break;
            case WH:           writeOutput(outOwnerships, t); break;
            case 3:            writeOutput(outValuesProb, t); break;
            case valuesMiscN:  writeOutput(outValuesMisc, t); break;
          }
        }

        // console.log("predict_async: " + (t_end - t_start) + "ms", outTensors);
        return wakeUp(1);
      }).catch(err => {
        console.error(err);
        return wakeUp(0);
      });
    });
  };
