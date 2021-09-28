mergeInto(LibraryManager.library, {

    $method_support__postset: 'method_support();',
    $method_support: function() {
        const inst = new GraphModelWrapper();
        _js_getBackend = inst.js_getBackend.bind(inst);
        _js_setBackend = inst.js_setBackend.bind(inst);
        _js_downloadMetadata = inst.js_downloadMetadata.bind(inst);
        _js_downloadModel = inst.js_downloadModel.bind(inst);
        _js_removeModel = inst.js_removeModel.bind(inst);
        _js_predict = inst.js_predict.bind(inst);
        _js_getModelVersion = inst.js_getModelVersion.bind(inst);
    },

    // dummy functions
    js_getBackend__deps: ['$method_support'],
    js_getBackend: function() { console.error("js_getBackend. should not reach"); },
    js_setBackend__deps: ['$method_support'],
    js_setBackend: function() { console.error("js_setBackend. should not reach"); },
    js_downloadMetadata__deps: ['$method_support'],
    js_downloadMetadata: function() { console.error("js_downloadMetadata. should not reach"); },
    js_downloadModel__deps: ['$method_support'],
    js_downloadModel: function() { console.error("js_downloadModel. should not reach"); },
    js_removeModel__deps: ['$method_support'],
    js_removeModel: function() { console.error("js_removeModel. should not reach"); },
    js_predict__deps: ['$method_support'],
    js_predict: function() { console.error("js_predict. should not reach"); },
    js_getModelVersion__deps: ['$method_support'],
    js_getModelVersion: function() { console.error("js_getModelVersion. should not reach"); },
});
