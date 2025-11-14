"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

const MQTT_URL = "wss://abc140925c0d4acea7acf98b911c0419.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "admin";
const MQTT_PASS = "Teste@123";

const TOPICO_LDR = "projeto/guardian/sensor/ldr";
const TOPICO_ESTADO = "projeto/guardian/sensor/estado";
const TOPICO_CMD = "projeto/guardian/comandos";

export default function Home() {
  const [ldr, setLdr] = useState<string>("--");
  const [estado, setEstado] = useState<string>("--");
  const [connected, setConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartRef = useRef<number>(0);

  // conecta no MQTT
  useEffect(() => {
    if (typeof window === "undefined") return;

    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      reconnectPeriod: 3000,
      clean: true,
    });

    clientRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      client.subscribe([TOPICO_LDR, TOPICO_ESTADO]);
    });

    client.on("reconnect", () => setConnected(false));
    client.on("close", () => setConnected(false));

    client.on("message", (topic, payload) => {
      const msg = payload.toString();
      if (topic === TOPICO_LDR) {
        setLdr(msg);
      } else if (topic === TOPICO_ESTADO) {
        setEstado(msg);
        setIsPaused(msg === "PAUSADO");
      }
    });

    return () => {
      client.end(true);
    };
  }, []);

  function publishCommand(cmd: "STOP" | "PAUSE" | "RESUME") {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    client.publish(TOPICO_CMD, cmd);
  }

  // clique simples: desativar alarme
  function handleStopClick() {
    publishCommand("STOP");
  }

  // segurar botão: pausar / retomar
  function handlePauseMouseDown() {
    pressStartRef.current = Date.now();
    pressTimerRef.current = setTimeout(() => {
      const novoEstadoPause = !isPaused;
      publishCommand(novoEstadoPause ? "PAUSE" : "RESUME");
    }, 1000); // segurar 1s
  }

  function handlePauseMouseUp() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  const isAlert = estado === "ALERTA";
  const isOk = estado === "OK";
  const [lookupPhone, setLookupPhone] = useState<string>("+5581998781729");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, #020617, #0b1220)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "2fr 1.5fr",
          gap: 24,
          color: "#e5e7eb",
        }}
      >
        {/* CENA DA CASA */}
        <div
          style={{
            position: "relative",
            background: "radial-gradient(circle at top, #1d4ed822, #020617)",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Céu */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top, #1e3a8a55, transparent 55%)",
              pointerEvents: "none",
            }}
          />

          {/* Casa */}
          <div
            style={{
              position: "relative",
              marginTop: 40,
              width: "100%",
              height: 260,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            {/* Corpo da casa */}
            <div
              style={{
                position: "relative",
                width: 260,
                height: 170,
                background: "#020617",
                borderRadius: 20,
                border: "2px solid #1f2937",
                boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                overflow: "hidden",
              }}
            >
              {/* Janela com cor dependendo do estado */}
              <div
                style={{
                  position: "absolute",
                  left: 40,
                  top: 40,
                  width: 70,
                  height: 70,
                  borderRadius: 16,
                  border: "2px solid #111827",
                  background: isAlert
                    ? "radial-gradient(circle, #f97373, #7f1d1d)"
                    : isOk
                    ? "radial-gradient(circle, #bbf7d0, #15803d)"
                    : "radial-gradient(circle, #facc1544, #854d0e)",
                  boxShadow: isAlert
                    ? "0 0 25px rgba(248, 113, 113, 0.9)"
                    : isOk
                    ? "0 0 18px rgba(74, 222, 128, 0.8)"
                    : "0 0 14px rgba(250, 204, 21, 0.6)",
                  transition: "all 0.25s ease",
                }}
              />

              {/* Porta */}
              <div
                style={{
                  position: "absolute",
                  right: 40,
                  bottom: 0,
                  width: 60,
                  height: 100,
                  borderRadius: "16px 16px 0 0",
                  background: "#020617",
                  border: "2px solid #111827",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    background: "#e5e7eb33",
                    marginTop: 48,
                    marginLeft: 12,
                  }}
                />
              </div>
            </div>

            {/* Telhado */}
            <div
              style={{
                position: "absolute",
                bottom: 160,
                width: 260,
                height: 110,
                clipPath: "polygon(50% 0%, 100% 60%, 0% 60%)",
                background:
                  "linear-gradient(to right, #111827, #020617, #111827)",
                borderBottom: "2px solid #1f2937",
              }}
            />
          </div>

          {/* Sirenes de polícia piscando */}
          {isAlert && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 16,
                pointerEvents: "none",
              }}
            >
              <div className="siren siren-red">🚨</div>
              <div className="siren siren-blue">🚨</div>
            </div>
          )}

          {/* LDR e estado em texto dentro da cena */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 24,
              right: 24,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#9ca3af",
            }}
          >
            <span>LDR: {ldr}</span>
            <span>Estado: {estado}</span>
          </div>
        </div>

        {/* PAINEL DE CONTROLE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 16,
              background: "#020617",
              border: "1px solid #1f2937",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Conexão
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "999px",
                  background: connected ? "#22c55e" : "#ef4444",
                  boxShadow: connected
                    ? "0 0 10px #22c55eaa"
                    : "0 0 10px #ef4444aa",
                }}
              />
              <span style={{ fontSize: 15 }}>
                {connected ? "Conectado ao HiveMQ Cloud" : "Desconectado"}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 16,
              background: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Controles do Alarme
            </div>

            <button
              onClick={handleStopClick}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "none",
                background: "#ef4444",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Desativar alarme agora
            </button>

            <button
              onMouseDown={handlePauseMouseDown}
              onMouseUp={handlePauseMouseUp}
              onMouseLeave={handlePauseMouseUp}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "none",
                background: isPaused ? "#facc15" : "#3b82f6",
                color: "#020617",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
              title="Segure por 1 segundo para pausar/retomar"
            >
              {isPaused
                ? "Segure para Retomar (PAUSADO)"
                : "Segure para Pausar Alarme"}
            </button>

            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginTop: 4,
              }}
            >
              • Clique em <b>Desativar</b> para desligar o alerta atual. <br />
              • <b>Segure</b> o botão azul por ~1 segundo para pausar/retomar o sistema.
            </p>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 6 }}>Validar número (Twilio Lookup)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #334155', background:'#020617', color:'#e5e7eb', flex:1 }}
                />
                <button
                  onClick={async () => {
                    setLookupLoading(true);
                    setLookupResult(null);
                    setLookupError(null);
                    try {
                      const res = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: lookupPhone }) });
                      const j = await res.json();
                      if (!res.ok) {
                        setLookupError(j.error || 'Erro na lookup');
                      } else {
                        setLookupResult(j.data || j);
                      }
                    } catch (err: any) {
                      setLookupError(err.message || String(err));
                    }
                    setLookupLoading(false);
                  }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#06b6d4', color: '#042f3a', cursor: 'pointer' }}
                >
                  {lookupLoading ? 'Validando...' : 'Validar'}
                </button>
              </div>
              {lookupError && <div style={{ color: '#fca5a5', marginTop: 8 }}>{lookupError}</div>}
              {lookupResult && (
                <pre style={{ marginTop: 8, background: '#021024', padding: 10, borderRadius: 8, maxHeight: 220, overflow: 'auto', color: '#cbd5e1' }}>{JSON.stringify(lookupResult, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>

        {/* CSS das sirenes */}
        <style jsx global>{`
          .siren {
            font-size: 38px;
          }
          .siren-red {
            animation: blink-red 0.6s infinite alternate;
          }
          .siren-blue {
            animation: blink-blue 0.6s infinite alternate;
          }
          @keyframes blink-red {
            from {
              opacity: 0.2;
              transform: translateY(0px);
            }
            to {
              opacity: 1;
              transform: translateY(-4px);
              text-shadow: 0 0 12px rgba(248, 113, 113, 0.9);
            }
          }
          @keyframes blink-blue {
            from {
              opacity: 0.2;
              transform: translateY(0px);
            }
            to {
              opacity: 1;
              transform: translateY(-4px);
              text-shadow: 0 0 12px rgba(59, 130, 246, 0.9);
            }
          }
        `}</style>
      </div>
    </main>
  );
}