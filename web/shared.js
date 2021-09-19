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

var dispatchMessage; // defined in run_in_ui.js & run_in_worker.js

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
        // testLoadsgf();
        break;

      case -1: // fail
        cmdInput.setAttribute("placeholder", "Engine failed loading a weight");
  }
}

function onKatagoMessage(msgStr) {
  outputTextarea.value += msgStr + "\n";
  outputTextarea.scrollTop = outputTextarea.scrollHeight;
}

const urlParams = new URL(location).searchParams;
const cfgFile = urlParams.get("config") || "gtp_auto.cfg";

const katagoParams = {
  cfgFile: cfgFile,
  arguments: [
    urlParams.get("subcommand") || "gtp",
    "-model", urlParams.get("model") || "web_model",
    "-config", cfgFile
  ],
  onstatus: onKatagoStatus,
  onmessage: onKatagoMessage,
};
