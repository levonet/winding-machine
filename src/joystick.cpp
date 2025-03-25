#include "joystick.h"
#include <Arduino.h>

// #include <sys/types.h>
// #include <sys/stat.h>
// #include <fcntl.h>
// #include <iostream>
// #include <string>
// #include <sstream>
// #include "unistd.h"

Joystick::Joystick(int joystickPin) {
  pin = joystickPin;
  // std::stringstream sstm;
  // sstm << "/dev/input/js" << joystickNumber;
  // openPath(sstm.str());
}

// void Joystick::openPath(std::string devicePath, bool blocking)
// {
//   // Open the device using either blocking or non-blocking
//   _fd = open(devicePath.c_str(), blocking ? O_RDONLY : O_RDONLY | O_NONBLOCK);
// }

bool Joystick::run(JoystickEvent* event) {

  // int _joystickValue = analogRead(pin);

  // Якщо IDLE то
  //   Якщо попередній стан не IDLE, то все скидаємо
  //   Виходимо

  // Якщо попередній стан IDLE
    // - записуємо новий стан
    // - onCall

  // Виходимо

  // int bytes = read(_fd, event, sizeof(*event)); 
  // if (bytes == -1)
  //   return false;
  // return bytes == sizeof(*event);

  return false;
}

JoystickDirection Joystick::read() {
  int _joystickValue = analogRead(pin);

  if (_joystickValue == 0)
    return JoystickDirection::IDLE;

  if (123 < _joystickValue < 456) {
    return JoystickDirection::IDLE;
  }

}

// bool Joystick::isFound()
// {
//   return _fd >= 0;
// }

// std::ostream& operator<<(std::ostream& os, const JoystickEvent& e) {
//   os << "type=" << static_cast<int>(e.type)
//      << " number=" << static_cast<int>(e.number)
//      << " value=" << static_cast<int>(e.value);
//   return os;
// }
