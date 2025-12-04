"use client";

import { useState } from "react";

interface VerificacaoSMSProps {
  onVerificado?: (phone: string) => void;
}

export default function VerificacaoSMS({ onVerificado }: VerificacaoSMSProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const enviarCodigo = async () => {
    if (!phone) {
      setError("Por favor, insira um número de telefone");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/verify/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage("Código enviado! Verifique seu SMS.");
        setStep("code");
      } else {
        setError(data.error || "Erro ao enviar código");
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async () => {
    if (!code || code.length !== 6) {
      setError("Por favor, insira o código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/verify/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.status === "approved") {
        setMessage("Código verificado com sucesso! ✅");
        if (onVerificado) {
          onVerificado(phone);
        }
      } else {
        setError(data.message || "Código inválido ou expirado");
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetar = () => {
    setStep("phone");
    setCode("");
    setMessage("");
    setError("");
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Verificação por SMS
      </h2>

      {step === "phone" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Número de Telefone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5581998781729"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <button
            onClick={enviarCodigo}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar Código"}
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Código de Verificação (6 dígitos)
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
              disabled={loading}
            />
          </div>

          <button
            onClick={verificarCodigo}
            disabled={loading || code.length !== 6}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Verificando..." : "Verificar Código"}
          </button>

          <button
            onClick={resetar}
            disabled={loading}
            className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed"
          >
            Voltar / Reenviar
          </button>
        </div>
      )}

      {message && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
}

