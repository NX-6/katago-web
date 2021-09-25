mergeInto(LibraryManager.library, {

    $method_support__postset: 'method_support();',
    $method_support: function() {
        const inst = new GraphModelWrapper();
        _getBackend = inst.getBackend.bind(inst);
        _setBackend = inst.setBackend.bind(inst);
        _downloadMetadata = inst.downloadMetadata.bind(inst);
        _downloadModel = inst.downloadModel.bind(inst);
        _removeModel = inst.removeModel.bind(inst);
        _predict = inst.predict.bind(inst);
        _jsGetModelVersion = inst.getModelVersion.bind(inst);
    },

    // $stdio_support__postset: 'stdio_support();',
    // $stdio_support: function() {
    //     if (!Module['ENVIRONMENT_IS_PTHREAD']) {
    //        _waitForStdin = function() {
    //           console.log("_waitForStdin");
    //             return Asyncify.handleSleep(wakeUp => {
    //                 Module["awaitStdin"]().then(_ => wakeUp());
    //             });
    //         };
    //     }
    // },

    notifyStatus: function(status) { console.log("notifyStatus", status); Module["onstatus"](status); },
    waitForStdin: function() { return waitForStdin(); },

    // dummy functions
    // waitForStdin__deps: ['$stdio_support'],
    // waitForStdin: function() { console.error("waitForStdin. should not reach"); },
    getBackend__deps: ['$method_support'],
    getBackend: function() { console.error("getBackend. should not reach"); },
    setBackend__deps: ['$method_support'],
    setBackend: function() { console.error("setBackend. should not reach"); },
    downloadMetadata__deps: ['$method_support'],
    downloadMetadata: function() { console.error("downloadMetadata. should not reach"); },
    downloadModel__deps: ['$method_support'],
    downloadModel: function() { console.error("downloadModel. should not reach"); },
    removeModel__deps: ['$method_support'],
    removeModel: function() { console.error("removeModel. should not reach"); },
    predict__deps: ['$method_support'],
    predict: function() { console.error("predict. should not reach"); },
    jsGetModelVersion__deps: ['$method_support'],
    jsGetModelVersion: function() { console.error("jsGetModelVersion. should not reach"); },
});
