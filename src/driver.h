/* Copyright 2024 <levonet> */
#ifndef SRC_DRIVER_H_
#define SRC_DRIVER_H_

#include <TMCStepper.h>
#include <FastAccelStepper.h>
#include <HardwareSerial.h>
// #include "hardware.h"

// enum DriverModes {
//     SERIAL = 0x0001,
// };

struct DriverConfig {
    DriverConfig() : serial{false}, baudRate{115200}, amps{1300}, micro{16},
        maccell{1000}, mspeed{1000}, mMperRev{2}, moveMM{57},
        stepsPerRoation{200}, currentDirection{true} {}
    bool serial;
    uint8_t uartNr;
    uint32_t baudRate;
    int amps;  // SET STARTING CURRENT MAX 2000
    int micro;  // SET MICROSTEPS
    int maccell;  // SET STARTING ACCELERATION
    int mspeed;  // SET STARTING STEPS/S
    int mMperRev;  // SET MM PER REVOLUTION
    int moveMM;  // SET MOVEMENT IN MM
    float stepsPerRoation;  // PHYSICAL STEPS OF MOTOR, NO MICROSTEPS INCLUDED
    bool currentDirection;  // SET MOTOR DIRECTION
};

class Driver : public FastAccelStepper {
    public:
    // typedef enum {
    // FUNCTION  = 0, ///< Use the functional interface, implementing your own driver functions (internal use only)
    // DRIVER    = 1, ///< Stepper Driver, 2 driver pins required
    // FULL2WIRE = 2, ///< 2 wire stepper, 2 motor pins required
    // FULL3WIRE = 3, ///< 3 wire stepper, such as HDD spindle, 3 motor pins required
    //     FULL4WIRE = 4, ///< 4 wire full stepper, 4 motor pins required
    // HALF3WIRE = 6, ///< 3 wire half stepper, such as HDD spindle, 3 motor pins required
    // HALF4WIRE = 8  ///< 4 wire half stepper, 4 motor pins required
    // } MotorInterfaceType;

};

// bool xDirectionChange(uint8_t pin, uint8_t value);


#endif  // SRC_DRIVER_H_
