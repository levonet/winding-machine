#ifndef JOYSTICK_H_
#define JOYSTICK_H_

// #include <string>
// #include <iostream>

// #define JS_EVENT_BUTTON 0x01 // button pressed/released
// #define JS_EVENT_AXIS   0x02 // joystick moved
// #define JS_EVENT_INIT   0x80 // initial state of device

enum JoystickDirection {
  IDLE,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  CENTER
};

class JoystickEvent {
  public:
    // static const short MIN_AXES_VALUE = -32768;
    // static const short MAX_AXES_VALUE = 32767;
    // unsigned int time;
    // short value;
    // unsigned char type;
    // unsigned char number;

    virtual void onUp() {}
    virtual void onDown() {}
    virtual void onLeft() {}
    virtual void onRight() {}
    virtual void onCenter() {}
  private:
};

// std::ostream& operator<<(std::ostream& os, const JoystickEvent& e);

class Joystick {
  private:
    int pin;
    JoystickDirection lastDirection{JoystickDirection::IDLE};
    // void openPath(std::string devicePath, bool blocking=false);
    // int _fd;
    JoystickDirection read();

  public:
    Joystick(int joystickPin);

    // bool isFound();
    bool run(JoystickEvent* event);
};

#endif  // JOYSTICK_H_
