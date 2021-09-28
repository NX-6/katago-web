mergeInto(LibraryManager.library, {

    $method_support__postset: 'method_support();',
    $method_support: function() {
        const inst = new GraphModelWrapper();
        _js_initBackend_async = inst.initBackend_async.bind(inst);
        _js_getBackend = inst.getBackend.bind(inst);
        _js_downloadMetadata_async = inst.downloadMetadata_async.bind(inst);
        _js_downloadModel_async = inst.downloadModel_async.bind(inst);
        _js_getModelVersion = inst.getModelVersion.bind(inst);
        _js_removeModel = inst.removeModel.bind(inst);
        _js_predict_async = inst.predict_async.bind(inst);
    },

    js_notifyStatus: function(status) {
      Module["onstatus"](status);
    },

    // dummy functions
    js_initBackend_async__deps: ['$method_support'],
    js_initBackend_async: function() { console.error("js_initBackend_async. should not reach"); },
    js_getBackend__deps: ['$method_support'],
    js_getBackend: function() { console.error("js_getBackend. should not reach"); },
    js_downloadMetadata_async__deps: ['$method_support'],
    js_downloadMetadata_async: function() { console.error("js_downloadMetadata_async. should not reach"); },
    js_downloadModel_async__deps: ['$method_support'],
    js_downloadModel_async: function() { console.error("js_downloadModel_async. should not reach"); },
    js_getModelVersion__deps: ['$method_support'],
    js_getModelVersion: function() { console.error("js_getModelVersion. should not reach"); },
    js_removeModel__deps: ['$method_support'],
    js_removeModel: function() { console.error("js_removeModel. should not reach"); },
    js_predict_async__deps: ['$method_support'],
    js_predict_async: function() { console.error("js_predict_async. should not reach"); },
});
