importScripts("katago.js");

let bufferIn = "";
let bufferOut = "";
let resolveP = null;
let rejectP = null;
let crFlag = false;

function onInit(msg) {
  KataGo({
    mainScriptUrlOrBlob: "katago.js",

    cfgFile: msg.cfgFile,
    arguments: msg.arguments,

    // used for FS.init
    stdinRead: readChar,
    stdoutWrite: writeChar,
    stderrWrite: writeChar,

    // used by tfjs_api.js
    awaitStdin: function () {
      return new Promise( (res, rej) => { resolveP = res; rejectP = rej; } );
    },
    notifyStatus: function (status) {
      self.postMessage({type: "status", statusCode: status});
    }
  }).then(kg => console.log("KataGo ready", kg));
}

function onCommand(cmdStr) {
  bufferIn += cmdStr;
  console.log("[worker] dispatch cmd:", bufferIn);
  if (resolveP)
    resolveP();
}

function readChar() {
  if (!bufferIn)
    return null;

  const c = bufferIn[0];
  bufferIn = bufferIn.substr(1);
  return c.charCodeAt(0);
}

function writeChar(char) {
  if (char === 0 || char === 0x0a) {
    if (bufferOut.length < 1000)
      self.postMessage({type: "stdout", text: bufferOut});

    bufferOut = "";
    crFlag = false;
    return;
  }

  if (char === 0x0d) {
    crFlag = true;
    return;
  }

  if (crFlag) {
    crFlag = false;
    bufferOut = "";
  }

  bufferOut += String.fromCharCode(char);
}

self.addEventListener("message", ev => {
    let msg = ev.data;
    switch (msg.type) {
      case "init": onInit(msg); break;
      case "cmd": onCommand(msg.cmdStr); break;
    }
  }
);
