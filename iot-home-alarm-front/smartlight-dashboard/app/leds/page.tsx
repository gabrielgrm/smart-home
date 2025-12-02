"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import Link from "next/link";

const MQTT_URL =
  "wss://abc140925c0d4acea7acf98b911c0419.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "admin";
const MQTT_PASS = "Teste@123";

const TOPICO_ESTADO = "projeto/guardian/sensor/estado";
const TOPICO_LED_SALA = "projeto/guardian/led/sala";
const TOPICO_LED_QUARTO = "projeto/guardian/led/quarto";

type Comodo = "sala" | "quarto";

export default function LedsPage() {
  const [estado, setEstado] = useState<string>("--");
  const [connected, setConnected] = useState(false);
  const [comodoAtivo, setComodoAtivo] = useState<Comodo>("sala");
  const [corSala, setCorSala] = useState<string>("#ffffff");
  const [corQuarto, setCorQuarto] = useState<string>("#ffffff");
  const clientRef = useRef<MqttClient | null>(null);

  const [lookupPhone, setLookupPhone] = useState<string>("+5581998781729");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

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
      client.subscribe([TOPICO_ESTADO]);
    });

    client.on("reconnect", () => setConnected(false));
    client.on("close", () => setConnected(false));

    client.on("message", (topic, payload) => {
      const msg = payload.toString();
      if (topic === TOPICO_ESTADO) {
        setEstado(msg);
      }
    });

    return () => {
      client.end(true);
    };
  }, []);

  function publishLedRaw(topic: string, payload: string) {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    client.publish(topic, payload);
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return null;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }

  function publishLedColor(comodo: Comodo, hexColor: string) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return;
    const topic = comodo === "sala" ? TOPICO_LED_SALA : TOPICO_LED_QUARTO;
    const payload = `${rgb.r},${rgb.g},${rgb.b}`;
    publishLedRaw(topic, payload);
  }

  function handleColorChange(comodo: Comodo, hexColor: string) {
    if (comodo === "sala") {
      setCorSala(hexColor);
    } else {
      setCorQuarto(hexColor);
    }
  }

  function handleAplicarCor(comodo: Comodo) {
    const hexColor = comodo === "sala" ? corSala : corQuarto;
    publishLedColor(comodo, hexColor);
  }

  function handleDesligar(comodo: Comodo) {
    const topic = comodo === "sala" ? TOPICO_LED_SALA : TOPICO_LED_QUARTO;
    publishLedRaw(topic, "0,0,0");
    const offColor = "#000000";
    if (comodo === "sala") {
      setCorSala(offColor);
    } else {
      setCorQuarto(offColor);
    }
  }

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
          position: "absolute",
          top: 16,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 8,
            padding: 4,
            borderRadius: 999,
            background: "#020617aa",
            border: "1px solid #1f2937",
            backdropFilter: "blur(10px)",
            pointerEvents: "auto",
          }}
        >
          <Link
            href="/alarme"
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "transparent",
              color: "#9ca3af",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Alarme
          </Link>
          <Link
            href="/leds"
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "#111827",
              color: "#e5e7eb",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Luzes
          </Link>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 900,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "1.5fr 2fr",
          gap: 24,
          color: "#e5e7eb",
        }}
      >
        {/* CARTÃO DE STATUS */}
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
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Status do sistema
            </div>
            <span
              style={{
                fontSize: 14,
                color: "#9ca3af",
              }}
            >
              Estado atual reportado pelo alarme:{" "}
              <b style={{ color: "#e5e7eb" }}>{estado}</b>
            </span>
          </div>

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
                marginBottom: 6,
              }}
            >
              Validar número (Twilio Lookup)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e5e7eb",
                  flex: 1,
                }}
              />
              <button
                onClick={async () => {
                  setLookupLoading(true);
                  setLookupResult(null);
                  setLookupError(null);
                  try {
                    const res = await fetch("/api/lookup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phone: lookupPhone }),
                    });
                    const j = await res.json();
                    if (!res.ok) {
                      setLookupError(j.error || "Erro na lookup");
                    } else {
                      setLookupResult(j.data || j);
                    }
                  } catch (err: any) {
                    setLookupError(err.message || String(err));
                  }
                  setLookupLoading(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#06b6d4",
                  color: "#042f3a",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {lookupLoading ? "Validando..." : "Validar"}
              </button>
            </div>
            {lookupError && (
              <div style={{ color: "#fca5a5", marginTop: 8 }}>
                {lookupError}
              </div>
            )}
            {lookupResult && (
              <pre
                style={{
                  marginTop: 8,
                  background: "#021024",
                  padding: 10,
                  borderRadius: 8,
                  maxHeight: 220,
                  overflow: "auto",
                  color: "#cbd5e1",
                }}
              >
                {JSON.stringify(lookupResult, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* CONTROLE DE LUZES POR CÔMODO */}
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
            Luzes dos cômodos
          </div>

          {/* Tabs dos cômodos */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {(["sala", "quarto"] as Comodo[]).map((c) => {
              const ativo = comodoAtivo === c;
              return (
                <button
                  key={c}
                  onClick={() => setComodoAtivo(c)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid #1f2937",
                    background: ativo ? "#1d4ed8" : "#020617",
                    color: ativo ? "#e5e7eb" : "#9ca3af",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {c === "sala" ? "Sala" : "Quarto"}
                </button>
              );
            })}
          </div>

          {/* Conteúdo do cômodo selecionado */}
          {(() => {
            const c = comodoAtivo;
            const titulo = c === "sala" ? "Sala" : "Quarto";
            const topic = c === "sala" ? TOPICO_LED_SALA : TOPICO_LED_QUARTO;
            const hexColor = c === "sala" ? corSala : corQuarto;
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 14,
                    color: "#9ca3af",
                  }}
                >
                  <span>{titulo}</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>
                    Tópico MQTT: <code>{topic}</code>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      alignItems: "stretch",
                    }}
                  >
                    <input
                      type="color"
                      value={hexColor}
                      onChange={(e) =>
                        handleColorChange(c, e.target.value.toLowerCase())
                      }
                      disabled={!connected}
                      style={{
                        width: 80,
                        height: 44,
                        borderRadius: 10,
                        border: "1px solid #1f2937",
                        background: "#020617",
                        padding: 0,
                        cursor: connected ? "pointer" : "not-allowed",
                        boxShadow: connected
                          ? "0 0 10px rgba(148,163,184,0.6)"
                          : "none",
                      }}
                    />

                    <button
                      onClick={() => handleAplicarCor(c)}
                      disabled={!connected}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background:
                          "linear-gradient(135deg, #22c55e, #16a34a)",
                        color: "#052e16",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: connected ? "pointer" : "not-allowed",
                        boxShadow: connected
                          ? "0 0 8px rgba(34,197,94,0.5)"
                          : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      Aplicar
                    </button>
                  </div>

                  <button
                    onClick={() => handleDesligar(c)}
                    disabled={!connected}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: "none",
                      background:
                        "radial-gradient(circle at 20% 0%, #fecaca, #b91c1c)",
                      color: "#f9fafb",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: connected ? "pointer" : "not-allowed",
                      boxShadow: connected
                        ? "0 0 16px rgba(248,113,113,0.7)"
                        : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "999px",
                        border: "2px solid rgba(248,250,252,0.9)",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                      }}
                    >
                      ⏻
                    </span>
                    Desligar
                  </button>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span>
                      Selecione uma cor para o LED deste cômodo e clique em{" "}
                      <b>Aplicar cor</b> para enviar ao dispositivo.
                    </span>
                    <span style={{ opacity: 0.8 }}>
                      O sistema envia um payload <code>R,G,B</code> (0–255) para
                      o tópico MQTT configurado.
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}


