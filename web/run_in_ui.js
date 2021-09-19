if (!crossOriginIsolated) {

  outputTextarea.value += "ERROR: no cross-origin isolation\n";

} else {

  let kataGoInstance;

  function testLoadsgf() {
    const sgfFile = "tmp.sgf";
    const {FS} = kataGoInstance;
    FS.createPreloadedFile( FS.cwd(), sgfFile, sgfFile, true, false );
    setTimeout(_ => {
        cmdInput.value = "loadsgf tmp.sgf";
        inputForm.dispatchEvent(new CustomEvent("submit"));
    }, 1000);
  }

  function dispatchMessage(msg) {
    kataGoInstance.postMessage(msg)
  }

  outputTextarea.value += "loading KataGo in UI thread...\n";

  katagoParams["onstatus"] = onKatagoStatus;
  katagoParams["onmessage"] = onKatagoMessage;

  KataGo(katagoParams).then(kg => {
    kataGoInstance = kg;
    console.log("KataGo ready", kg)
  });

}
