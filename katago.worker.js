"use strict";var Module={};function assert(condition,text){if(!condition)abort("Assertion failed: "+text)}function threadPrintErr(){var text=Array.prototype.slice.call(arguments).join(" ");console.error(text)}function threadAlert(){var text=Array.prototype.slice.call(arguments).join(" ");postMessage({cmd:"alert",text:text,threadId:Module["_pthread_self"]()})}var out=function(){throw"out() is not defined in worker.js."};var err=threadPrintErr;self.alert=threadAlert;Module["instantiateWasm"]=function(info,receiveInstance){var instance=new WebAssembly.Instance(Module["wasmModule"],info);receiveInstance(instance);Module["wasmModule"]=null;return instance.exports};self.onmessage=function(e){try{if(e.data.cmd==="load"){Module["wasmModule"]=e.data.wasmModule;Module["wasmMemory"]=e.data.wasmMemory;Module["buffer"]=Module["wasmMemory"].buffer;Module["ENVIRONMENT_IS_PTHREAD"]=true;if(typeof e.data.urlOrBlob==="string"){importScripts(e.data.urlOrBlob)}else{var objectUrl=URL.createObjectURL(e.data.urlOrBlob);importScripts(objectUrl);URL.revokeObjectURL(objectUrl)}KataGo(Module).then(function(instance){Module=instance})}else if(e.data.cmd==="run"){Module["__performance_now_clock_drift"]=performance.now()-e.data.time;Module["__emscripten_thread_init"](e.data.threadInfoStruct,0,0);var max=e.data.stackBase;var top=e.data.stackBase+e.data.stackSize;assert(e.data.threadInfoStruct);assert(top!=0);assert(max!=0);assert(top>max);Module["establishStackSpace"](top,max);Module["PThread"].receiveObjectTransfer(e.data);Module["PThread"].threadInit();try{var result=Module["invokeEntryPoint"](e.data.start_routine,e.data.arg);Module["checkStackCookie"]();if(Module["keepRuntimeAlive"]()){Module["PThread"].setExitStatus(result)}else{Module["__emscripten_thread_exit"](result)}}catch(ex){if(ex!="unwind"){if(typeof Module["_emscripten_futex_wake"]!=="function"){err("Thread Initialisation failed.");throw ex}if(ex instanceof Module["ExitStatus"]){if(Module["keepRuntimeAlive"]()){err("Pthread 0x"+Module["_pthread_self"]().toString(16)+" called exit(), staying alive due to noExitRuntime.")}else{err("Pthread 0x"+Module["_pthread_self"]().toString(16)+" called exit(), calling _emscripten_thread_exit.");Module["__emscripten_thread_exit"](ex.status)}}else{Module["__emscripten_thread_exit"](-2);throw ex}}else{err("Pthread 0x"+Module["_pthread_self"]().toString(16)+" completed its main entry point with an `unwind`, keeping the worker alive for asynchronous operation.")}}}else if(e.data.cmd==="cancel"){if(Module["_pthread_self"]()){Module["__emscripten_thread_exit"](-1)}postMessage({"cmd":"cancelDone"})}else if(e.data.target==="setimmediate"){}else if(e.data.cmd==="processThreadQueue"){if(Module["_pthread_self"]()){Module["_emscripten_current_thread_process_queued_calls"]()}}else{err("worker.js received unknown command "+e.data.cmd);err(e.data)}}catch(ex){err("worker.js onmessage() captured an uncaught exception: "+ex);if(ex&&ex.stack)err(ex.stack);throw ex}};