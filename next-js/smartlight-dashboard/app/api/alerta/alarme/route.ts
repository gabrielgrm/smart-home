import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function generateAlarmEmailHTML(
  mensagemAlerta: string,
  dataHora: string,
  disableUrl?: string
): string {
  const desativarLink = disableUrl || 'https://smartlight-dashboard.vercel.app/alarme';

  return `
  <body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#020617" style="background-color:#020617;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0b1220;border-radius:16px;border:2px solid #60a5fa;overflow:hidden;box-shadow:0 0 30px rgba(29,78,216,0.4);">
            
            <!-- Header com gradiente azul escuro para alarme -->
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg, #1d4ed8, #3b82f6);background-color:#1d4ed8;border-bottom:3px solid #60a5fa;">
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="font-size:48px;line-height:1;">
                    🚨
                  </div>
                  <div>
                    <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#e0e7ff;font-weight:700;">
                      Smart Home Security • Segurança
                    </p>
                    <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:700;line-height:1.2;">
                      ⚠️ ALARME ATIVADO
                    </h1>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Status crítico -->
            <tr>
              <td style="padding:16px 32px;background:#111827;border-bottom:1px solid #1f2937;">
                <div style="padding:12px;border-radius:8px;background:#0f172a;border:2px solid #60a5fa;">
                  <p style="margin:0;font-size:11px;color:#60a5fa;font-weight:700;text-align:center;letter-spacing:0.05em;">
                    ⚠️ STATUS: ATIVO | AÇÃO IMEDIATA RECOMENDADA
                  </p>
                </div>
              </td>
            </tr>

            <!-- Conteúdo principal -->
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#d1d5db;">
                  <strong>Um evento de segurança foi detectado</strong> no seu sistema Smart Home Security:
                </p>

                <!-- Mensagem de alarme destacada -->
                <div style="margin:20px 0;padding:16px;border-radius:10px;background:#0f172a;border:2px solid #60a5fa;border-left:4px solid #3b82f6;">
                  <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;line-height:1.6;">
                    ${mensagemAlerta}
                  </p>
                </div>

                <!-- Info cards críticos -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                  <tr>
                    <td style="width:50%;padding-right:6px;">
                      <div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;">
                        <p style="margin:0 0 4px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;font-weight:600;">
                          ⏰ Horário do Evento
                        </p>
                        <p style="margin:0;font-size:12px;color:#e5e7eb;font-weight:500;">
                          ${dataHora}
                        </p>
                      </div>
                    </td>
                    <td style="width:50%;padding-left:6px;">
                      <div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;">
                        <p style="margin:0 0 4px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;font-weight:600;">
                          🏠 Local
                        </p>
                        <p style="margin:0;font-size:12px;color:#e5e7eb;font-weight:500;">
                          Residência
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Recomendações -->
                <div style="margin:24px 0;padding:14px;border-radius:10px;background:#0f172a;border-left:3px solid #60a5fa;border:1px solid #1f2937;">
                  <p style="margin:0 0 10px 0;font-size:12px;color:#60a5fa;font-weight:700;text-transform:uppercase;">
                    ⚡ Ações Recomendadas:
                  </p>
                  <ul style="margin:0;padding-left:20px;color:#d1d5db;font-size:12px;line-height:1.6;">
                    <li style="margin:4px 0;">Verifique imediatamente o ambiente</li>
                    <li style="margin:4px 0;">Desative o alarme via dashboard se for falso</li>
                    <li style="margin:4px 0;">Contate autoridades se necessário</li>
                  </ul>
                </div>

                <!-- CTA Button Primário -->
                <div style="margin:24px 0;text-align:center;">
                  <a
                    href="${desativarLink}"
                    style="
                      display:inline-block;
                      padding:12px 28px;
                      border-radius:8px;
                      background:linear-gradient(135deg, #1d4ed8, #3b82f6);
                      background-color:#1d4ed8;
                      color:#ffffff;
                      font-size:13px;
                      font-weight:700;
                      text-decoration:none;
                      box-shadow:0 0 18px rgba(29,78,216,0.5);
                      letter-spacing:0.05em;
                    "
                  >
                    🔵 DESATIVAR ALARME
                  </a>
                </div>

                <!-- Nota adicional -->
                <div style="margin:20px 0;padding:12px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                    <strong style="color:#d1d5db;">Nota de Segurança:</strong> Este é um alerta automático do seu sistema de segurança. Se você não ativou manualmente, recomendamos verificar sua residência imediatamente.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px;background:#020617;border-top:1px solid #1f2937;">
                <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;text-align:center;">
                  <strong style="color:#e5e7eb;">Smart Home Security</strong> • Sistema de Segurança Residencial<br/>
                  Alertas de segurança em tempo real para sua proteção
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  `;
}

export async function POST(request: Request) {
  try {
    console.log('[EMAIL-ALARME] 🔷 Iniciando requisição de envio de email de alarme...');

    const { message, disableUrl } = await request.json();
    console.log('[EMAIL-ALARME] 📝 Mensagem recebida:', message);
    console.log('[EMAIL-ALARME] 🔗 Link de desativação:', disableUrl || 'nenhum');

    const alertEmail = process.env.ALERT_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    console.log('[EMAIL-ALARME] 🔍 Verificando configurações:');
    console.log('[EMAIL-ALARME]   - ALERT_EMAIL:', alertEmail ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
    console.log('[EMAIL-ALARME]   - RESEND_API_KEY:', resendKey ? '✅ Configurado' : '❌ NÃO CONFIGURADO');

    if (!alertEmail) {
      console.error('[EMAIL-ALARME] ❌ Email de destino não configurado!');
      return NextResponse.json(
        { error: 'Email de destino não configurado. Configure ALERT_EMAIL no .env' },
        { status: 500 }
      );
    }

    if (!resendKey) {
      console.error('[EMAIL-ALARME] ❌ Resend API key não configurada!');
      return NextResponse.json(
        {
          error: 'Resend API key não configurada. Configure RESEND_API_KEY no .env',
        },
        { status: 500 }
      );
    }

    const mensagemAlerta =
      message ||
      '⚠️ O alarme foi ativado! Verifique imediatamente sua residência.';

    const desativarLink = disableUrl || 'https://smarthome.local/alarme';
    const dataHora = new Date().toLocaleString('pt-BR');

    console.log('[EMAIL-ALARME] 📧 Preparando para enviar email:');
    console.log('[EMAIL-ALARME]   - De: Alarme Smart Home Security <onboarding@resend.dev>');
    console.log('[EMAIL-ALARME]   - Para:', alertEmail);
    console.log('[EMAIL-ALARME]   - Assunto: 🚨 ALERTA CRÍTICO: Alarme de Segurança Ativado!');
    console.log('[EMAIL-ALARME]   - Tipo: ALARME 🚨');

    console.log('[EMAIL-ALARME] 🚀 Chamando API Resend...');

    const htmlContent = generateAlarmEmailHTML(mensagemAlerta, dataHora, desativarLink);

    const emailResponse = await resend.emails.send({
      from: 'Alarme Smart Home Security <onboarding@resend.dev>',
      to: alertEmail,
      subject: '🚨 ALERTA CRÍTICO: Alarme de Segurança Ativado!',
      html: htmlContent,
    });

    console.log('[EMAIL-ALARME] 📨 Resposta da Resend recebida');
    console.log('[EMAIL-ALARME]   - Erro:', emailResponse.error || 'Nenhum erro');
    console.log('[EMAIL-ALARME]   - ID:', emailResponse.data?.id || 'N/A');

    if (emailResponse.error) {
      console.error('[EMAIL-ALARME] ❌ Erro ao enviar email:', emailResponse.error);
      return NextResponse.json(
        {
          error: 'Erro ao enviar email de alarme',
          details: emailResponse.error.message,
        },
        { status: 500 }
      );
    }

    console.log('[EMAIL-ALARME] ✅ Email enviado com sucesso! ID:', emailResponse.data?.id);
    return NextResponse.json(
      {
        success: true,
        message: 'Email de alarme enviado com sucesso',
        id: emailResponse.data?.id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EMAIL-ALARME] ❌ Erro ao enviar email de alarme:', error);
    console.error('[EMAIL-ALARME]    Stack:', error.stack);

    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar email de alarme',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
