if (!("preRun" in Module))
  Module["preRun"] = [];

let ioState = {
  bufferIn: "",
  bufferOut: "",
  resolveP: null,
  rejectP: null,
  crFlag: false
}

if (!Module['ENVIRONMENT_IS_PTHREAD']) {
   function pre_awaitStdinAsync() {
      return Asyncify.handleSleep(function(wakeUp) {
          console.log("pre_awaitStdinAsync", ioState.bufferOut);
          Module["awaitStdin"]().then(_ => {
            console.log("pre_awaitStdinAsync/resolve", ioState.bufferOut);
            wakeUp();
          });
      });
    };
}

Module["postMessage"] = function(cmdStr) {
  ioState.bufferIn += cmdStr;
  if (ioState.resolveP)
    ioState.resolveP();
  else
    console.warn('not awaiting stdin');
};

Module["awaitStdin"] = function() {
  return new Promise((res, rej) => { ioState.resolveP = res; ioState.rejectP = rej; });
}

function readChar() {
  if (!ioState.bufferIn) return null;

  const c = ioState.bufferIn[0];
  ioState.bufferIn = ioState.bufferIn.substr(1);
  return c.charCodeAt(0);
}

function writeChar(char) {
  if (char === 0 || char === 0x0a) {
    // if (bufferOut.length < 1000)
    Module["onmessage"](ioState.bufferOut);

    ioState.crFlag = false;
    ioState.bufferOut = "";
    return;
  }

  if (char === 0x0d)  { ioState.crFlag = true; return; }
  if (ioState.crFlag) { ioState.crFlag = false; ioState.bufferOut = ""; }

  ioState.bufferOut += String.fromCharCode(char);
}

const backend = {
  AUTO: 0,
  CPU: 1,
  WEBGL: 2,
  WASM: 3
};

if (Module['ENVIRONMENT_IS_PTHREAD']) {

    console.log("loading tfjs...");
    const tf_ver = "3.9.0"
    importScripts(
      `libs/@tensorflow/tfjs@${tf_ver}/dist/tf.min.js`,
      `libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/tf-backend-wasm.min.js`
    );
    tf.wasm.setWasmPaths(`libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/`);

    console.log("tf", tf);

    // https://github.com/tensorflow/tfjs/issues/102
    // needs linker-flag? `-s OFFSCREENCANVAS_SUPPORT=1`
    if (typeof OffscreenCanvas !== 'undefined') {
        console.log("offscreen canvas available");
        self.document = {
            createElement: function() { return new OffscreenCanvas(640, 480); }
        };
        // causes 'RuntimeError: abort(Assertion failed: emscripten_is_main_runtime_thread()'
        // self.window = self;
        // self.screen = { width: 640, height: 480 };

        self.HTMLVideoElement = function() {};
        self.HTMLImageElement = function() {};
        self.HTMLCanvasElement = OffscreenCanvas;
    } else {
        console.error("no offscreen canvas");
    }

    var backendCode = backend.AUTO;

    console.log("js_setBackend", backendCode);
    var backendName;
    switch (backendCode) {
        case backend.AUTO:  backendName = (typeof OffscreenCanvas !== 'undefined')
                            ? "webgl" : "wasm"; break;
        case backend.CPU:   backendName = "cpu"; break;
        case backend.WEBGL: backendName = "webgl"; break;
        case backend.WASM:  backendName = "wasm"; break;
        // default: return;
    }

    function dlModel() {
      // const model = UTF8ToString(charp);
      const model = "web_models/b6c96-s175395328-d26788732_19";
      const tf_model_promise = tf.loadGraphModel(model + "/model.json")
      console.log("js_downloadModel", model, tf_model_promise);
      tf_model_promise.then(model => {
        Module["model"] = model;
        console.log("tf.loadGraphModel", model);
      })
      .catch(err => { console.error(err); });
    }

    // https://js.tensorflow.org/api/latest/#setBackend
    let tf_backend_promise = tf.setBackend(backendName);
    console.log("tf.setBackend", backendName, tf_backend_promise);
    tf_backend_promise.then(s => {
        // somehow never invoked (regardless of eventual fulfilled status)
        // maybe because caller doesn't currently wait and promise is GC'ed?
        console.log("tf.setBackend", backendName, s);
        if (!s && backendCode === backend.AUTO && backendName === "webgl") {
            // OffscreenCanvasが存在してもsetBackendが失敗するケースがあるのでwasmにフォールバックさせる
            console.warn("tf.setBackend", backendName, "failed, trying wasm...");
            tf.setBackend("wasm").then(s => {
              console.log("setBackend wasm", s ? "successful" : "failed")
              dlModel();
            });
        } else {
          dlModel();
        }
    }).catch(err => {
      console.error("tf.setBackend failed with:", err);
    });


}

Module["preRun"].push(function() {
  FS.init(readChar, writeChar, writeChar);

  if (Module["cfgFile"])
    FS.createPreloadedFile(FS.cwd(), Module["cfgFile"], Module["cfgFile"], true, false);
});

// Module["onRuntimeInitialized"] = function() {
// }

// The reason why ES5 is https://github.com/emscripten-core/emscripten/issues/9190

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
    // TODO - modelのメタデータ対応
    this.version = 8;
};

GraphModelWrapper.prototype.AUTO = 0;
GraphModelWrapper.prototype.CPU = 1;
GraphModelWrapper.prototype.WEBGL = 2;
GraphModelWrapper.prototype.WASM = 3;

GraphModelWrapper.prototype.js_getBackend = function() {
    // switch (tf.getBackend()) {
    //     case "cpu":   return this.CPU;
    //     case "webgl": return this.WEBGL;
    //     case "wasm":  return this.WASM;
    //     default:      return 0;
    // }
    return 0;
}

GraphModelWrapper.prototype.js_setBackend = function(backendCode) {
    console.log("js_setBackend", backendCode);
    // var backendName;
    // switch (backendCode) {
    //     case this.AUTO:  backendName = (typeof OffscreenCanvas !== 'undefined')
    //                         ? "webgl" : "wasm"; break;
    //     case this.CPU:   backendName = "cpu"; break;
    //     case this.WEBGL: backendName = "webgl"; break;
    //     case this.WASM:  backendName = "wasm"; break;
    //     default: return;
    // }
    //
    // return Asyncify.handleSleep(wakeUp => {
    //     tf.setBackend(backendName).then(s => {
    //         console.log("setBackend", backendName, s);
    //         if (s) {
    //             wakeUp(1);
    //         } else if (backendCode === this.AUTO && backendName === "webgl") {
    //             // OffscreenCanvasが存在してもsetBackendが失敗するケースがあるのでwasmにフォールバックさせる
    //             console.warn("backendCode " + backendName + " failed, trying wasm...");
    //             tf.setBackend("wasm").then(s => { wakeUp(s ? 1 : 0); });
    //         } else {
    //             wakeUp(0);
    //         }
    //     });
    // });

    // if (Module['ENVIRONMENT_IS_PTHREAD']) {
    //     console.log("loading tfjs...");
    //     const tf_ver = "3.0.0"
    //     importScripts(
    //       `libs/@tensorflow/tfjs@${tf_ver}/dist/tf.min.js`,
    //       `libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/tf-backend-wasm.min.js`
    //     );
    //     tf.wasm.setWasmPaths(`libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/`);
    //
    //     console.log("tf", tf);
    //
    //     // https://github.com/tensorflow/tfjs/issues/102
    //     // needs linker-flag? `-s OFFSCREENCANVAS_SUPPORT=1`
    //     if (typeof OffscreenCanvas !== 'undefined') {
    //         console.log("offscreen canvas available");
    //         self.document = {
    //             createElement: function() { return new OffscreenCanvas(640, 480); }
    //         };
    //         // causes 'RuntimeError: abort(Assertion failed: emscripten_is_main_runtime_thread()'
    //         // self.window = self;
    //         // self.screen = { width: 640, height: 480 };
    //
    //         self.HTMLVideoElement = function() {};
    //         self.HTMLImageElement = function() {};
    //         self.HTMLCanvasElement = OffscreenCanvas;
    //     } else {
    //         console.error("no offscreen canvas");
    //     }
    //
    //     // https://js.tensorflow.org/api/latest/#setBackend
    //     let tf_promise = tf.setBackend(backendName);
    //     console.log("tf.setBackend", backendName, tf_promise);
    //     tf_promise.then(s => {
    //         // somehow never invoked (regardless of eventual fulfilled status)
    //         // maybe because caller doesn't currently wait and promise is GC'ed?
    //         console.log("tf.setBackend", backendName, s);
    //         if (!s && backendCode === this.AUTO && backendName === "webgl") {
    //             // OffscreenCanvasが存在してもsetBackendが失敗するケースがあるのでwasmにフォールバックさせる
    //             console.warn("tf.setBackend", backendName, "failed, trying wasm...");
    //             tf.setBackend("wasm").then(s => {
    //               console.log("setBackend wasm", s ? "successful" : "failed")
    //             });
    //         }
    //     }).catch(err => {
    //       console.error("tf.setBackend failed with:", err);
    //     });
    // }

    // return Asyncify.handleSleep(function(wakeUp) {
    //   console.log("js_setBackend/waiting...");
    //   setTimeout(_ => { console.log("js_setBackend/wake up!"); wakeUp(42); }, 1000);
    // });

    return 1;
};

GraphModelWrapper.prototype.js_downloadMetadata = function(charp) {
    // return Asyncify.handleSleep(wakeUp => {
    //     const model = UTF8ToString(charp);
    //     loadJSON(model + "/metadata.json")
    //       .then(json => { this.version = json.version; wakeUp(1); })
    //       .catch(err => { console.error(err); wakeUp(0); });
    // });

    const model = UTF8ToString(charp);
    loadJSON(model + "/metadata.json")
      .then(json => { this.version = json.version; })
      .catch(err => { console.error(err); });
    return 1;
};

GraphModelWrapper.prototype.js_getModelVersion = function() {
    return this.version;
};

GraphModelWrapper.prototype.js_downloadModel = function(charp) {
    // return Asyncify.handleSleep(wakeUp => {
    //     const model = UTF8ToString(charp);
    //     tf.loadGraphModel(model + "/model.json")
    //       .then(model => { this.model = model; wakeUp(1); })
    //       .catch(err => { console.error(err); wakeUp(0); });
    // });

    // const model = UTF8ToString(charp);
    // const tf_promise = tf.loadGraphModel(model + "/model.json")
    // console.log("js_downloadModel", model, tf_promise);
    // tf_promise.then(model => {
    //   this.model = model;
    //   console.log("tf.loadGraphModel", model);
    // })
    // .catch(err => { console.error(err); });

    return 1;
};

GraphModelWrapper.prototype.js_removeModel = function() {
    this.model = null;
};

GraphModelWrapper.prototype.js_predict = function(
    batches,
    inputBuffer, boardWxH, inputBufferChannels,
    inputGlobalBuffer, inputGlobalBufferChannels,
    values, miscvalues, ownerships, policies) {

    return Asyncify.handleSleep(function(wakeUp) {
      const bin_inputs = new Float32Array(Module.HEAPF32.buffer, inputBuffer, batches * boardWxH * inputBufferChannels);
      const global_inputs = new Float32Array(Module.HEAPF32.buffer, inputGlobalBuffer, batches * inputGlobalBufferChannels);
      const start = Date.now();
      console.log("MODEL", Module["model"]);
      Module["model"].executeAsync({
          "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, boardWxH, inputBufferChannels], 'float32'),
          "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32'),
      }).then(results => {
        console.log("TF RESULTS", results);
        var i;
        const miscvaluesSize = this.version === 8 ? 10 : 6;
        for (i = 0; i < results.length; i++) {
            const result = results[i];
            const data = result.dataSync();
            switch (result.size) {
                case 3: //value
                  Module.HEAPF32.set(data, values / Module.HEAPF32.BYTES_PER_ELEMENT);
                  break;
                case miscvaluesSize: // miscvalues
                  Module.HEAPF32.set(data, miscvalues / Module.HEAPF32.BYTES_PER_ELEMENT);
                  break;
                case boardWxH: // ownership
                  Module.HEAPF32.set(data, ownerships / Module.HEAPF32.BYTES_PER_ELEMENT);
                  break;
                case (boardWxH + 1) * 2: // policy
                  Module.HEAPF32.set(data, policies / Module.HEAPF32.BYTES_PER_ELEMENT);
                  break;
            }
        }
        return wakeUp(1);
      }).catch(err => {
        console.error(err);
        return wakeUp(0);
      });
    });

};
