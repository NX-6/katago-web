const urlParams = new URL(location).searchParams;
const cfgFile = urlParams.get("config") || "gtp_auto.cfg";

const cmdInput = document.getElementById("input").command;
const outputTextarea = document.getElementById("output");
const showboardButton = document.getElementById("showboard");
const genmoveBlackButton = document.getElementById("genmoveBlack");
const genmoveWhiteButton = document.getElementById("genmoveWhite");

showboardButton.addEventListener("click",
  _ => { dispatchCmd("showboard"); }
);
genmoveBlackButton.addEventListener("click",
  _ => { dispatchCmd("genmove black"); dispatchCmd("showboard"); }
);
genmoveWhiteButton.addEventListener("click",
  _ => { dispatchCmd("genmove white"); dispatchCmd("showboard"); }
);

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
