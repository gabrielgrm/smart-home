# Home Alarm Guardian 🔒🚨  
### Sistema IoT de Monitoramento e Alarme Residencial

Este projeto apresenta o **Home Alarm Guardian**, um sistema IoT completo para segurança residencial utilizando **ESP32**, **MQTT via HiveMQ Cloud**, **Dashboard Web em Next.js** para controle remoto em tempo real e **envio de alertas SMS via Twilio**.  
Foi desenvolvido como parte da disciplina **Sistemas Embarcados – CESAR School**.

---

# 1. Objetivo do Projeto 🎯

O objetivo é implementar um sistema IoT profissional de monitoramento e alarme residencial com os seguintes requisitos:

- **Captura de dados** via sensor LDR no ESP32.  
- **Comunicação via Wi-Fi + MQTT (TLS)** com o broker HiveMQ Cloud.  
- **Dashboard Web** para visualização e controle remoto do sistema (STOP/PAUSE/RESUME).  
- **LED RGB + buzzer** representam visualmente e sonoramente o estado do sistema.  
- **Lógica avançada de alarme travado (latched)** que só desarma mediante ação humana.  
- **Envio de SMS automático** via Twilio quando o alerta permanece ativo por um tempo prolongado.  
- Abordagem modular, escalável e ideal para aplicações reais de automação e segurança.

---

# 2. Arquitetura Geral do Sistema 🧠

A solução é dividida em quatro camadas:

## 🔹 1. ESP32 – Dispositivo Físico
- Leitura contínua do sensor LDR (0 a 4095).  
- Controle dos atuadores: LED RGB + Buzzer.  
- Conexão Wi-Fi e envio de dados via MQTT.  
- Lógica de estado do alarme (OK, ALERTA, PAUSADO).  
- Processamento de comandos remotos via MQTT.  
- Requisição HTTPS com autenticação básica para Twilio.

## 🔹 2. Broker MQTT (HiveMQ Cloud)
- Middleware responsável pela comunicação em tempo real.  
- Autenticação com usuário/senha.  
- Conexões seguras através de **MQTTS na porta 8883**.  
- Tópicos separados para publicar dados e receber comandos.

## 🔹 3. Dashboard Web (Next.js)
- Interface visual moderna e intuitiva.  
- Atualização de estado em tempo real.  
- Envio de comandos (STOP/PAUSE/RESUME).  
- Destaque visual quando o sistema entra em ALERTA (sirenes piscando).

## 🔹 4. Serviço de SMS (Twilio)
- API REST utilizada pelo ESP32.  
- Envio de SMS para o número de emergência após 10s de alerta ativo.  
- Comunicação via HTTPS utilizando WiFiClientSecure.

---

# 3. Funcionalidades Implementadas ⚙️

## 3.1. Lógica do Alarme

A lógica central funciona em três estados:

### 🟢 Estado **OK**
- LED verde aceso.  
- Buzzer desligado.  
- Sistema operando normalmente.

### 🔴 Estado **ALERTA**
- Ativado quando o LDR lê **4095**.  
- LED vermelho aceso ou piscando.  
- Buzzer ligado via PWM.  
- Sistema trava em alerta (**alertaLatched = true**).  
- Só pode ser desarmado manualmente ou via MQTT.  
- Após 10 segundos em alerta:
  - Envia SMS via Twilio.

### 🔵 Estado **PAUSADO**
- Ativado por multi-cliques no botão físico (6 cliques).  
- LED azul aceso.  
- Buzzer desligado.  
- Sistema ignora leitura do LDR.  
- Pode ser reativado por novos multi-cliques ou via MQTT.

---

## 3.2. LED RGB + Buzzer (Atuadores)

| Estado      | LED RGB | Buzzer | Descrição |
|-------------|---------|--------|-----------|
| OK          | Verde   | OFF    | Monitoramento normal |
| ALERTA      | Vermelho (fixo ou piscando) | ON | Intrusão detectada |
| PAUSADO     | Azul    | OFF    | Sistema suspenso |

**Pinos utilizados:**

| Atuador | Pino ESP32 |
|---------|------------|
| LED Vermelho | 18 |
| LED Verde | 4 |
| LED Azul | 27 |
| Buzzer | 23 (PWM canal 0) |

---

## 3.3. Botão Físico (Pino 19)

### 🔘 Clique simples
- Desarma alerta.  
- Sai do modo pausado.  
- Retorna tudo ao estado **OK**.

### 🔘 Multiclique (≥ 6 cliques em 1 segundo)
Alterna o modo **PAUSADO**:
- Entra no modo PAUSADO → LED azul.  
- Sai do modo PAUSADO → volta para OK.  

---

## 3.4. Comandos via MQTT

O ESP32 assina o tópico:

`projeto/guardian/comandos`

E aceita três comandos:

### 🔹 "STOP"
- Desativa alerta.  
- Sai do modo pausado.  
- LED verde.  
- Publica **"OK"**.

### 🔹 "PAUSE"
- Entra no modo pausado.  
- LED azul e buzzer off.  
- Publica **"PAUSADO"**.

### 🔹 "RESUME"
- Sai do modo pausado.  
- Volta para OK.  
- Publica **"OK"**.

---

## 3.5. Envio de SMS (Twilio)

O SMS é enviado quando:

1. ALERTA foi ativado.  
2. 10 segundos se passaram.  
3. O alarme continua travado.  
4. NÃO está pausado.  
5. Nenhum SMS foi enviado ainda para este alerta.

O conteúdo do SMS:

> "Alerta ativado no Guardian!"

A requisição HTTPS POST é enviada para:

`https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`

Com autenticação:

- `TWILIO_ACCOUNT_SID`  
- `TWILIO_AUTH_TOKEN`

---

# 4. Tópicos MQTT Utilizados 📨

## Publicações (ESP32 → Dashboard)
| Tópico | Payload | Descrição |
|--------|---------|-----------|
| projeto/guardian/sensor/ldr | "0" a "4095" | Medição do sensor |
| projeto/guardian/sensor/estado | "OK" / "ALERTA" / "PAUSADO" | Estado atual |

## Assinatura (Dashboard → ESP32)
| Tópico | Comandos |
|--------|----------|
| projeto/guardian/comandos | STOP, PAUSE, RESUME |

---

# 5. Estrutura do Projeto 📁

```text
home-alarm-guardian/
├── README.md
├── platformio.ini
├── esp32-esp8266/
│   ├── src/main.cpp
│   └── include/config.h
├── web-dashboard/
│   ├── package.json
│   └── app/page.tsx
├── docs/
│   ├── Relatorio_HomeAlarmGuardian.pdf
│   └── imagens/
└── schematics/
    └── home_alarm_guardian.fzz
```

# 6. `config.h` (Modelo) 🔐

```cpp
#define WIFI_SSID   "SeuSSID"
#define WIFI_PASS   "SenhaWiFi"

#define MQTT_HOST   "abc140925c0d4acea7acf98b911c0419.s1.eu.hivemq.cloud"
#define MQTT_PORT   8883
#define MQTT_USER   "admin"
#define MQTT_PASS   "Teste@123"

#define TWILIO_ACCOUNT_SID "ACxxxxxxxxxxxxxxxx"
#define TWILIO_AUTH_TOKEN  "xxxxxxxxxxxxxxxx"
#define TWILIO_FROM_NUMBER "+1xxxxxxxxxx"
#define ALERT_SMS_TO_NUMBER "+55xxxxxxxxxx"
```

# 7. Como Rodar o Firmware (ESP32) 🧪

Instale o PlatformIO no VSCode.

Clone o repositório:

```cpp
git clone https://github.com/seu-usuario/home-alarm-guardian.git
```
Crie o arquivo:
```cpp
.../include/config.h
```
Preencha as credenciais (Wi-Fi, MQTT, Twilio).

Conecte o ESP32 via USB.

Faça upload:
VSCode → PlatformIO → Upload

Abra o Serial Monitor:
baud: 115200

# 8. Como Rodar o Dashboard (Next.js) 🌐

Entre no diretório:

cd smartlight-dashboard

Instale dependências:

```cpp
npm install
```
Execute o modo desenvolvimento:
```cpp
npm run dev
```
Acesse no navegador:
```cpp
http://localhost:3000
```
## Funcionalidades do Dashboard

Exibir o valor atual do LDR em tempo real 🔆

Mostrar o estado do sistema (OK / ALERTA / PAUSADO)

Botão STOP para desarmar o alarme

Botão PAUSE / RESUME

Tela com sirenes piscando quando estiver em ALERTA 🚨

# 9. Possíveis Melhorias Futuras 🚀

Histórico completo de eventos (Supabase / MongoDB)

Notificações Push via Firebase (FCM)

Validação completa de certificado TLS no ESP32

Suporte a sensores adicionais (PIR, magnético, temperatura)

Modo NOTURNO com sensibilidade configurável

Integração com assistentes virtuais (Alexa / Google Home)

# 10. Integrantes 👥

Gabriel Rodrigues, João Marcelo, Arthur Freire
