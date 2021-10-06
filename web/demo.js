const urlParams = new URL(document.location).searchParams;

const threadSelect = document.getElementById("thread");
const subcommandSelect = document.getElementById("subcommand");
const configFileSelect = document.getElementById("configFile");
const modelSelect = document.getElementById("model");
const boardsizeSelect = document.getElementById("boardsize");
const backendSelect = document.getElementById("backend");
const maxTimeSelect = document.getElementById("maxTime");

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
const loadsgfSelect = document.getElementById("loadsgf");

var dispatchMessage;
var loadsgf;

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
  return value == "none" ? null : value;
}

let threadValue = initSelect(threadSelect, "thread", "ui");
let subcommandValue = initSelect(subcommandSelect, "subcommand", "gtp");
let configFileValue = initSelect(configFileSelect, "configFile", "none");
let modelValue = initSelect(modelSelect, "model", "b6c96-s175395328-d26788732");
let boardsizeValue = initSelect(boardsizeSelect, "boardsize", "19");
let backendValue = initSelect(backendSelect, "backend", "auto");
let maxTimeValue = initSelect(maxTimeSelect, "maxTime", "none");

showboardButton.addEventListener("click", _ => dispatchCommand("showboard"));
playBlackButton.addEventListener("click", _ => play("black"));
playWhiteButton.addEventListener("click", _ => play("white"));
genmoveBlackButton.addEventListener("click", _ => genmove("black"));
genmoveWhiteButton.addEventListener("click", _ => genmove("white"));
loadsgfSelect.addEventListener("change", _ => loadsgf(loadsgfSelect.value));


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
  subcommand: subcommandValue,

  configFile: configFileValue,
  config: {
    tfjsBackend: backendValue,
    defaultBoardSize: boardsizeValue,

    // maxTime: 3,
    maxVisits: 25, // limits size of search tree
    // maxPlayouts: 300, // limits new searches per move
  },

  model: "web_models/" + modelValue + "_" + boardsizeValue,
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
  loadsgf = sgfFile => {
    ww.postMessage({type: "preload", file: sgfFile, url: "sgf_files/" + sgfFile})
    setTimeout(_ => {
      dispatchCommand("loadsgf " + sgfFile);
      dispatchCommand("showboard");
    }, 500);
  }

} else {

  let kataGoInstance;

  dispatchMessage = msg => kataGoInstance.postCommand(msg);
  loadsgf = sgfFile => {
    fetch("sgf_files/" + sgfFile).then(res => res.text())
    .then(sgfText => {
      kataGoInstance.FS.writeFile(sgfFile, sgfText);
      dispatchCommand("loadsgf " + sgfFile);
      dispatchCommand("showboard");
    });
  }

  outputTextarea.value += "loading KataGo in UI thread...\n";

  // katagoParams["preRun"] = [
  //   ({FS}) => FS.writeFile("sample.sgf", "(;B[ee];W[cc])");
  // ];
  katagoParams["onstatus"] = onKatagoStatus;
  katagoParams["onmessage"] = onKatagoMessage;

  KataGo(katagoParams).then(kg => {
    kataGoInstance = kg;
    console.log("KataGo ready", kg);
  });

}
