const urlParams = new URL(document.location).searchParams;

const threadSelect = document.getElementById("thread");
const subcommandSelect = document.getElementById("subcommand");
const configSelect = document.getElementById("config");
const modelSelect = document.getElementById("model");
const backendSelect = document.getElementById("backend");
const inputForm = document.getElementById("input");
const cmdInput = document.getElementById("command");
const outputTextarea = document.getElementById("output");
const showboardButton = document.getElementById("showboard");
const showboardCheckbox = document.getElementById("showboardAuto");
const playInput = document.getElementById("play");
const playBlackButton = document.getElementById("playBlack");
const playWhiteButton = document.getElementById("playWhite");
const genmoveBlackButton = document.getElementById("genmoveBlack");
const genmoveWhiteButton = document.getElementById("genmoveWhite");
const analyzeCheckbox = document.getElementById("analyze");

var dispatchMessage;

function dispatchCommand(cmdStr) {
  const cmdLine = cmdStr + "\n";
  console.log("[UI] dispatch cmd:", cmdStr);
  outputTextarea.value += cmdLine;
  outputTextarea.scrollTop = outputTextarea.scrollHeight;

  // allow time for textarea to update before blocking UI
  setTimeout(_ => dispatchMessage(cmdLine), 100);
}

function genmove(color) {
  dispatchCommand((analyzeCheckbox.checked ? "genmove_analyze" : "genmove") + " " + color);
  if (showboardCheckbox.checked) dispatchCommand("showboard");
}

function play(color) {
  dispatchCommand("play " + color + " " + playInput.value);
  if (showboardCheckbox.checked) dispatchCommand("showboard");
  playInput.value = "";
}

function initSelect(selectElem, urlParam, defaultValue) {
  let value = urlParams.get(urlParam) || defaultValue;
  selectElem.value = value;
  selectElem.addEventListener("change", ev => {
    let url = new URL(document.location.href);
    url.searchParams.set(urlParam, selectElem.value);
    document.location.href = url.href;
  });
  return value;
}

threadValue = initSelect(threadSelect, "thread", "ui");
subcommandValue = initSelect(subcommandSelect, "subcommand", "gtp");
configValue = initSelect(configSelect, "config", "gtp_auto.cfg");
modelValue = initSelect(modelSelect, "model", "kata1-b6c96-s175395328-d26788732");
backendValue = initSelect(backendSelect, "backend", "auto");

showboardButton.addEventListener("click", _ => dispatchCommand("showboard"));
playBlackButton.addEventListener("click", _ => play("black"));
playWhiteButton.addEventListener("click", _ => play("white"));
genmoveBlackButton.addEventListener("click", _ => genmove("black"));
genmoveWhiteButton.addEventListener("click", _ => genmove("white"));

inputForm.addEventListener("submit", ev => {
  ev.preventDefault();
  dispatchCommand(cmdInput.value);
  cmdInput.value = "";
}, false);

function onKatagoStatus(status) {
  switch (status) {
    case 1: // ready
      cmdInput.removeAttribute("disabled");
      cmdInput.setAttribute("placeholder", "GTP command");
      cmdInput.focus();
      break;

    case -1: // fail
      cmdInput.setAttribute("placeholder", "Engine failed loading a weight");
  }
}

function onKatagoMessage(msgStr) {
  outputTextarea.value += msgStr + "\n";
  outputTextarea.scrollTop = outputTextarea.scrollHeight;
}

const katagoParams = {
  cfgFile: configValue,
  arguments: [
    subcommandValue,
    "-model", "web_models/" + modelValue,
    "-config", configValue,
    "-override-config", "tfjsBackend=" + backendValue
  ]
};

if (!crossOriginIsolated) {

  outputTextarea.value += "ERROR: no cross-origin isolation\n";

} else if (threadValue == "worker") {

  outputTextarea.value += "loading KataGo in worker thread...\n";

  const ww = new Worker("demo.worker.js");
  katagoParams["type"] = "init";
  ww.postMessage(katagoParams);
  ww.onmessage = ({data}) => {
    switch (data.type) {
      case "status": onKatagoStatus(data.statusCode); break;
      case "message": onKatagoMessage(data.text); break;
    }
  };

  dispatchMessage = msg => ww.postMessage({type: "message", text: msg});

} else {

  let kataGoInstance;

  function testLoadsgf(sgfFile) {
    const {FS} = kataGoInstance;
    FS.createPreloadedFile(FS.cwd(), sgfFile, sgfFile, true, false);
    setTimeout(_ => dispatchCommand("loadsgf " + sgfFile), 1000);
  }

  dispatchMessage = msg => kataGoInstance.postMessage(msg);

  outputTextarea.value += "loading KataGo in UI thread...\n";

  katagoParams["onstatus"] = onKatagoStatus;
  katagoParams["onmessage"] = onKatagoMessage;

  KataGo(katagoParams).then(kg => {
    kataGoInstance = kg;
    console.log("KataGo ready", kg);
    // testLoadsgf("tmp.sgf");
  });

}