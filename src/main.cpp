#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include "../include/config.h"

// ------------------------ PINOS ------------------------
#define TRIG_PIN   25   // TRIG do ultrassônico
#define ECHO_PIN   33   // ECHO do ultrassônico

#define LED_RED    32
#define LED_GREEN  21                                         
#define LED_BLUE   18
#define BUZZER_PIN 23
#define BUTTON_PIN 13

// ------------------------ PWM BUZZER --------------------
#define BUZZER_CHANNEL 0
#define BUZZER_FREQ    2000
#define BUZZER_RES     8

// ------------------------ TOPICOS MQTT ------------------
#define TOPICO_SENSOR "projeto/guardian/sensor/medida"   // antes era LDR, agora é distância
#define TOPICO_ESTADO "projeto/guardian/sensor/estado"
#define TOPICO_CMD    "projeto/guardian/comandos"

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

// ========================================================
// MEDIÇÃO DO ULTRASSÔNICO
// ========================================================
float medirDistanciaCm() {
    // Garante TRIG em LOW antes do disparo
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);

    // Pulso de 10us no TRIG
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    // Mede o tempo em nível alto no ECHO
    // Timeout de 30ms (~5m de distância máx) para não travar
    long duracao = pulseIn(ECHO_PIN, HIGH, 30000);

    if (duracao == 0) {
        // Sem eco (muito longe ou erro)
        return -1.0;
    }

    // Fórmula: distância (cm) = (duracao(us) * velocidade do som) / 2
    // Velocidade do som ~ 0.0343 cm/us
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
void conectarMQTT() {
    while (!mqttClient.connected()) {
        Serial.print("Conectando ao MQTT... ");

        String clientId = "ESP32-Guardian-";
        clientId += String(random(0xffff), HEX);

        if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
            Serial.println("Conectado!");
            mqttClient.subscribe(TOPICO_CMD);
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

    if (String(topic) == TOPICO_CMD) {
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
}

// ========================================================
// SETUP
// ========================================================
void setup() {
    Serial.begin(115200);
    delay(1500);

    // Pinos do LED RGB
    pinMode(LED_RED, OUTPUT);
    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_BLUE, OUTPUT);

    // Botão
    pinMode(BUTTON_PIN, INPUT);

    // Ultrassônico
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);

    // PWM do buzzer
    ledcSetup(BUZZER_CHANNEL, BUZZER_FREQ, BUZZER_RES);
    ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
    ledcWrite(BUZZER_CHANNEL, 0);

    // TLS sem verificação de certificado (didático)
    secureClient.setInsecure();

    conectarWiFi();
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);

    Serial.println("Sistema Home Alarm iniciado com sensor ultrassônico!");
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
        // Condição de disparo por distância (objeto perto)
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
