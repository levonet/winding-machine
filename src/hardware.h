#ifndef HARDWARE_H_
#define HARDWARE_H_

/**
 * Hardware
 *
 * Axis X JK42HM34-1334A
 * Step Angle: 0.9° (400 Steps Per Revolution)
 * Phase current: DC 1.33 A/Phase
 * Wiring:
 *   1. A (BLK) - C (GRN)
 *   2. B (RED) - D (BLU)
 *
 * Axis X Driver TMC2209 V2.0
 * Max Current: 2.5A
 * Logic voltage: 3.3V/5V
 * Input voltage: 5.5V - 28V
 * Wiring:
 *   GND               DIR   (-> 12)
 *   VIO              STEP   (-> 13)
 *   M2B               CLK   (-> GND)
 *   M2A             USART
 *   M1A               PDN   (-> RX(21 SDA), -[=1k=]-> TX(22 SCL))
 *   M1B               MS2   (-> GND)
 *   GND [^^]   VREF   MS1   (-> GND)
 *   VM  [__] IND DIAG  EN   (-> 14)
 *
 * Axis Y 57HBS2401
 * Step Angle: 1.8° (1000 Steps Per Revolution)
 * Phase current: DC 3 A/Phase
 * Wiring:
 *   1. A+ (Red) - A- (Green)
 *   2. B+ (Yellow) - B- (Blue)
 * Encoder Pins:
 *   1, 7: GND
 *   2: +5V
 *   3: EA-
 *   4: EA+
 *   5: EB+
 *   6: EB-
 */
#define xEnaPin     14
#define xDirPin     12
#define xPulPin     13
#define xUartNum    2
#define xUartRXPin  21
#define xUartTXPin  22

#define xDriverAddress  0b00    // TMC2209 Driver address according to MS1 and MS2
#define xRSense         0.11f   // E_SENSE for current calc.  
#define xStallValue     2       // [0..255]

/**
 * Switch X Home
 * Wiring:
 *   GND ---\ --- +3.3V
 *          |
 *          27
 */

#define xHomingSwitchPin 27

/**
 * Axis Y Driver TB6600
 * Spec: https://bulkman3d.com/wp-content/uploads/2019/06/TB6600-Stepper-Motor-Driver-BM3D-v1.1.pdf
 * Max Current: 4A
 * Wiring:
 *   ENA-
 *   ENA+   (->13)
 *   DIR-
 *   DIR+   (->12)
 *   PUL-
 *   PUL+   (->14)
 *   B-
 *   B+
 *   A-
 *   A+
 *   GND
 *   VCC
 */
#define yEnaPin 27 // 13
#define yDirPin 26 // 12
#define yPulPin 25 // 14

/**
 * Display Winstar WH1604A-TMI-CT
 * Spec: https://www.winstar.com.tw/products/character-lcd-display-module/lcd-16x4.html
 * Pins:
 *    1. VSS   (-> GND, -> Rv )
 *    2. VDD   (-> +5V, -> Rv )
 *    3. VO    (-> Rv)
 *    4. RS    (-> 23)
 *    5. R/W   (-> GND)
 *    6. E     (-> 19)
 *    7. DB0
 *    8. DB1
 *    9. DB2
 *   10. DB3
 *   11. DB4   (-> 18)
 *   12. DB5   (-> 17)
 *   13. DB6   (-> 16)
 *   14. DB7   (-> 15)
 *   15. A     (-> +5V)
 *   16. K     (-> GND)
 *
 * Rv: GND --[~10k~]-- +5V
 *              |
 *              V0
 */
#define lcdRSPin    23
#define lcdEablePin 19
#define lcdDB4Pin   18
#define lcdDB5Pin   17
#define lcdDB6Pin   16
#define lcdDB7Pin   15

/**
 * Joystick Caddx
 * Pins:
 *   - VAR   (->GND)
 *   - COM   (->36, -[=16k=]- +3.3V)
 */
#define joystickPin 36

/**
 * ESP32
 *   UART0 TX:1  RX:3  RTS:22 CTS:19
 *   UART1 TX:10 RX:9  RTS:11 CTS:6
 *   UART2 TX:17 RX:16 RTS:7  CTS:8
 * ESP32-S3
 *   UART0 TX:49 RX:50 RTS:15 CTS:16
 *   UART1 TX:17 RX:18 RTS:19 CTS:20
 *   UART2 TX: - RX: - RTS: - CTS: - (user defined)
 */

#endif  // HARDWARE_H_
