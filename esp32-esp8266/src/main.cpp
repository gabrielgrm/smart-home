#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"
#include "../include/config.h"

// ========================================================
// FREERTOS - CONFIGURAÇÃO E SINCRONIZAÇÃO
// ========================================================
// O FreeRTOS permite executar múltiplas tarefas simultaneamente
// Cada tarefa tem sua própria função e prioridade

// Mutexes para proteger variáveis compartilhadas entre tarefas
SemaphoreHandle_t mutexEstado;  // Protege: alertaLatched, alarmePausado, etc
SemaphoreHandle_t mutexDistancia; // Protege: leitura da distância

// Fila para comunicação entre tarefas (opcional, para envio de comandos)
QueueHandle_t filaComandos;

// ========================================================
// PINOS DO HARDWARE
// ========================================================
// Ultrassônico
#define TRIG_PIN   25
#define ECHO_PIN   33

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

// ========================================================
// PWM CONFIGURATION
// ========================================================
#define BUZZER_CHANNEL 0
#define BUZZER_FREQ    2000
#define BUZZER_RES     8

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

// ========================================================
// TOPICOS MQTT
// ========================================================
#define TOPICO_SENSOR      "projeto/smart-palafita/sensor/medida"
#define TOPICO_ESTADO      "projeto/smart-palafita/sensor/estado"
#define TOPICO_CMD         "projeto/smart-palafita/comandos"
#define TOPICO_LED_SALA    "projeto/smart-palafita/led/sala"
#define TOPICO_LED_QUARTO  "projeto/smart-palafita/led/quarto"
// Tópicos de estado por cômodo (ON/OFF + tempo)
#define TOPICO_LED_SALA_ESTADO   "projeto/smart-palafita/led/sala/estado"
#define TOPICO_LED_QUARTO_ESTADO "projeto/smart-palafita/led/quarto/estado"

// ========================================================
// OBJETOS GLOBAIS
// ========================================================
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

// ========================================================
// ESTADOS DO SISTEMA (PROTEGIDOS POR MUTEX)
// ========================================================
volatile bool alertaLatched = false;
volatile bool alarmePausado = false;
volatile float distanciaAtual = -1.0;

// Controle do botão
int clickCount = 0;
unsigned long lastClickTime = 0;
const unsigned long CLICK_TIMEOUT = 1000;

// Estado das luzes por cômodo (para reportar ON/OFF e duração)
volatile bool salaIsOn = false;
volatile bool quartoIsOn = false;
unsigned long salaOnSince = 0;
unsigned long quartoOnSince = 0;

// Limite de disparo em cm
const float DISTANCIA_LIMITE_CM = 30.0;

// ========================================================
// PRIORIDADES DAS TAREFAS FREERTOS
// ========================================================
// Prioridade maior = número maior (0 a configMAX_PRIORITIES-1)
#define PRIORIDADE_ALTA    5
#define PRIORIDADE_NORMAL  3
#define PRIORIDADE_BAIXA   1

// Stack sizes (tamanho da pilha para cada tarefa em words)
#define STACK_SIZE_PEQUENO  2048
#define STACK_SIZE_MEDIO    4096
#define STACK_SIZE_GRANDE   8192

// ========================================================
// FUNÇÕES DE HARDWARE
// ========================================================
void ligarAlerta() {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE, LOW);
    ledcWrite(BUZZER_CHANNEL, 255);
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
        vTaskDelay(pdMS_TO_TICKS(beepMs));  // FreeRTOS delay
        ledcWrite(BUZZER_CHANNEL, 0);
        if (i < 2) vTaskDelay(pdMS_TO_TICKS(gapMs));
    }
}

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
        vTaskDelay(pdMS_TO_TICKS(500));  // FreeRTOS delay
    }

    Serial.println("\nWiFi conectado!");
    
    Serial.print("Aguardando IPv6... ");
    int tentativas = 0;
    IPv6Address ipv6;
    while (tentativas < 30) {
        ipv6 = WiFi.localIPv6();
        String ipv6Str = ipv6.toString();
        if (ipv6Str != "::" && ipv6Str != "0:0:0:0:0:0:0:0") {
            Serial.println("\n✓ IPv6 obtido!");
            Serial.print("IPv6: ");
            Serial.println(ipv6Str);
            return;
        }
        Serial.print(".");
        vTaskDelay(pdMS_TO_TICKS(1000));
        tentativas++;
    }
    
    Serial.println("\n✗ Timeout esperando IPv6");
}

// ========================================================
// MQTT
// ========================================================
void conectarMQTT() {
    while (!mqttClient.connected()) {
        Serial.print("Conectando ao MQTT via IPv6... ");

        String clientId = "ESP32-Smart-Palafita-";
        clientId += String(random(0xffff), HEX);

        IPv6Address ipv6Local = WiFi.localIPv6();
        Serial.print("IPv6 Local: ");
        Serial.println(ipv6Local.toString());
        
        mqttClient.setServer(MQTT_HOST, MQTT_PORT);
        
        if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
            Serial.println("Conectado ao MQTT via IPv6!");
            mqttClient.subscribe(TOPICO_CMD);
            mqttClient.subscribe(TOPICO_LED_SALA);
            mqttClient.subscribe(TOPICO_LED_QUARTO);
        } else {
            Serial.print("Falhou. rc=");
            Serial.println(mqttClient.state());
            vTaskDelay(pdMS_TO_TICKS(3000));
        }
    }
}

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

    // Proteger acesso às variáveis compartilhadas
    if (xSemaphoreTake(mutexEstado, pdMS_TO_TICKS(1000)) == pdTRUE) {
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
        xSemaphoreGive(mutexEstado);
    }
    
    if (t == TOPICO_LED_SALA) {
        uint8_t r, g, b;
        if (parseRGB(msg, r, g, b)) {
            setSalaColor(r, g, b);
            Serial.printf("LED SALA -> R:%d G:%d B:%d\n", r, g, b);
            // publicar estado ON/OFF e duração
            bool isOn = (r != 0 || g != 0 || b != 0);
            if (isOn && !salaIsOn) {
                salaIsOn = true;
                salaOnSince = millis();
                if (mqttClient.connected()) {
                    char buf[64];
                    // publicar ON com timestamp (ms desde boot)
                    snprintf(buf, sizeof(buf), "ON,%lu", (unsigned long)salaOnSince);
                    mqttClient.publish(TOPICO_LED_SALA_ESTADO, buf);
                }
            } else if (!isOn && salaIsOn) {
                // ficou OFF — calcular duração
                unsigned long now = millis();
                unsigned long dur = (salaOnSince > 0) ? (now - salaOnSince) : 0;
                salaIsOn = false;
                salaOnSince = 0;
                if (mqttClient.connected()) {
                    char buf[64];
                    snprintf(buf, sizeof(buf), "OFF,%lu", (unsigned long)dur);
                    mqttClient.publish(TOPICO_LED_SALA_ESTADO, buf);
                }
            }
        } else {
            Serial.println("Payload inválido para LED SALA (use R,G,B).");
        }
    }
    else if (t == TOPICO_LED_QUARTO) {
        uint8_t r, g, b;
        if (parseRGB(msg, r, g, b)) {
            setQuartoColor(r, g, b);
            Serial.printf("LED QUARTO -> R:%d G:%d B:%d\n", r, g, b);
            // publicar estado ON/OFF e duração
            bool isOn = (r != 0 || g != 0 || b != 0);
            if (isOn && !quartoIsOn) {
                quartoIsOn = true;
                quartoOnSince = millis();
                if (mqttClient.connected()) {
                    char buf[64];
                    snprintf(buf, sizeof(buf), "ON,%lu", (unsigned long)quartoOnSince);
                    mqttClient.publish(TOPICO_LED_QUARTO_ESTADO, buf);
                }
            } else if (!isOn && quartoIsOn) {
                unsigned long now = millis();
                unsigned long dur = (quartoOnSince > 0) ? (now - quartoOnSince) : 0;
                quartoIsOn = false;
                quartoOnSince = 0;
                if (mqttClient.connected()) {
                    char buf[64];
                    snprintf(buf, sizeof(buf), "OFF,%lu", (unsigned long)dur);
                    mqttClient.publish(TOPICO_LED_QUARTO_ESTADO, buf);
                }
            }
        } else {
            Serial.println("Payload inválido para LED QUARTO (use R,G,B).");
        }
    }
}

// ========================================================
// TAREFA 1: LEITURA DO SENSOR ULTRASSÔNICO
// ========================================================
// Esta tarefa é responsável por ler o sensor e atualizar
// o estado do alarme baseado na distância medida
void taskSensorUltrassonico(void *parameter) {
    Serial.println("[FreeRTOS] Task Sensor Ultrassônico iniciada");
    
    const TickType_t periodo = pdMS_TO_TICKS(300); // Executa a cada 300ms
    
    for (;;) {  // Loop infinito da tarefa
        // Ler distância
        float distancia = medirDistanciaCm();
        
        // Atualizar distância compartilhada (com proteção)
        if (xSemaphoreTake(mutexDistancia, pdMS_TO_TICKS(100)) == pdTRUE) {
            distanciaAtual = distancia;
            xSemaphoreGive(mutexDistancia);
        }
        
        // Exibir leitura no Serial
        Serial.print("[Sensor] Distância: ");
        if (distancia < 0) {
            Serial.println("sem leitura (fora de alcance)");
        } else {
            Serial.print(distancia);
            Serial.println(" cm");
        }
        
        // Verificar se deve ativar alerta (com proteção do mutex)
        if (xSemaphoreTake(mutexEstado, pdMS_TO_TICKS(100)) == pdTRUE) {
            bool pausado = alarmePausado;
            bool alerta = alertaLatched;
            
            if (!pausado && !alerta) {
                // Verificar se objeto muito próximo
                if (distancia > 0 && distancia <= DISTANCIA_LIMITE_CM) {
                    alertaLatched = true;
                    ligarAlerta();
                    mqttClient.publish(TOPICO_ESTADO, "ALERTA");
                    Serial.println("[Sensor] Alerta ativado por distância!");
                } else {
                    desligarAlerta();
                    mqttClient.publish(TOPICO_ESTADO, "OK");
                }
            }
            
            xSemaphoreGive(mutexEstado);
        }
        
        // Publicar medida no MQTT
        if (mqttClient.connected()) {
            char msg[16];
            if (distancia < 0) {
                snprintf(msg, sizeof(msg), "NA");
            } else {
                snprintf(msg, sizeof(msg), "%.1f", distancia);
            }
            mqttClient.publish(TOPICO_SENSOR, msg);
        }
        
        // Aguardar próximo ciclo (FreeRTOS delay - não bloqueia outras tarefas)
        vTaskDelay(periodo);
    }
}

// ========================================================
// TAREFA 2: LEITURA DO BOTÃO
// ========================================================
// Esta tarefa monitora o botão e detecta cliques simples
// e múltiplos cliques para controlar o alarme
void taskBotao(void *parameter) {
    Serial.println("[FreeRTOS] Task Botão iniciada");
    
    const TickType_t periodo = pdMS_TO_TICKS(50); // Verifica a cada 50ms
    
    for (;;) {
        int leituraBotao = digitalRead(BUTTON_PIN);
        unsigned long tempoAtual = xTaskGetTickCount() * portTICK_PERIOD_MS;
        
        if (leituraBotao == HIGH) {
            // Proteger acesso às variáveis compartilhadas
            if (xSemaphoreTake(mutexEstado, pdMS_TO_TICKS(100)) == pdTRUE) {
                bool pausado = alarmePausado;
                
                if (tempoAtual - lastClickTime > CLICK_TIMEOUT) {
                    clickCount = 1;
                    lastClickTime = tempoAtual;
                    
                    if (!pausado) {
                        alertaLatched = false;
                        desligarAlerta();
                        if (mqttClient.connected()) {
                            mqttClient.publish(TOPICO_ESTADO, "OK");
                        }
                        Serial.println("[Botão] Alarme parado por um clique");
                    }
                } else {
                    clickCount++;
                    lastClickTime = tempoAtual;
                    
                    Serial.print("[Botão] Cliques rápidos: ");
                    Serial.println(clickCount);
                    
                    if (clickCount >= 10) {
                        alarmePausado = !alarmePausado;
                        clickCount = 0;
                        
                        if (alarmePausado) {
                            Serial.println("[Botão] Alarme PAUSADO");
                            alertaLatched = false;
                            beepTriple();
                            mostrarAlarmePausado();
                            if (mqttClient.connected()) {
                                mqttClient.publish(TOPICO_ESTADO, "PAUSADO");
                            }
                        } else {
                            Serial.println("[Botão] Alarme RETOMADO");
                            beepTriple();
                            if (mqttClient.connected()) {
                                mqttClient.publish(TOPICO_ESTADO, "OK");
                            }
                        }
                    }
                }
                
                xSemaphoreGive(mutexEstado);
            }
        }
        
        // Reset contador de cliques após timeout
        if (tempoAtual - lastClickTime > CLICK_TIMEOUT * 2 && clickCount > 0) {
            clickCount = 0;
        }
        
        vTaskDelay(periodo);
    }
}

// ========================================================
// TAREFA 3: COMUNICAÇÃO MQTT
// ========================================================
// Esta tarefa mantém a conexão MQTT ativa e processa
// mensagens recebidas
void taskMQTT(void *parameter) {
    Serial.println("[FreeRTOS] Task MQTT iniciada");
    
    // Conectar inicialmente
    conectarMQTT();
    
    const TickType_t periodo = pdMS_TO_TICKS(100); // Loop MQTT a cada 100ms
    
    for (;;) {
        // Reconectar se necessário
        if (!mqttClient.connected()) {
            conectarMQTT();
        }
        
        // Processar mensagens MQTT
        mqttClient.loop();
        
        vTaskDelay(periodo);
    }
}

// ========================================================
// TAREFA 4: CONTROLE DE LED E BUZZER (BLINK)
// ========================================================
// Esta tarefa controla o piscar do LED vermelho e
// o som do buzzer quando o alerta está ativo
void taskLedBuzzer(void *parameter) {
    Serial.println("[FreeRTOS] Task LED/Buzzer iniciada");
    
    const TickType_t periodoBlink = pdMS_TO_TICKS(100); // Blink a cada 100ms
    TickType_t ultimoBlink = 0;
    bool blinkState = false;
    
    for (;;) {
        TickType_t tempoAtual = xTaskGetTickCount();
        
        // Proteger acesso ao estado
        if (xSemaphoreTake(mutexEstado, pdMS_TO_TICKS(100)) == pdTRUE) {
            bool pausado = alarmePausado;
            bool alerta = alertaLatched;
            
            if (pausado) {
                mostrarAlarmePausado();
                blinkState = false;
            } else if (alerta) {
                // Piscar LED vermelho durante alerta
                if (tempoAtual - ultimoBlink >= pdMS_TO_TICKS(100)) {
                    blinkState = !blinkState;
                    digitalWrite(LED_RED, blinkState ? HIGH : LOW);
                    digitalWrite(LED_GREEN, LOW);
                    digitalWrite(LED_BLUE, LOW);
                    ultimoBlink = tempoAtual;
                }
                // Manter buzzer ativo
                ledcWrite(BUZZER_CHANNEL, 128);
                
                // Publicar estado de alerta periodicamente
                if (mqttClient.connected()) {
                    mqttClient.publish(TOPICO_ESTADO, "ALERTA");
                }
            } else {
                desligarAlerta();
                blinkState = false;
            }
            
            xSemaphoreGive(mutexEstado);
        }
        
        vTaskDelay(pdMS_TO_TICKS(50)); // Verifica a cada 50ms
    }
}

// ========================================================
// SETUP
// ========================================================
void setup() {
    Serial.begin(115200);
    delay(1500);
    
    Serial.println("\n===========================================");
    Serial.println("  SISTEMA HOME ALARM COM FreeRTOS");
    Serial.println("===========================================\n");

    // Configuração de pinos
    pinMode(LED_RED, OUTPUT);
    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_BLUE, OUTPUT);
    pinMode(BUTTON_PIN, INPUT);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    
    pinMode(LED_SALA_R, OUTPUT);
    pinMode(LED_SALA_G, OUTPUT);
    pinMode(LED_SALA_B, OUTPUT);
    pinMode(LED_QUARTO_R, OUTPUT);
    pinMode(LED_QUARTO_G, OUTPUT);
    pinMode(LED_QUARTO_B, OUTPUT);

    // Configuração PWM do buzzer
    ledcSetup(BUZZER_CHANNEL, BUZZER_FREQ, BUZZER_RES);
    ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
    ledcWrite(BUZZER_CHANNEL, 0);

    // Configuração PWM LEDs sala
    ledcSetup(LED_SALA_R_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_SALA_G_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_SALA_B_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcAttachPin(LED_SALA_R, LED_SALA_R_CH);
    ledcAttachPin(LED_SALA_G, LED_SALA_G_CH);
    ledcAttachPin(LED_SALA_B, LED_SALA_B_CH);
    setSalaColor(0, 0, 0);

    // Configuração PWM LEDs quarto
    ledcSetup(LED_QUARTO_R_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_QUARTO_G_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcSetup(LED_QUARTO_B_CH, LED_PWM_FREQ, LED_PWM_RES);
    ledcAttachPin(LED_QUARTO_R, LED_QUARTO_R_CH);
    ledcAttachPin(LED_QUARTO_G, LED_QUARTO_G_CH);
    ledcAttachPin(LED_QUARTO_B, LED_QUARTO_B_CH);
    setQuartoColor(0, 0, 0);

    // TLS sem verificação de certificado (didático)
    secureClient.setInsecure();

    // Conectar WiFi (antes de criar tarefas que precisam de rede)
    conectarWiFi();
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);

    // ========================================================
    // INICIALIZAR FREERTOS - CRIAÇÃO DE MUTEXES
    // ========================================================
    Serial.println("\n[FreeRTOS] Criando recursos de sincronização...");
    
    mutexEstado = xSemaphoreCreateMutex();
    mutexDistancia = xSemaphoreCreateMutex();
    
    if (mutexEstado == NULL || mutexDistancia == NULL) {
        Serial.println("[FreeRTOS] ERRO: Falha ao criar mutexes!");
        while(1) delay(1000); // Travar se falhar
    }
    
    Serial.println("[FreeRTOS] Mutexes criados com sucesso!");

    // ========================================================
    // CRIAR TAREFAS DO FREERTOS
    // ========================================================
    Serial.println("\n[FreeRTOS] Criando tarefas...");
    
    // Task 1: Sensor Ultrassônico (prioridade normal)
    xTaskCreate(
        taskSensorUltrassonico,      // Função da tarefa
        "TaskSensor",                // Nome da tarefa (para debug)
        STACK_SIZE_MEDIO,            // Tamanho da pilha
        NULL,                        // Parâmetros
        PRIORIDADE_NORMAL,           // Prioridade
        NULL                         // Handle da tarefa (opcional)
    );
    
    // Task 2: Botão (prioridade normal)
    xTaskCreate(
        taskBotao,
        "TaskBotao",
        STACK_SIZE_PEQUENO,
        NULL,
        PRIORIDADE_NORMAL,
        NULL
    );
    
    // Task 3: MQTT (prioridade normal)
    xTaskCreate(
        taskMQTT,
        "TaskMQTT",
        STACK_SIZE_GRANDE,  // MQTT precisa de mais stack
        NULL,
        PRIORIDADE_NORMAL,
        NULL
    );
    
    // Task 4: LED/Buzzer (prioridade normal)
    xTaskCreate(
        taskLedBuzzer,
        "TaskLED",
        STACK_SIZE_PEQUENO,
        NULL,
        PRIORIDADE_NORMAL,
        NULL
    );
    
    Serial.println("Todas as tarefas criadas!");
    Serial.println("  - Task Sensor Ultrassônico");
    Serial.println("  - Task Botão");
    Serial.println("  - Task MQTT");
    Serial.println("  - Task LED/Buzzer");
    Serial.println("\n===========================================");
    Serial.println("  Sistema iniciado!");
    Serial.println("===========================================\n");
    
    // Estado inicial
    desligarAlerta();
}

// ========================================================
// LOOP PRINCIPAL
// ========================================================
void loop() {
    static unsigned long ultimoDebug = 0;
    unsigned long agora = millis();
    
    if (agora - ultimoDebug > 30000) { 
        ultimoDebug = agora;
        
        Serial.println("\n[Debug] Status do sistema:");
        Serial.print("  Heap livre: ");
        Serial.print(ESP.getFreeHeap());
        Serial.println(" bytes");
        Serial.print("  Tarefas ativas: ");
        Serial.println(uxTaskGetNumberOfTasks());
        
        if (xSemaphoreTake(mutexEstado, pdMS_TO_TICKS(500)) == pdTRUE) {
            Serial.print("  Estado alarme: ");
            Serial.println(alarmePausado ? "PAUSADO" : (alertaLatched ? "ALERTA" : "OK"));
            xSemaphoreGive(mutexEstado);
        }
    }
    
    vTaskDelay(pdMS_TO_TICKS(1000));
}