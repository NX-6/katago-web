#include "logutil.h"

#include <string>
#include <thread>
#include <iostream>
#include <sstream>

void logThread(const std::string& text) {
  std::stringstream msg;
  msg << std::this_thread::get_id() << " " << text << std::endl;
  std::cout << msg.str();
}
