importScripts("katago.js");

let kataGoInstance;

self.addEventListener("message", ev => {
  let msg = ev.data;
  switch (msg.type) {
    case "init":
      KataGo({
        mainScriptUrlOrBlob: "katago.js",

        cfgFile: msg.cfgFile,
        arguments: msg.arguments,

        onstatus: status => self.postMessage({type: "status", statusCode: status}),
        onmessage: msg => self.postMessage({type: "message", text: msg})
      }).then(kg => {
        kataGoInstance = kg;
        console.log("KataGo ready", kg)
      });
      break;

    case "message":
      kataGoInstance.postMessage(msg.text);
      break;

    case "preload":
      const {FS} = kataGoInstance;
      FS.createPreloadedFile(FS.cwd(), msg.file, msg.file, true, false);
      break;

  }
});
