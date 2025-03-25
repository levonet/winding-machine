
// https://github.com/bigtreetech/BIGTREETECH-TMC2209-V1.2/blob/master/manual/TMC2209-V1.2-manual.pdf
// https://forum.arduino.cc/t/using-a-tmc2209-silent-stepper-motor-driver-with-an-arduino/666992/78?page=5
#include <Arduino.h>
#include "hardware.h"
#include "driver.h"

int xAmps              = 1300; // SET STARTING CURRENT MAX 2000
int xMicro             =   16; // SET MICROSTEPS
int xMaccell           = 1000; // SET STARTING ACCELERATION
int xMspeed            = 1000; // SET STARTING STEPS/S
int xMMperRev          =    2; // SET MM PER REVOLUTION
int xMoveMM            =   57; // SET MOVEMENT IN MM
float xStepsPerRoation =  200; // PHYSICAL STEPS OF MOTOR, NO MICROSTEPS INCLUDED
bool xCurrentDirection = true; // SET MOTOR DIRECTION

HardwareSerial xSerial(xUartNum);
TMC2209Stepper xDriver(&xSerial, xRSense , xDriverAddress);
using namespace TMC2209_n;

FastAccelStepperEngine xEngine = FastAccelStepperEngine();
FastAccelStepper *xStepper = NULL;



// unsigned long howLong = 0;

TaskHandle_t Motor;
TaskHandle_t Print;
TaskHandle_t Input;


void PrintTask(void*);
void InputTask(void*);
void MotorTask(void*);


// hw_timer_t * timer1 = NULL;

// HardwareSerial xSerial(xUartNum);
// TMC2209Stepper xDriver(&xSerial, xRSense , xDriverAddress);


// void IRAM_ATTR onTimer() {
//   digitalWrite(xPulPin, !digitalRead(xPulPin));
// } 

// void activate_interrupt(){
//   {
//     cli();//stop interrupts
//     timer1 = timerBegin(3, 8,true); // Initialize timer 4. Se configura el timer,  ESP(0,1,2,3)
//                                  // prescaler of 8, y true es una bandera que indica si la interrupcion se realiza en borde o en nivel
//     timerAttachInterrupt(timer1, &onTimer, true); //link interrupt with function onTimer
//     timerAlarmWrite(timer1, 8000, true); //En esta funcion se define el valor del contador en el cual se genera la interrupción del timer
//     timerAlarmEnable(timer1);    //Enable timer        
//     sei();//allow interrupts
//   }
// }

bool xDirectionChange(uint8_t pin, uint8_t value) {
  if (pin == xDirPin) {
    while (xDriver.shaft() != value) {
      xDriver.shaft(value);
      vTaskDelay(1);
    }
  }

  return value;
}


void setup() {
  // xDriverInit();
  xSerial.begin(115200, SERIAL_8N1, xUartRXPin, xUartTXPin);
  delay(500);
  
  pinMode(xEnaPin, OUTPUT);
  pinMode(xPulPin, OUTPUT);
  pinMode(xDirPin, OUTPUT);

  digitalWrite(xEnaPin, LOW);
  digitalWrite(xDirPin, LOW);

  xDriver.begin();
  xDriver.toff(2);             // [1..15] enable driver in software
  xDriver.blank_time(24);      // [16, 24, 36, 54]

  xDriver.hysteresis_start(1); // [1..8]
  xDriver.hysteresis_end(12);  // [-3..12]

  // xDriver.rms_current(500); 
  xDriver.rms_current(xAmps, 0.01); // motor RMS current "rms_current will by default set ihold to 50% of irun but you can set your own ratio with additional second argument; rms_current(1000, 0.3)."
  xDriver.seimin(1);           // minimum current for smart current control 0: 1/2 of IRUN 1: 1/4 of IRUN
  xDriver.semin(15);            // [0... 15] If the StallGuard4 result falls below SEMIN*32, the motor current becomes increased to reduce motor load angle.
  xDriver.semax(15);            // [0... 15] If the StallGuard4 result is equal to or above (SEMIN+SEMAX+1)*32, the motor current becomes decreased to save energy.

  xDriver.sedn(4);          // current down step speed 0-11%
  xDriver.seup(2);             // Current increment steps per measured StallGuard2 value 5 seup0 %00 … %11: 1, 2, 4, 8
  xDriver.iholddelay(3);       // 0 - 15 smooth current drop
  xDriver.TPWMTHRS(0);         // 0: Disabled, 0xFFFFF = 1048575 MAX TSTEP.
                              // StealthChop PWM mode is enabled, if configured. When the velocity exceeds
                              // the limit set by TPWMTHRS, the driver switches to SpreadCycle.
  xDriver.TCOOLTHRS(0);        // 0-7 TSTEP
                              // 0: TPWM_THRS= 0
                              // 1: TPWM_THRS= 200
                              // 2: TPWM_THRS= 300
                              // 3: TPWM_THRS= 400
                              // 4: TPWM_THRS= 500
                              // 5: TPWM_THRS= 800
                              // 6: TPWM_THRS= 1200
                              // 7: TPWM_THRS= 4000
  xDriver.pwm_autoscale(true); // Needed for stealthChop
  xDriver.en_spreadCycle(false); // false = StealthChop / true = SpreadCycle

  xDriver.microsteps(xMicro);
  // xDriver.TCOOLTHRS(0xFFFFF); // 20bit max
  xDriver.shaft(xCurrentDirection);
  xDriver.intpol(true);        // interpolate to 256 microsteps
  xDriver.SGTHRS(xStallValue);

  // ACCELL STEPPER SPEED & ACCELERATION
  xEngine.init();
  xStepper = xEngine.stepperConnectToPin(xPulPin);
  xStepper->setDirectionPin(xDirPin, xCurrentDirection);
  xEngine.setExternalCallForPin(xDirectionChange);
  xStepper->setSpeedInHz(xMspeed);  // STEPS PER SECOND
  xStepper->setAcceleration(xMaccell);

  // activate_interrupt();
  if (xMicro != 0) {
    xStepsPerRoation = xStepsPerRoation * xMicro;
  };

  xTaskCreatePinnedToCore(PrintTask, "Print", 2000, NULL, tskIDLE_PRIORITY, &Print, 1);
  xTaskCreatePinnedToCore(MotorTask, "Motor", 5000, NULL, 5, &Motor, 0);
  xTaskCreatePinnedToCore(InputTask, "Input", 5000, NULL, 2, &Input, 1);

}

void loop() {
  vTaskDelete(NULL);
  // static uint32_t last_time=0;
  // uint32_t ms = millis();
  // if((ms-last_time) > 100) { //run every 0.1s
  //    last_time = ms;
  // }
}


void PrintTask(void*) {
  int steppes;
  // int SSpeed;
  // float ActualSpeed;
  // float MaxSpeed;
  for(;;) {
    steppes     = xDriver.TSTEP();
    // SSpeed      = 12000000./(steppes*256.);
    // ActualSpeed = (SSpeed/xStepsPerRoation)*xMMperRev;

    // if (ActualSpeed > MaxSpeed) {MaxSpeed = ActualSpeed;};
    // if (ActualSpeed == 0)       {MaxSpeed = 0;};

    vTaskDelay(100);
  }
}

void InputTask(void*) {
  for(;;) {
    // int dataIn=0;

    // if (Serial.available()) {
    //   dataIn = Serial.parseInt();

    //   if (dataIn > 0 && dataIn < 10000) {
    //     xMspeed = dataIn;
    //     xStepper->setSpeedInHz(xMspeed);
    //   };

    //   if (dataIn >= 100000 && dataIn < 200000 ) {
    //     xMaccell=dataIn-10000;
    //     xStepper->setAcceleration(xMaccell);
    //   };

    //   if (dataIn>=200000 && dataIn<=202001 ) {
    //     xAmps=dataIn-200000;
    //     xDriver.rms_current(xAmps, 0.01);
    //   };
    // };

    vTaskDelay(5);
  }
}

void MotorTask(void*) {
  for(;;) {
    // unsigned long timeIs = millis();

    xStepper->moveTo(xMoveMM/(xMMperRev/xStepsPerRoation), true); // TRUE makes this a blocking function. Remove it to use it as non blocking.
    // howLong = millis()-timeIs;
    vTaskDelay(2000);

    xStepper->moveTo(0, true);

    vTaskDelay(2000);
  }
}

/**
 * Blink
 *
 * Turns on an LED on for one second,
 * then off for one second, repeatedly.
 */





// #define PI 3.1415926535897932384626433832795
// #define HALF_PI 1.5707963267948966192313216916398
// #define TWO_PI 6.283185307179586476925286766559
// #define DEG_TO_RAD 0.017453292519943295769236907684886
// #define RAD_TO_DEG 57.295779513082320876798154814105








// #include "Arduino.h"
// #include <AccelStepper.h>
// #include <LiquidCrystal.h>




// #ifndef LED_BUILTIN
// #define LED_BUILTIN 2
// #endif

// TaskHandle_t Task1;
// TaskHandle_t Task2;

// // volatile byte state = LOW;
// volatile byte stop = LOW;


// // AccelStepper xStepper = AccelStepper(AccelStepper::DRIVER, xPulPin, xDirPin);
// AccelStepper yStepper = AccelStepper(AccelStepper::DRIVER, yPulPin, yDirPin);

// LiquidCrystal lcd(lcdRSPin, lcdEablePin, lcdDB4Pin, lcdDB5Pin, lcdDB6Pin, lcdDB7Pin);


// void xAtHome() {
//   // state = !state;
//   stop = !digitalRead(xHomingSwitchPin);
// }

// // void xAtStart() {
// //   state = LOW;
// // }

// int coreSetup = -1;
// int coreLoop = -1;

// void setup()
// {
//   Serial.begin(115200);

//   lcd.begin(16, 4);

//   // initialize LED digital pin as an output.
//   pinMode(LED_BUILTIN, OUTPUT);
//   pinMode(xHomingSwitchPin, INPUT_PULLUP);

//   // xStepper.setEnablePin(xEnaPin);
//   // // xStepper.setPinsInverted(false, false, true);
//   // xStepper.setMaxSpeed(1000);
//   // xStepper.setSpeed(50);  
//   // delay(500);
//   // xStepper.setCurrentPosition(0);
//   // xStepper.enableOutputs();

//   yStepper.setEnablePin(yEnaPin);
//   yStepper.setPinsInverted(false, false, true);
//   yStepper.setMaxSpeed(1000);
//   yStepper.setSpeed(50);  
//   delay(500);
//   yStepper.setCurrentPosition(0);
//   yStepper.enableOutputs();

//   // First check if not HIGH, if HIGH move from the switch
//   if (!digitalRead(xHomingSwitchPin)) {    
//     lcd.setCursor(0, 2);
//     lcd.print("ERR: X is out of");
//     lcd.setCursor(0, 3);
//     lcd.print("bounds.");
//     // TODO: Block X Motor
//   }
//   attachInterrupt(digitalPinToInterrupt(xHomingSwitchPin), xAtHome, CHANGE);

//   coreSetup = xPortGetCoreID();
// }

// char msgCoordinates[16];
// char msgJoystick[16];
// int timer = 0;

// enum JoystickDirection {
//   REST = 0,
//   UP = 1,
//   DOWN = 2,
//   LEFT = 3,
//   RIGHT = 4,
//   CENTER = 4095
// };

// JoystickDirection joystickValue = JoystickDirection::REST;

// void loop()
// {
//   coreLoop = xPortGetCoreID();
//   timer = millis() / 1000;

//   lcd.setCursor(1, 0);
//   lcd.print(coreSetup);
//   lcd.setCursor(3, 0);
//   lcd.print(coreLoop);

//   lcd.setCursor(0, 1);
//   lcd.print(timer);

//   // delay(500);
//   // digitalWrite(LED_BUILTIN, state);

//   // xStepper.setMaxSpeed(500);
//   // xStepper.setAcceleration(100);
//   // xStepper.moveTo(5000);

//   yStepper.setMaxSpeed(5000);
//   yStepper.setAcceleration(1000);
//   yStepper.moveTo(50000);
//   while (yStepper.run()) {
//     int _timer = millis() / 1000;
//     if (timer != _timer) {
//       timer = _timer;

//       // sprintf(msgCoordinates, "X: %d, %d%" ,
//       //   xStepper.currentPosition(),
//       //   (xStepper.currentPosition() / xStepper.targetPosition()) * 100);

//       sprintf(msgCoordinates, "Y: %d, %d%" ,
//         yStepper.currentPosition(),
//         (yStepper.currentPosition() / yStepper.targetPosition()) * 100);
//       lcd.setCursor(0, 0);
//       lcd.print(msgCoordinates);
//       lcd.setCursor(0, 1);
//       lcd.print(timer);

//     }

//     if (stop) {
//       stop = LOW;
//       lcd.setCursor(0, 2);
//       lcd.print("Stopping...");
//       yStepper.stop();
//       lcd.setCursor(0, 2);
//       lcd.print("Stopped.  ");
//       yStepper.disableOutputs();
//       break;
//     }

//     yield();
//   }

//   int _joystickValue = analogRead(joystickPin);
//   lcd.setCursor(0, 3);

//   sprintf(msgJoystick, "J: %d   " , _joystickValue);
//   lcd.print(msgJoystick);

//   delay(500);

//   // yStepper.runToPosition();

//   // yStepper.disableOutputs();

//   // yStepper.enableOutputs();
//   // yStepper.moveTo(10000);
//   // for (int i = 0; i < 10000; i++) {
//   //   yStepper.run();
//   // }
//   // yStepper.setCurrentPosition(0);
//   // yStepper.disableOutputs();

//   // delay(500);
//   // digitalWrite(LED_BUILTIN, state);

//   // yStepper.enableOutputs();
//   // yStepper.moveTo(10000);
//   // while (yStepper.distanceToGo() != 0) // Full speed basck to 0
//   //   yStepper.run();
//   // yStepper.disableOutputs();

//   // delay(500);

//   // yStepper.enableOutputs();
//   // yStepper.moveTo(0);
//   // while (yStepper.distanceToGo() != 0) // Full speed basck to 0
//   //   yStepper.run();
//   // yStepper.disableOutputs();

//   // delay(1500);

//   // yStepper.runSpeed();

//   // if (state == LOW) {
//   //   yStepper.disableOutputs();
//   // }


//   // state = LOW;
//   /*
//   Serial.println("Homing Motor");
//   stepper.setMaxSpeed(25000);
//   stepper.setAcceleration(500);
//   digitalWrite(sleep, LOW);
//   while (digitalRead(homingSwitch)==LOW) {
//     stepper.moveTo(homePosition);
//     homePosition--;
//     stepper.runSpeedToPosition();
//   }
//   stepper.setCurrentPosition(0);
//   digitalWrite(sleep, HIGH);

//   Serial.println("Bar opening");
//   stepper.setMaxSpeed(30000);
//   stepper.setAcceleration(1000);
//   digitalWrite(sleep, LOW);
//   stepper.moveTo(1700000);
//   stepper.runToPosition();
//   digitalWrite(sleep, HIGH);

//   Serial.println("Bar closing");
//   digitalWrite(sleep, LOW);
//   stepper.moveTo(0);
//   stepper.runToPosition();
//   digitalWrite(sleep, HIGH);
//   */
// }
