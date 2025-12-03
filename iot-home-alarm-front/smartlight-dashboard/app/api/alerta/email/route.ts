import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    console.log('[EMAIL] 🔷 Iniciando requisição de envio de email...');

    const { message, disableUrl } = await request.json();
    console.log('[EMAIL] 📝 Mensagem recebida:', message);
    console.log('[EMAIL] 🔗 Link de desativação:', disableUrl || 'nenhum');

    const alertEmail = process.env.ALERT_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    console.log('[EMAIL] 🔍 Verificando configurações:');
    console.log('[EMAIL]   - ALERT_EMAIL:', alertEmail ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
    console.log('[EMAIL]   - RESEND_API_KEY:', resendKey ? '✅ Configurado' : '❌ NÃO CONFIGURADO');

    if (!alertEmail) {
      console.error('[EMAIL] ❌ Email de destino não configurado!');
      return NextResponse.json(
        { error: 'Email de destino não configurado. Configure ALERT_EMAIL no .env' },
        { status: 500 }
      );
    }

    if (!resendKey) {
      console.error('[EMAIL] ❌ Resend API key não configurada!');
      return NextResponse.json(
        {
          error:
            'Resend API key não configurada. Configure RESEND_API_KEY no .env',
        },
        { status: 500 }
      );
    }

    const mensagemAlerta =
      message ||
      '🚨 ALERTA: O alarme foi ativado e está soando há mais de 30 segundos! Verifique imediatamente. 🚨';

    // fallback caso não venha URL no body
    const desativarLink =
      disableUrl || 'https://smartpalafita.local/desativar-alarme';

    const dataHora = new Date().toLocaleString('pt-BR');

    console.log('[EMAIL] 📧 Preparando para enviar email:');
    console.log('[EMAIL]   - De: Alarme Smart Palafita <onboarding@resend.dev>');
    console.log('[EMAIL]   - Para:', alertEmail);
    console.log('[EMAIL]   - Assunto: 🚨 ALERTA: Alarme Ativado!');

    console.log('[EMAIL] 🚀 Chamando API Resend...');

    const emailResponse = await resend.emails.send({
      from: 'Alarme Smart Palafita <onboarding@resend.dev>',
      to: alertEmail,
      subject: '🚨 ALERTA: Alarme Ativado!',
      html: `
  <body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:radial-gradient(circle at top,#1f2937,#020617);border-radius:24px;border:1px solid #111827;box-shadow:0 24px 60px rgba(15,23,42,0.9);overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:24px 32px 8px 32px;text-align:left;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:32px;height:32px;border-radius:999px;background:linear-gradient(135deg,#f97316,#facc15);display:flex;align-items:center;justify-content:center;font-size:18px;">
                    🔔
                  </div>
                  <div>
                    <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">
                      Smart Palafita • Alerta de Segurança
                    </p>
                    <h1 style="margin:4px 0 0 0;font-size:20px;color:#f9fafb;font-weight:600;">
                      Alarme acionado na sua residência
                    </h1>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Card principal -->
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.85);border-radius:18px;padding:20px;border:1px solid #111827;">
                  <tr>
                    <td style="color:#e5e7eb;font-size:14px;line-height:1.6;">
                      <p style="margin:0 0 12px 0;">
                        Olá,<br/>
                        Detectamos um <strong style="color:#f97316;">evento de alarme</strong> no seu sistema Smart Palafita.
                      </p>
                      <p style="margin:0 0 12px 0;color:#d1d5db;">
                        Mensagem do sistema:
                      </p>
                      <p style="margin:0 0 12px 0;padding:12px 14px;border-radius:12px;background:rgba(31,41,55,0.9);border:1px solid rgba(55,65,81,0.8);color:#f9fafb;font-size:13px;">
                        ${mensagemAlerta.replace(/🚨/g, '⚠️')}
                      </p>
                    </td>
                  </tr>

                  <!-- Info rápida -->
                  <tr>
                    <td style="padding-top:8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:50%;padding-right:6px;">
                            <div style="border-radius:14px;background:rgba(15,23,42,0.9);border:1px solid rgba(75,85,99,0.8);padding:10px 12px;">
                              <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">
                                Status
                              </p>
                              <p style="margin:0;font-size:13px;color:#f97316;font-weight:600;">
                                Alarme ativo
                              </p>
                            </div>
                          </td>
                          <td style="width:50%;padding-left:6px;">
                            <div style="border-radius:14px;background:rgba(15,23,42,0.9);border:1px solid rgba(55,65,81,0.9);padding:10px 12px;">
                              <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">
                                Horário
                              </p>
                              <p style="margin:0;font-size:13px;color:#e5e7eb;">
                                ${dataHora}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- CTA -->
                  <tr>
                    <td style="padding-top:20px;text-align:center;">
                      <a
                        href="${desativarLink}"
                        style="
                          display:inline-block;
                          padding:12px 24px;
                          border-radius:999px;
                          background:linear-gradient(135deg,#2563eb,#1d4ed8);
                          color:#f9fafb;
                          font-size:14px;
                          font-weight:600;
                          text-decoration:none;
                          box-shadow:0 14px 40px rgba(37,99,235,0.55);
                        "
                      >
                        🔻 Desativar alarme agora
                      </a>
                      <p style="margin:12px 0 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
                        Caso você não tenha ativado o sistema, recomendamos verificar o ambiente
                        e, se necessário, contatar as autoridades locais.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Rodapé -->
            <tr>
              <td style="padding:18px 32px 24px 32px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.4;">
                  Este é um e-mail automático do sistema <strong style="color:#e5e7eb;">Smart Palafita</strong>.<br/>
                  Se não deseja mais receber estes alertas, ajuste suas preferências no painel.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
      `,
    });

    console.log('[EMAIL] 📨 Resposta da Resend recebida');
    console.log('[EMAIL]   - Erro:', emailResponse.error || 'Nenhum erro');
    console.log('[EMAIL]   - ID:', emailResponse.data?.id || 'N/A');

    if (emailResponse.error) {
      console.error('[EMAIL] ❌ Erro ao enviar email:', emailResponse.error);
      return NextResponse.json(
        {
          error: 'Erro ao enviar email de alerta',
          details: emailResponse.error.message,
        },
        { status: 500 }
      );
    }

    console.log('[EMAIL] ✅ Email enviado com sucesso! ID:', emailResponse.data?.id);
    return NextResponse.json(
      {
        success: true,
        message: 'Email de alerta enviado com sucesso',
        id: emailResponse.data?.id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EMAIL] ❌ Erro ao enviar email de alerta:', error);
    console.error('[EMAIL]    Stack:', error.stack);

    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar email de alerta',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
