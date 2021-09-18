if (!crossOriginIsolated) {

  outputTextarea.value += "ERROR: no cross-origin isolation\n";

} else {

  outputTextarea.value += "loading KataGo in worker thread...\n";

  const ww = new Worker("katago.main.worker.js");

  ww.postMessage({
    type: "init",
    cfgFile: cfgFile,
    arguments: [
      urlParams.get("subcommand") || "gtp",
      "-model", urlParams.get("model") || "web_model",
      "-config", cfgFile
    ]
  });

  ww.addEventListener("message", ev => {
    const msg = ev.data;
    switch (msg.type) {
      case "status":
        onKatagoStatus(msg.statusCode);
        break;
      case "stdout":
        outputTextarea.value += msg.text + "\n";
        outputTextarea.scrollTop = outputTextarea.scrollHeight;
        break;
    }
  });

  function dispatchCmd(cmdStr) {
    ww.postMessage({type: "cmd", cmdStr: cmdStr});
  }

  document.getElementById("input").addEventListener("submit", ev => {
      ev.preventDefault();

      let cmdStr = ev.currentTarget.command.value + "\n";
      outputTextarea.value += cmdStr;
      outputTextarea.scrollTop = outputTextarea.scrollHeight;
      ev.currentTarget.command.value = "";

      dispatchCmd(cmdStr);
  }, false);

}
