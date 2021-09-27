#include "logutil.h"

#include <string>
#include <thread>
#include <iostream>
#include <sstream>

#include <emscripten.h>

void logThread(const std::string& text) {
  std::stringstream msg;
  msg << std::this_thread::get_id() << " " << text << std::endl;
  std::cout << msg.str();
}

EM_JS(int, js_awaitAsync, (), {
  return Asyncify.handleSleep(function(wakeUp) {
    console.log("waiting...");
    setTimeout(_ => { console.log("wake up!"); wakeUp(42); }, 1000);
  });
});

void awaitAsync() {
  logThread("js_awaitAsync");
  int returnVal = js_awaitAsync();
  logThread("js_awaitAsync RETURNED " + std::to_string(returnVal));
}
