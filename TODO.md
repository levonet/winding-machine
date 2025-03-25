
```sh
pio device monitor -f debug
```


```cpp
#define BUFFER_SIZE 1024

byte buff[BUFFER_SIZE];


void loop() {
    // wait for client
    WiFiClient client = server.available();
    if (!client)
        return;
  
    debug_log("client found");
    while (client.connected()) {
        int size = 0;
  
        // read data from wifi client and send to serial
        while ((size = client.available())) {
           size = (size >= BUFFER_SIZE ? BUFFER_SIZE : size);
           client.read(buff, size);
           Serial.write(buff, size);
           Serial.flush();
        }
      
        // read data from serial and send to wifi client
        while ((size = Serial.available())) {
           size = (size >= BUFFER_SIZE ? BUFFER_SIZE : size);
           Serial.readBytes(buff, size);
           client.write(buff, size);
           client.flush();
        }
    }
   debug_log("client disconnected");
   client.stop();
}
```
