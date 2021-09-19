if (!("preRun" in Module))
  Module["preRun"] = [];

var bufferIn = "";
var bufferOut = "";
var resolveP = null;
var rejectP = null;
var crFlag = false;

Module["postMessage"] = function(cmdStr) {
  bufferIn += cmdStr;
  if (resolveP)
    resolveP();
  else
    console.warn('not awaiting stdin');
};

Module["awaitStdin"] = function() {
  return new Promise((res, rej) => { resolveP = res; rejectP = rej; });
}

function readChar() {
  if (!bufferIn) return null;

  const c = bufferIn[0];
  bufferIn = bufferIn.substr(1);
  return c.charCodeAt(0);
}

function writeChar(char) {
  if (char === 0 || char === 0x0a) {
    if (bufferOut.length < 1000)
      Module["onmessage"](bufferOut);

    crFlag = false; bufferOut = "";
    return;
  }

  if (char === 0x0d) { crFlag = true; return; }
  if (crFlag)        { crFlag = false; bufferOut = ""; }

  bufferOut += String.fromCharCode(char);
}

Module["preRun"].push(function() {
  FS.init(readChar, writeChar, writeChar);

  if (Module["cfgFile"])
    FS.createPreloadedFile(FS.cwd(), Module["cfgFile"], Module["cfgFile"], true, false);
});

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

GraphModelWrapper.prototype.getBackend = function() {
    switch (tf.getBackend()) {
        case "cpu":   return this.CPU;
        case "webgl": return this.WEBGL;
        case "wasm":  return this.WASM;
        default:      return 0;
    }
}

GraphModelWrapper.prototype.setBackend = function(backend) {
    var be;
    switch (backend) {
        case this.AUTO:  be = (typeof OffscreenCanvas !== 'undefined')
                            ? "webgl" : "wasm"; break;
        case this.CPU:   be = "cpu"; break;
        case this.WEBGL: be = "webgl"; break;
        case this.WASM:  be = "wasm"; break;
        default: return;
    }
    return Asyncify.handleSleep(wakeUp => {
        tf.setBackend(be).then(s => {
            console.log("setBackend", be, s);
            if (s) {
                wakeUp(1);
            } else if (backend === this.AUTO && be === "webgl") {
                // OffscreenCanvasが存在してもsetBackendが失敗するケースがあるのでwasmにフォールバックさせる
                console.warn("backend " + be + " failed, trying wasm...");
                tf.setBackend("wasm").then(s => { wakeUp(s ? 1 : 0); });
            } else {
                wakeUp(0);
            }
        });
    });
};

GraphModelWrapper.prototype.downloadMetadata = function(charp) {
    return Asyncify.handleSleep(wakeUp => {
        const model = UTF8ToString(charp);
        loadJSON(model + "/metadata.json")
          .then(json => { this.version = json.version; wakeUp(1); })
          .catch(err => { console.error(err); wakeUp(0); });
    });
};

GraphModelWrapper.prototype.downloadModel = function(charp) {
    return Asyncify.handleSleep(wakeUp => {
        const model = UTF8ToString(charp);
        tf.loadGraphModel(model + "/model.json")
          .then(model => { this.model = model; wakeUp(1); })
          .catch(err => { console.error(err); wakeUp(0); });
    });
};

GraphModelWrapper.prototype.removeModel = function() {
    this.model = null;
};

GraphModelWrapper.prototype.predict = function(
    batches,
    inputBuffer, boardWxH, inputBufferChannels,
    inputGlobalBuffer, inputGlobalBufferChannels,
    values, miscvalues, ownerships, policies) {
    return Asyncify.handleSleep(wakeUp => {
        try {
            const bin_inputs = new Float32Array(Module.HEAPF32.buffer, inputBuffer, batches * boardWxH * inputBufferChannels);
            const global_inputs = new Float32Array(Module.HEAPF32.buffer, inputGlobalBuffer, batches * inputGlobalBufferChannels);
            const start = Date.now();
            this.model.executeAsync({
                "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, boardWxH, inputBufferChannels], 'float32'),
                "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32'),
            }).then(results => {
                // console.log("executeAsync", Date.now() - start);
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
                wakeUp(1);
            });
        } catch (err) {
            console.error(err);
            wakeUp(0);
        }
    });
};

GraphModelWrapper.prototype.getModelVersion = function() {
    return this.version;
};

if (Module['ENVIRONMENT_IS_PTHREAD']) {
    const tf_ver = "3.0.0"
    importScripts(
      `libs/@tensorflow/tfjs@${tf_ver}/dist/tf.min.js`,
      `libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/tf-backend-wasm.min.js`
    );
    tf.wasm.setWasmPaths(`libs/@tensorflow/tfjs-backend-wasm@${tf_ver}/dist/`);
    if (typeof OffscreenCanvas !== 'undefined') {
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
}
