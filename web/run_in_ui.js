function testLoadsgf() {
  const sgfFile = "tmp.sgf";
  FS.createPreloadedFile( FS.cwd(), sgfFile, sgfFile, true, false );
  setTimeout(function() {
      cmdInput.value = "loadsgf tmp.sgf";
      inputForm.dispatchEvent(new CustomEvent("submit"));
  }, 1000);
}

class Input {
  constructor() {
    this.buffer = "";
    inputForm.addEventListener("submit", ev => {
        ev.preventDefault();
        this.dispatchCmd(cmdInput.value);
        cmdInput.value = "";
    }, false);
  }

  dispatchCmd(cmdStr) {
    console.log("[UI] dispatch cmd:", cmdStr);
    this.buffer += cmdStr + "\n";
    outputTextarea.value += cmdStr + "\n";
    outputTextarea.scrollTop = outputTextarea.scrollHeight;

    if (this.resolveP)
      // allow time for textarea to update before blocking UI
      setTimeout(_ => this.resolveP(), 100);
    else
      console.warn('not awaiting stdin');
  }

  callback() {
    if (!this.buffer)
      return null;

    const c = this.buffer[0];
    this.buffer = this.buffer.substr(1);
    return c.charCodeAt(0);
  }

  awaitStdin() {
    return new Promise(
      (res, rej) => { this.resolveP = res; this.rejectP = rej; }
    );
  }
}

class Output {
  constructor() {
    this.buffer = "";
    this.crFlag = false;
  }

  callback(char) {
    if (char === 0 || char === 0x0a) {
      if (this.buffer.length < 1000) {
        outputTextarea.value += this.buffer + "\n";
        outputTextarea.scrollTop = outputTextarea.scrollHeight;
      }

      this.buffer = "";
      this.crFlag = false;
      return;
    }
    if (char === 0x0d) { this.crFlag = true; return; }
    if (this.crFlag)   { this.crFlag = false; this.buffer = ""; }

    this.buffer += String.fromCharCode(char);
  }
}

if (!crossOriginIsolated) {

  outputTextarea.value += "ERROR: no cross-origin isolation\n";

} else {

  const i = new Input();
  const o = new Output();

  function dispatchCmd(cmd) { i.dispatchCmd(cmd); }

  outputTextarea.value += "loading KataGo in UI thread...\n";

  KataGo({
    cfgFile: cfgFile,

    arguments: [
      urlParams.get("subcommand") || "gtp",
      "-model", urlParams.get("model") || "web_model",
      "-config", cfgFile
    ],

    // FS.init
    stdinRead: i.callback.bind(i),
    stdoutWrite: o.callback.bind(o),
    stderrWrite: o.callback.bind(o),

    // tfjs_api.js
    awaitStdin: i.awaitStdin.bind(i),
    notifyStatus: onKatagoStatus
  }).then(kg => console.log("KataGo ready", kg));

}
