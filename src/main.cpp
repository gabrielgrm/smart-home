#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include "../include/config.h"

// ------------------------ PINOS ------------------------
// Ultrassônico
#define TRIG_PIN   25   // TRIG do ultrassônico
#define ECHO_PIN   33   // ECHO do ultrassônico

// LED RGB principal do alarme
#define LED_RED    32
#define LED_GREEN  21
#define LED_BLUE   18

// Buzzer e botão
#define BUZZER_PIN 13
#define BUTTON_PIN 19

// LED RGB da SALA
#define LED_SALA_R 4
#define LED_SALA_G 2
#define LED_SALA_B 15

// LED RGB do QUARTO
#define LED_QUARTO_R 23
#define LED_QUARTO_G 22
#define LED_QUARTO_B 5

// ------------------------ PWM BUZZER --------------------
#define BUZZER_CHANNEL 0
#define BUZZER_FREQ    2000
#define BUZZER_RES     8

// ------------------------ PWM LEDs RGB -----------------
// 8 bits de resolução (0–255)
#define LED_PWM_FREQ   5000
#define LED_PWM_RES    8

// Canais para LED da SALA
#define LED_SALA_R_CH  1
#define LED_SALA_G_CH  2
#define LED_SALA_B_CH  3

// Canais para LED do QUARTO
#define LED_QUARTO_R_CH 4
#define LED_QUARTO_G_CH 5
#define LED_QUARTO_B_CH 6

// ------------------------ TOPICOS MQTT ------------------
#define TOPICO_SENSOR      "projeto/guardian/sensor/medida"
#define TOPICO_ESTADO      "projeto/guardian/sensor/estado"
#define TOPICO_CMD         "projeto/guardian/comandos"
#define TOPICO_LED_SALA    "projeto/guardian/led/sala"
#define TOPICO_LED_QUARTO  "projeto/guardian/led/quarto"

// ------------------------ OBJETOS GLOBAIS ---------------
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

// ------------------------ ESTADOS DO SISTEMA ------------
bool alertaLatched = false;

unsigned long alertActivatedSince = 0;
bool smsSentForThisAlert = false;

int clickCount = 0;
bool alarmePausado = false;
unsigned long lastClickTime = 0;
const unsigned long CLICK_TIMEOUT = 1000;

unsigned long lastBlinkTime = 0;
bool blinkState = false;
const unsigned long BLINK_INTERVAL = 100;

// Limite de disparo em cm (ex.: menos que 30 cm aciona alerta)
const float DISTANCIA_LIMITE_CM = 30.0;

// ========================================================
// FUNÇÕES DE HARDWARE
// ========================================================
void ligarAlerta() {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE, LOW);
    ledcWrite(BUZZER_CHANNEL, 128);
}

void desligarAlerta() {
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_BLUE, LOW);
    ledcWrite(BUZZER_CHANNEL, 0);
}

void mostrarAlarmePausado() {
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE, HIGH);
    ledcWrite(BUZZER_CHANNEL, 0);
}

void beepTriple() {
    const int level = 128;
    const unsigned long beepMs = 120;
    const unsigned long gapMs = 80;

    for (int i = 0; i < 3; ++i) {
        ledcWrite(BUZZER_CHANNEL, level);
        delay(beepMs);
        ledcWrite(BUZZER_CHANNEL, 0);
        if (i < 2) delay(gapMs);
    }
}

// --- Helpers para LEDs RGB da sala e quarto (0–255) ---
void setSalaColor(uint8_t r, uint8_t g, uint8_t b) {
    ledcWrite(LED_SALA_R_CH, r);
    ledcWrite(LED_SALA_G_CH, g);
    ledcWrite(LED_SALA_B_CH, b);
}

void setQuartoColor(uint8_t r, uint8_t g, uint8_t b) {
    ledcWrite(LED_QUARTO_R_CH, r);
    ledcWrite(LED_QUARTO_G_CH, g);
    ledcWrite(LED_QUARTO_B_CH, b);
}

// ========================================================
// MEDIÇÃO DO ULTRASSÔNICO
// ========================================================
float medirDistanciaCm() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);

    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duracao = pulseIn(ECHO_PIN, HIGH, 30000);

    if (duracao == 0) {
        return -1.0;
    }

    float distancia = (duracao * 0.0343f) / 2.0f;
    return distancia;
}

// ========================================================
// WIFI
// ========================================================
void conectarWiFi() {
    Serial.print("Conectando ao WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }

    Serial.println("\nWiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

// ========================================================
// MQTT
// ========================================================

// Parse "R,G,B" -> uint8_t r,g,b
bool parseRGB(const String& msg, uint8_t &r, uint8_t &g, uint8_t &b) {
    int c1 = msg.indexOf(',');
    int c2 = msg.indexOf(',', c1 + 1);
    if (c1 < 0 || c2 < 0) return false;

    String sr = msg.substring(0, c1);
    String sg = msg.substring(c1 + 1, c2);
    String sb = msg.substring(c2 + 1);

    int ir = sr.toInt();
    int ig = sg.toInt();
    int ib = sb.toInt();

    ir = constrain(ir, 0, 255);
    ig = constrain(ig, 0, 255);
    ib = constrain(ib, 0, 255);

    r = (uint8_t)ir;
    g = (uint8_t)ig;
    b = (uint8_t)ib;

    return true;
}

void conectarMQTT() {
    while (!mqttClient.connected()) {
        Serial.print("Conectando ao MQTT... ");

        String clientId = "ESP32-Guardian-";
        clientId += String(random(0xffff), HEX);

        if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
            Serial.println("Conectado!");
            mqttClient.subscribe(TOPICO_CMD);
            mqttClient.subscribe(TOPICO_LED_SALA);
            mqttClient.subscribe(TOPICO_LED_QUARTO);
        } else {
            Serial.print("Falhou. rc=");
            Serial.println(mqttClient.state());
            delay(3000);
        }
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }

    Serial.print("Comando recebido em ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(msg);

    String t = String(topic);

    if (t == TOPICO_CMD) {
        if (msg == "STOP") {
            alertaLatched = false;
            alarmePausado = false;
            desligarAlerta();
            mqttClient.publish(TOPICO_ESTADO, "OK");
            Serial.println("Alarme parado via MQTT (STOP).");
        } else if (msg == "PAUSE") {
            alarmePausado = true;
            alertaLatched = false;
            beepTriple();
            mostrarAlarmePausado();
            mqttClient.publish(TOPICO_ESTADO, "PAUSADO");
            Serial.println("Alarme PAUSADO via MQTT.");
        } else if (msg == "RESUME") {
            alarmePausado = false;
            beepTriple();
            mqttClient.publish(TOPICO_ESTADO, "OK");
            Serial.println("Alarme RETOMADO via MQTT.");
        }
    }
    else if (t == TOPICO_LED_SALA) {
        uint8_t r, g, b;
        if (parseRGB(msg, r, g, b)) {
            setSalaColor(r, g, b);
            Serial.printf("LED SALA -> R:%d G:%d B:%d\n", r, g, b);
        } else {
            Serial.println("Payload inválido para LED SALA (use R,G,B).");
        }
    }
    else if (t == TOPICO_LED_QUARTO) {
        uint8_t r, g, b;
        if (parseRGB(msg, r, g, b)) {
            setQuartoColor(r, g, b);
            Serial.printf("LED QUARTO -> R:%d G:%d B:%d\n", r, g, b);
        } else {
            Serial.println("Payload inválido para LED QUARTO (use R,G,B).");
        }
    }
}

// ========================================================
// SETUP
// ========================================================
void setup() {
    Serial.begin(115200);
    delay(1500);

    // Pinos do LED RGB principal
    pinMode(LED_RED, OUTPUT);
    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_BLUE, OUTPUT);

    // Botão
    pinMode(BUTTON_PIN, INPUT);

    // Ultrassônico
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);

    // LEDS RGB sala e quarto
    pinMode(LED_SALA_R, OUTPUT);
    pinMode(LED_SALA_G, OUTPUT);
    pinMode(LED_SALA_B, OUTPUT);
    pinMode(LED_QUARTO_R, OUTPUT);
    pinMode(LED_QUARTO_G, OUTPUT);
    pinMode(LED_QUARTO_B, OUTPUT);

    // PWM do buzzer
    ledcSetup(BUZZER_CHANNEL, BUZZER_FREQ, BUZZER_RES);
    ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
    ledcWrite(BUZZER_CHANNEL, 0);

    // PWM LEDs sala
    ledcSetup(LED_SALA_R_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_SALA_G_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_SALA_B_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcAttachPin(LED_SALA_R, LED_SALA_R_CH);
    ledcAttachPin(LED_SALA_G, LED_SALA_G_CH);
    ledcAttachPin(LED_SALA_B, LED_SALA_B_CH);
    setSalaColor(0, 0, 0);

    // PWM LEDs quarto
    ledcSetup(LED_QUARTO_R_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_QUARTO_G_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_QUARTO_B_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcAttachPin(LED_QUARTO_R, LED_QUARTO_R_CH);
    ledcAttachPin(LED_QUARTO_G, LED_QUARTO_G_CH);
    ledcAttachPin(LED_QUARTO_B, LED_QUARTO_B_CH);
    setQuartoColor(0, 0, 0);

    // TLS sem verificação de certificado (didático)
    secureClient.setInsecure();

    conectarWiFi();
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);

    Serial.println("Sistema Home Alarm iniciado com sensor ultrassônico e LEDs RGB!");
}

// ========================================================
// LOOP PRINCIPAL
// ========================================================
void loop() {
    if (!mqttClient.connected()) {
        conectarMQTT();
    }
    mqttClient.loop();

    // --- Leitura do sensor ultrassônico ---
    float distancia = medirDistanciaCm();
    Serial.print("Distância: ");
    if (distancia < 0) {
        Serial.println("sem leitura (fora de alcance)");
    } else {
        Serial.print(distancia);
        Serial.println(" cm");
    }

    // --- Leitura do botão ---
    int leituraBotao = digitalRead(BUTTON_PIN);

    if (leituraBotao == HIGH) {
        if (millis() - lastClickTime > CLICK_TIMEOUT) {
            clickCount = 1;
            lastClickTime = millis();
            if (!alarmePausado) {
                alertaLatched = false;
                desligarAlerta();
                mqttClient.publish(TOPICO_ESTADO, "OK");
                Serial.println("Alarme parado por um clique");
            }
        } else {
            clickCount++;
            lastClickTime = millis();

            Serial.print("Cliques rápidos: ");
            Serial.println(clickCount);

            if (clickCount >= 6) {
                alarmePausado = !alarmePausado;
                clickCount = 0;

                if (alarmePausado) {
                    Serial.println("Alarme PAUSADO");
                    alertaLatched = false;
                    beepTriple();
                    mostrarAlarmePausado();
                    mqttClient.publish(TOPICO_ESTADO, "PAUSADO");
                } else {
                    Serial.println("Alarme RETOMADO");
                    beepTriple();
                    mqttClient.publish(TOPICO_ESTADO, "OK");
                }
            }
        }
    }

    if (millis() - lastClickTime > CLICK_TIMEOUT * 2 && clickCount > 0) {
        clickCount = 0;
    }

    // --- Lógica de estados ---
    if (alarmePausado) {
        mostrarAlarmePausado();
    } else if (alertaLatched) {
        if (millis() - lastBlinkTime > BLINK_INTERVAL) {
            lastBlinkTime = millis();
            blinkState = !blinkState;
            digitalWrite(LED_RED, blinkState ? HIGH : LOW);
            digitalWrite(LED_GREEN, LOW);
            digitalWrite(LED_BLUE, LOW);
        }
        ledcWrite(BUZZER_CHANNEL, 128);
        mqttClient.publish(TOPICO_ESTADO, "ALERTA");
    } else {
        if (distancia > 0 && distancia <= DISTANCIA_LIMITE_CM) {
            alertaLatched = true;
            ligarAlerta();
            mqttClient.publish(TOPICO_ESTADO, "ALERTA");
            Serial.println("Alerta ativado e latched por distância!");
            alertActivatedSince = millis();
            smsSentForThisAlert = false;
        } else {
            desligarAlerta();
            mqttClient.publish(TOPICO_ESTADO, "OK");
        }
    }

    // --- SMS via Twilio após X ms de alerta ativo ---
    if (alertaLatched && !smsSentForThisAlert && !alarmePausado) {
        if (millis() - alertActivatedSince >= 10000) {  // 10 segundos
            WiFiClientSecure tlsClient;
            tlsClient.setInsecure();
            HTTPClient http;
            String url = String("https://api.twilio.com/2010-04-01/Accounts/") + TWILIO_ACCOUNT_SID + "/Messages.json";
            http.begin(tlsClient, url);
            http.setAuthorization(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            http.addHeader("Content-Type", "application/x-www-form-urlencoded");

            String body = "To=" + String(ALERT_SMS_TO_NUMBER)
                        + "&From=" + String(TWILIO_FROM_NUMBER)
                        + "&Body=" + String("Alerta ativado no Guardian (ultrassonico)!");

            int code = http.POST(body);
            if (code > 0) {
                Serial.print("SMS enviado, HTTP code: ");
                Serial.println(code);
                smsSentForThisAlert = true;
            } else {
                Serial.print("Falha ao enviar SMS: ");
                Serial.println(code);
            }
            http.end();
        }
    }

    // --- Publicação da medida no MQTT ---
    char msg[16];
    if (distancia < 0) {
        snprintf(msg, sizeof(msg), "NA");
    } else {
        snprintf(msg, sizeof(msg), "%.1f", distancia);
    }
    mqttClient.publish(TOPICO_SENSOR, msg);

    delay(300);
}