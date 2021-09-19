if (!crossOriginIsolated) {

  outputTextarea.value += "ERROR: no cross-origin isolation\n";

} else {

  outputTextarea.value += "loading KataGo in worker thread...\n";

  const ww = new Worker("katago.main.worker.js");

  katagoParams["type"] = "init";

  ww.postMessage(katagoParams);

  ww.onmessage = ev => {
    const msg = ev.data;
    switch (msg.type) {
      case "status": onKatagoStatus(msg.statusCode); break;
      case "message": onKatagoMessage(msg.text); break;
    }
  };

  function dispatchMessage(msg) {
    ww.postMessage({type: "message", text: msg});
  }

}
