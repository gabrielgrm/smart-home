# 🏠 Smart Palafita - Sistema de Automação Residencial com IoT

Um sistema inteligente de automação residencial baseado em **ESP32**, **MQTT** e **Next.js** que monitora e controla luzes, alarmes de segurança e envia alertas por email em tempo real.

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Características](#características)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Endpoints](#api-endpoints)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

**Smart Palafita** é um sistema de automação residencial que integra:

- **Hardware**: ESP32 com sensores de distância ultrassônico
- **IoT**: Protocolo MQTT para comunicação em tempo real
- **Frontend**: Dashboard Next.js responsivo com tema escuro
- **Alertas**: Sistema de email automático via Resend
- **Funcionalidades**:
  - ✅ Controle de LEDs RGB por cômodo
  - ✅ Alarme de segurança com detecção de movimento
  - ✅ Alertas de sustentabilidade (tempo de uso de luzes)
  - ✅ Persistência de estado através de localStorage
  - ✅ Interface responsiva (Desktop/Mobile)

## ✨ Características

### Controle de Iluminação
- 🎨 **Color Picker**: Selecione cores RGB para cada cômodo
- ⏱️ **Timeout Automático**: Alerta após 10 segundos de uso contínuo
- 💾 **Persistência**: Estado mantido entre navegações
- 📊 **Monitoramento**: Tempo real de uso das luzes

### Segurança
- 🚨 **Alarme de Movimento**: Sensor ultrassônico detecta intrusões
- 🔔 **Alertas Email**: Notificações imediatas
- ⏸️ **Pausa/Retomada**: Controle do estado do alarme
- 📍 **Status em Tempo Real**: Monitoramento contínuo

### Sustentabilidade
- 🌱 **Alertas de Uso**: Notificações quando luz fica ligada muito tempo
- 📧 **Relatórios por Email**: Detalhes completos de consumo
- 🎯 **Metas**: Redução de consumo de energia

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   Smart Palafita                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   ESP32      │────────▶│ HiveMQ Cloud │              │
│  │  + Sensores  │◀────────│   (MQTT)     │              │
│  └──────────────┘         └──────────────┘              │
│         △                         △                      │
│         │                         │                      │
│         └─────────────┬───────────┘                      │
│                       │                                  │
│                 ┌─────▼──────┐                           │
│                 │  Next.js    │                           │
│                 │  Dashboard  │                           │
│                 │  (Vercel)   │                           │
│                 └─────┬──────┘                           │
│                       │                                  │
│         ┌─────────────┴─────────────┐                    │
│         │                           │                    │
│    ┌────▼─────┐             ┌──────▼──────┐             │
│    │ LocalStore│             │  Resend API │             │
│    │ (State)   │             │  (Email)    │             │
│    └───────────┘             └─────────────┘             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## 📦 Requisitos

### Hardware
- **ESP32**: Microcontrolador com suporte WiFi/Bluetooth
- **Sensor Ultrassônico HC-SR04**: Para detecção de movimento
- **LEDs RGB WS2812B** (ou similar): Para iluminação controlada
- **Cabo USB**: Para programação e alimentação

### Software - Firmware (ESP32)
- PlatformIO IDE
- Bibliotecas:
  - `PubSubClient` - Cliente MQTT
  - `AsyncTCP` - Comunicação assíncrona
  - `ESPAsyncWebServer` - Servidor web
  - `Adafruit NeoPixel` - Controle de LEDs RGB

### Software - Frontend
- **Node.js**: v20.x ou superior
- **npm**: v10.x ou superior
- **Navegador moderno**: Chrome, Firefox, Safari, Edge

### Serviços Online
- **HiveMQ Cloud**: Broker MQTT gerenciado
- **Resend**: Serviço de envio de emails
- **Vercel**: Hospedagem do frontend

## 🚀 Instalação

### 1️⃣ Clonar o Repositório

```bash
git clone https://github.com/gabrielgrm/iot-home-alarm.git
cd iot-home-alarm
```

### 2️⃣ Configurar o Firmware (ESP32)

```bash
cd iot-home-alarm

# Instalar dependências
pio lib install

# Configurar SSID e senha WiFi em src/main.cpp
# Configurar credenciais MQTT em src/main.cpp

# Compilar e fazer upload
pio run --target upload

# Monitorar output
pio device monitor --baud 115200
```

### 3️⃣ Configurar o Frontend

```bash
cd iot-home-alarm-front/smartlight-dashboard

# Instalar dependências
npm install

# Criar arquivo de ambiente
cp .env.example .env.local

# Preencheer variáveis de ambiente
```

### 4️⃣ Executar Localmente

```bash
# Desenvolvimento
npm run dev

# Produção (local)
npm run build
npm start

# Acesse http://localhost:3000
```

### 5️⃣ Deploy no Vercel

```bash
# Instalar CLI do Vercel
npm install -g vercel

# Deploy
vercel --prod

# Configure Environment Variables no dashboard do Vercel
```

## ⚙️ Configuração

### Configuração do ESP32

Edite `src/main.cpp`:

```cpp
// WiFi
const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA";

// MQTT
const char* mqtt_server = "*****************************.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "seu_usuario";
const char* mqtt_pass = "sua_senha";

// Tópicos MQTT
#define TOPICO_LED_SALA "projeto/smart-palafita/led/sala/comando"
#define TOPICO_LED_QUARTO "projeto/smart-palafita/led/quarto/comando"
#define TOPICO_DISTANCIA "projeto/smart-palafita/sensor/medida"
#define TOPICO_ESTADO "projeto/smart-palafita/sensor/estado"
#define TOPICO_CMD "projeto/smart-palafita/comandos"
```

### Configuração do HiveMQ Cloud

1. Acesse https://www.hivemq.cloud/
2. Crie um cluster gratuito
3. Anote a URL e credenciais
4. Configure no ESP32 e Frontend

### Configuração do Resend

1. Acesse https://resend.com
2. Crie uma conta
3. Copie sua API Key
4. Configure em `.env.local`:

```env
RESEND_API_KEY=re_seu_token_aqui
ALERT_EMAIL=seu_email@example.com
```

### Configuração do Vercel

1. Acesse https://vercel.com/dashboard
2. Acesse projeto "smartlight-dashboard"
3. Settings → Environment Variables
4. Adicione:
   - `RESEND_API_KEY`: Sua chave Resend
   - `ALERT_EMAIL`: Email para receber alertas
5. Selecione todos os ambientes (Production, Preview, Development)

## 📱 Uso

### Dashboard - Página de Luzes (`/leds`)

```typescript
// Interface de controle
- Seletor de Cômodo (Sala / Quarto)
- Color Picker para cores RGB
- Botão "Aplicar Cor" - Liga a luz
- Botão "Desligar" - Desliga a luz
- Contador de tempo em tempo real
```

**Fluxo:**
1. Selecione o cômodo
2. Escolha uma cor no color picker
3. Clique "Aplicar Cor"
4. O contador iniciará (10 segundos)
5. Após 10 segundos, email automático é enviado
6. Clique "Desligar" para interromper

### Dashboard - Página de Alarme (`/alarme`)

```typescript
// Interface de controle
- Status de conexão MQTT
- Distância do sensor (cm)
- Estado do alarme (NORMAL / ALERTA)
- Botão "Parar Alarme" - Desativa o alarme
- Botão "Pausar/Retomar" - Pausa temporariamente
```

**Fluxo:**
1. Alarme monitora sensor ultrassônico
2. Ao detectar movimento (< 50cm), entra em ALERTA
3. Email automático é enviado após 30 segundos
4. Clique "Parar Alarme" para desativar

### Persistência de Estado

O sistema salva automaticamente:

```javascript
// localStorage keys
- salaLightStartTime: timestamp quando luz ligou
- quartoLightStartTime: timestamp quando luz ligou
- salaLightEmailed: flag se email foi enviado
- quartoLightEmailed: flag se email foi enviado
```

**Comportamento:**
- Navegar para outra página: timer continua rodando
- Recarregar a página: timer retoma do ponto onde parou
- Fechar o navegador: estado é restaurado na próxima abertura

## 📡 API Endpoints

### POST `/api/alerta/email`

Envia email de alerta de luz.

**Request:**
```json
{
  "message": "Detectamos que a luz está ligada há 15 s...",
  "comodo": "sala"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de luz enviado com sucesso",
  "id": "email-id-123"
}
```

**Cômodos suportados:**
- `sala`: Cor azul (#1d4ed8)
- `quarto`: Cor azul (#1d4ed8)

---

### POST `/api/alerta/alarme`

Envia email de alerta de segurança.

**Request:**
```json
{
  "message": "O alarme foi ativado! Verifique imediatamente..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de alarme enviado com sucesso",
  "id": "email-id-456"
}
```

---

### POST `/api/lookup`

Endpoint para verificar status do sistema.

**Response:**
```json
{
  "status": "ok",
  "services": {
    "mqtt": "connected",
    "email": "configured"
  }
}
```

---

## 🌍 Tópicos MQTT

| Tópico | Direção | Descrição | Formato |
|--------|---------|-----------|---------|
| `projeto/smart-palafita/led/sala/comando` | ESP32 ← | Comando para LED da sala | `{"r":255,"g":100,"b":50}` |
| `projeto/smart-palafita/led/quarto/comando` | ESP32 ← | Comando para LED do quarto | `{"r":255,"g":100,"b":50}` |
| `projeto/smart-palafita/led/sala/estado` | ESP32 → | Estado do LED da sala | `ON` ou `OFF` |
| `projeto/smart-palafita/led/quarto/estado` | ESP32 → | Estado do LED do quarto | `ON` ou `OFF` |
| `projeto/smart-palafita/sensor/medida` | ESP32 → | Distância ultrassônica (cm) | `25.5` |
| `projeto/smart-palafita/sensor/estado` | ESP32 → | Estado do alarme | `NORMAL`, `ALERTA`, `PAUSADO` |
| `projeto/smart-palafita/comandos` | ESP32 ← | Comandos globais | `STOP`, `PAUSE`, `RESUME` |

## 📊 Estrutura do Projeto

```
iot-home-alarm/
├── docs/                        # Documentação do projeto
├── esp32-esp8266/               # Firmware para ESP32/ESP8266 (PlatformIO)
│   ├── platformio.ini           # Configuração PlatformIO
│   ├── include/                 # Headers e arquivos de configuração
│   │   └── config.h
│   ├── lib/                     # Bibliotecas do firmware
│   ├── src/                     # Código-fonte do firmware
│   │   └── main.cpp
│   └── test/                    # Testes do firmware
├── next-js/
│   └── smartlight-dashboard/    # Frontend Next.js (dashboard)
│       ├── app/
│       │   ├── globals.css
  │   ├── layout.tsx       # Layout principal
  │   ├── page.tsx         # Página principal
  │   ├── alarme/
  │   │   └── page.tsx     # Página de alarme
  │   ├── leds/
  │   │   └── page.tsx     # Página de controle de LEDs
  │   └── api/             # Rotas API (Next.js)
  │       └── alerta/
  │           ├── alarme/
  │           │   └── route.ts
  │           └── email/
  │               └── route.ts
  ├── public/               # Assets estáticos
  ├── package.json          # Dependências do frontend
  ├── next.config.ts        # Configuração Next.js
  ├── tsconfig.json         # TypeScript config
  └── README.md             # Informações do dashboard
├── platformio.ini               # (pode existir no firmware) Configuração PlatformIO principal
└── README.md                    # Este arquivo
```