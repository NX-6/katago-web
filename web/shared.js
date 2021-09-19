const urlParams = new URL(location).searchParams;
const cfgFile = urlParams.get("config") || "gtp_auto.cfg";

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

function genmove(color) {
  dispatchCmd((analyzeCheckbox.checked ? "genmove_analyze" : "genmove") + " " + color);
  if (showboardCheckbox.checked) dispatchCmd("showboard");
}

function play(color) {
  dispatchCmd("play " + color + " " + playInput.value);
  if (showboardCheckbox.checked) dispatchCmd("showboard");
  playInput.value = "";
}

showboardButton.addEventListener("click", _ => dispatchCmd("showboard"));
playBlackButton.addEventListener("click", _ => play("black"));
playWhiteButton.addEventListener("click", _ => play("white"));
genmoveBlackButton.addEventListener("click", _ => genmove("black"));
genmoveWhiteButton.addEventListener("click", _ => genmove("white"));

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
