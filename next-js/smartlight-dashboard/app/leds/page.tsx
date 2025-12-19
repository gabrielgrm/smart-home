"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import Link from "next/link";

const MQTT_URL =
  "wss://abc140925c0d4acea7acf98b911c0419.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "admin";
const MQTT_PASS = "Teste@123";

const TOPICO_ESTADO = "projeto/home-security/sensor/estado";
const TOPICO_LED_SALA = "projeto/home-security/led/sala";
const TOPICO_LED_QUARTO = "projeto/home-security/led/quarto";
const TOPICO_LED_SALA_ESTADO = "projeto/home-security/led/sala/estado";
const TOPICO_LED_QUARTO_ESTADO = "projeto/home-security/led/quarto/estado";

type Comodo = "sala" | "quarto";

export default function LedsPage() {
  const [estado, setEstado] = useState<string>("--");
  const [connected, setConnected] = useState(false);
  const [comodoAtivo, setComodoAtivo] = useState<Comodo>("sala");
  const [corSala, setCorSala] = useState<string>("#ffffff");
  const [corQuarto, setCorQuarto] = useState<string>("#ffffff");
  const clientRef = useRef<MqttClient | null>(null);
  // light-on timers (demo: 10 segundos)
  const LIGHT_TIMEOUT_MS = 10 * 1000; // 10 segundos
  const salaStartRef = useRef<number | null>(null);
  const quartoStartRef = useRef<number | null>(null);
  const salaAttemptedRef = useRef<boolean>(false);
  const quartoAttemptedRef = useRef<boolean>(false);
  const [salaElapsed, setSalaElapsed] = useState<number>(0);
  const [quartoElapsed, setQuartoElapsed] = useState<number>(0);
  const isClientRef = useRef<boolean>(false); // Controlar inicialização no cliente

  // Persistência de dados no localStorage
  useEffect(() => {
    // Marcar que estamos no cliente
    isClientRef.current = true;

    // Recuperar estado persistido do localStorage
    const savedSalaStart = localStorage.getItem('salaLightStartTime');
    const savedQuartoStart = localStorage.getItem('quartoLightStartTime');
    const savedSalaAttempted = localStorage.getItem('salaLightEmailed');
    const savedQuartoAttempted = localStorage.getItem('quartoLightEmailed');

    if (savedSalaStart) {
      const startTime = parseInt(savedSalaStart, 10);
      salaStartRef.current = startTime;
      salaAttemptedRef.current = savedSalaAttempted === 'true';
    }

    if (savedQuartoStart) {
      const startTime = parseInt(savedQuartoStart, 10);
      quartoStartRef.current = startTime;
      quartoAttemptedRef.current = savedQuartoAttempted === 'true';
    }

    console.log('[PERSISTÊNCIA] ✅ Estado recuperado do localStorage');
    console.log('[PERSISTÊNCIA] Sala:', { start: savedSalaStart, attempted: savedSalaAttempted });
    console.log('[PERSISTÊNCIA] Quarto:', { start: savedQuartoStart, attempted: savedQuartoAttempted });
  }, []);

  // CSS responsivo para media queries
  const mobileStyles = `
    @media (max-width: 768px) {
      .leds-main-grid {
        grid-template-columns: 1fr !important;
        padding: 16px !important;
        gap: 16px !important;
      }
    }
    @media (max-width: 640px) {
      .color-picker-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;

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
      client.subscribe([TOPICO_ESTADO, TOPICO_LED_SALA_ESTADO, TOPICO_LED_QUARTO_ESTADO]);
    });

    client.on("reconnect", () => setConnected(false));
    client.on("close", () => setConnected(false));

    client.on("message", (topic, payload) => {
      const msg = payload.toString();
      if (topic === TOPICO_ESTADO) {
        setEstado(msg);
      } else if (topic === TOPICO_LED_SALA_ESTADO) {
        // payload formats: ON,<ts_ms>  or OFF,<duration_ms>
        const parts = msg.split(",");
        const flag = parts[0];
        const value = parts[1] || "0";
        if (flag === "ON") {
          salaStartRef.current = Date.now();
          salaAttemptedRef.current = false;
          setSalaElapsed(0);
        } else if (flag === "OFF") {
          const dur = parseInt(value, 10) || 0;
          setSalaElapsed(Math.floor(dur / 1000));
          salaStartRef.current = null;
          salaAttemptedRef.current = false;
        }
      } else if (topic === TOPICO_LED_QUARTO_ESTADO) {
        const parts = msg.split(",");
        const flag = parts[0];
        const value = parts[1] || "0";
        if (flag === "ON") {
          quartoStartRef.current = Date.now();
          quartoAttemptedRef.current = false;
          setQuartoElapsed(0);
        } else if (flag === "OFF") {
          const dur = parseInt(value, 10) || 0;
          setQuartoElapsed(Math.floor(dur / 1000));
          quartoStartRef.current = null;
          quartoAttemptedRef.current = false;
        }
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

  function formatSeconds(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
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
    // iniciar contador ao aplicar cor (assumimos que cor != #000000 significa "ligado")
    if (hexColor !== "#000000") {
      const now = Date.now();
      if (comodo === "sala") {
        salaStartRef.current = now;
        salaAttemptedRef.current = false;
        setSalaElapsed(0);
        // Persistir no localStorage
        localStorage.setItem('salaLightStartTime', now.toString());
        localStorage.setItem('salaLightEmailed', 'false');
        console.log('[PERSISTÊNCIA] 💾 Sala: luz ligada em', new Date(now).toLocaleTimeString());
      } else {
        quartoStartRef.current = now;
        quartoAttemptedRef.current = false;
        setQuartoElapsed(0);
        // Persistir no localStorage
        localStorage.setItem('quartoLightStartTime', now.toString());
        localStorage.setItem('quartoLightEmailed', 'false');
        console.log('[PERSISTÊNCIA] 💾 Quarto: luz ligada em', new Date(now).toLocaleTimeString());
      }
    }
  }

  function handleDesligar(comodo: Comodo) {
    const topic = comodo === "sala" ? TOPICO_LED_SALA : TOPICO_LED_QUARTO;
    publishLedRaw(topic, "0,0,0");
    const offColor = "#000000";
    if (comodo === "sala") {
      setCorSala(offColor);
      // reset contador e flags
      salaStartRef.current = null;
      salaAttemptedRef.current = false;
      setSalaElapsed(0);
      // Limpar do localStorage
      localStorage.removeItem('salaLightStartTime');
      localStorage.removeItem('salaLightEmailed');
      console.log('[PERSISTÊNCIA] 🗑️ Sala: luz desligada - localStorage limpo');
    } else {
      setCorQuarto(offColor);
      quartoStartRef.current = null;
      quartoAttemptedRef.current = false;
      setQuartoElapsed(0);
      // Limpar do localStorage
      localStorage.removeItem('quartoLightStartTime');
      localStorage.removeItem('quartoLightEmailed');
      console.log('[PERSISTÊNCIA] 🗑️ Quarto: luz desligada - localStorage limpo');
    }
  }

  async function enviarEmailLuz(comodo: Comodo, tempoMs: number) {
    try {
      const minutos = Math.floor(tempoMs / 60000);
      const segundos = Math.floor((tempoMs % 60000) / 1000);
      const nome = comodo === "sala" ? "Sala" : "Quarto";
      const mensagem = `Detectamos que a luz do(a) ${nome} está ligada há ${
        minutos > 0 ? minutos + ' min ' : ''
      }${segundos} s. Recomendamos reduzir o tempo de uso das luzes para economizar energia e ser mais sustentável.`;

      await fetch("/api/alerta/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: mensagem, comodo: comodo }),
      });
      console.log('[EMAIL-LUZ] ✅ Email enviado para', nome);
      
      // PERSISTÊNCIA: Salvar no localStorage que o email foi enviado
      if (comodo === "sala") {
        localStorage.setItem('salaLightEmailed', 'true');
      } else {
        localStorage.setItem('quartoLightEmailed', 'true');
      }
      console.log(`[PERSISTÊNCIA] 💾 ${nome}: flag de email salva no localStorage`);
    } catch (err) {
      console.error('[EMAIL-LUZ] ❌ Falha ao enviar email de luz', err);
    }
  }

  // Intervalo para checar tempos das luzes
  useEffect(() => {
    const intervalo = setInterval(() => {
      const now = Date.now();

      // SALA - Verificar tempo da luz
      const salaStart = salaStartRef.current || 
                        (localStorage.getItem('salaLightStartTime') ? 
                         parseInt(localStorage.getItem('salaLightStartTime')!, 10) : null);
      const salaEmailed = localStorage.getItem('salaLightEmailed') === 'true' || salaAttemptedRef.current;

      if (salaStart) {
        const elapsed = now - salaStart;
        setSalaElapsed(Math.floor(elapsed / 1000));
        
        // Sincronizar o ref com localStorage se necessário
        if (!salaStartRef.current && salaStart) {
          salaStartRef.current = salaStart;
          console.log('[PERSISTÊNCIA] 🔄 Sala: recuperado startTime do localStorage para o intervalo');
        }
        
        if (elapsed >= LIGHT_TIMEOUT_MS && !salaEmailed) {
          salaAttemptedRef.current = true;
          console.log('[PERSISTÊNCIA] ⏰ Sala: timeout atingido! Enviando email...');
          enviarEmailLuz("sala", elapsed);
        }
      }

      // QUARTO - Verificar tempo da luz
      const quartoStart = quartoStartRef.current || 
                         (localStorage.getItem('quartoLightStartTime') ? 
                          parseInt(localStorage.getItem('quartoLightStartTime')!, 10) : null);
      const quartoEmailed = localStorage.getItem('quartoLightEmailed') === 'true' || quartoAttemptedRef.current;

      if (quartoStart) {
        const elapsedQ = now - quartoStart;
        setQuartoElapsed(Math.floor(elapsedQ / 1000));
        
        // Sincronizar o ref com localStorage se necessário
        if (!quartoStartRef.current && quartoStart) {
          quartoStartRef.current = quartoStart;
          console.log('[PERSISTÊNCIA] 🔄 Quarto: recuperado startTime do localStorage para o intervalo');
        }
        
        if (elapsedQ >= LIGHT_TIMEOUT_MS && !quartoEmailed) {
          quartoAttemptedRef.current = true;
          console.log('[PERSISTÊNCIA] ⏰ Quarto: timeout atingido! Enviando email...');
          enviarEmailLuz("quarto", elapsedQ);
        }
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  return (
    <>
      <style>{mobileStyles}</style>
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
        className="leds-main-grid"
        style={{
          width: "100%",
          maxWidth: 1000,
          padding: "24px",
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
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
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: ativo ? "2px solid #1d4ed8" : "1px solid #1f2937",
                    background: ativo ? "rgba(29,78,216,0.15)" : "#111827",
                    color: ativo ? "#60a5fa" : "#9ca3af",
                    fontSize: 14,
                    fontWeight: ativo ? 600 : 500,
                    cursor: "pointer",
                    transition:
                      "background 0.2s ease, color 0.2s ease, border 0.2s ease",
                  }}
                >
                  {c === "sala" ? "🛋️ Sala" : "🛏️ Quarto"}
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
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* Color Picker Section - Circular Design */}
                  <div
                    className="color-picker-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                      alignItems: "center",
                    }}
                  >
                    {/* Color Picker Input */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 200,
                          height: 200,
                          borderRadius: "50%",
                          overflow: "hidden",
                          boxShadow: connected
                            ? `0 0 30px ${hexColor}88, 0 0 60px ${hexColor}44`
                            : "0 0 20px rgba(100,100,100,0.3)",
                          border: "3px solid #1f2937",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: connected ? "pointer" : "not-allowed",
                          transition: "all 0.3s ease",
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
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            opacity: 0,
                            cursor: connected ? "pointer" : "not-allowed",
                          }}
                        />
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: hexColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                          }}
                        >
                          🎨
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#9ca3af",
                          fontWeight: 500,
                        }}
                      >
                        Toque para escolher
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => handleAplicarCor(c)}
                        disabled={!connected}
                        style={{
                          padding: "14px 20px",
                          borderRadius: 999,
                          border: "none",
                          background: connected
                            ? "linear-gradient(135deg, #22c55e, #16a34a)"
                            : "#374151",
                          color: connected ? "#052e16" : "#9ca3af",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: connected ? "pointer" : "not-allowed",
                          boxShadow: connected
                            ? "0 0 15px rgba(34,197,94,0.5)"
                            : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span style={{ fontSize: 16 }}>✓</span>
                        Aplicar cor
                      </button>

                      <button
                        onClick={() => handleDesligar(c)}
                        disabled={!connected}
                        style={{
                          padding: "14px 20px",
                          borderRadius: 999,
                          border: "none",
                          background: connected
                            ? "radial-gradient(circle at 20% 0%, #fecaca, #b91c1c)"
                            : "#374151",
                          color: connected ? "#f9fafb" : "#9ca3af",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: connected ? "pointer" : "not-allowed",
                          boxShadow: connected
                            ? "0 0 15px rgba(248,113,113,0.5)"
                            : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span style={{ fontSize: 16 }}>⏻</span>
                        Desligar
                      </button>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          padding: "12px",
                          backgroundColor: "#111827",
                          borderRadius: 8,
                          border: "1px solid #1f2937",
                          lineHeight: 1.5,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          O sistema envia RGB (0–255) via MQTT
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ opacity: 0.8, fontFamily: "monospace" }}>
                            Código: <code>{hexColor.toUpperCase()}</code>
                          </span>
                          {/* mostrar tempo decorrido quando luz estiver ligada */}
                          {((c === "sala" && salaElapsed > 0 && corSala !== "#000000") || (c === "quarto" && quartoElapsed > 0 && corQuarto !== "#000000")) && (
                            <span style={{ background: "#071128", padding: "6px 8px", borderRadius: 8, fontSize: 12, color: "#a5b4fc" }}>
                              Ligada há: {c === "sala" ? formatSeconds(salaElapsed) : formatSeconds(quartoElapsed)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </main>
    </>
  );
}


