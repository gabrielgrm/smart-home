import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Configurações por cômodo
interface CômodoConfig {
  emoji: string;
  nome: string;
  corPrincipal: string;
  corSecundaria: string;
  gradiente: string;
  bgHeader: string;
  bgCard: string;
}

const cômodoConfigs: Record<string, CômodoConfig> = {
  sala: {
    emoji: '🛋️',
    nome: 'Sala',
    corPrincipal: '#1d4ed8',
    corSecundaria: '#60a5fa',
    gradiente: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    bgHeader: '#020617',
    bgCard: '#dbeafe',
  },
  quarto: {
    emoji: '🛏️',
    nome: 'Quarto',
    corPrincipal: '#1d4ed8',
    corSecundaria: '#60a5fa',
    gradiente: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    bgHeader: '#020617',
    bgCard: '#dbeafe',
  },
};

function generateRoomEmailHTML(
  config: CômodoConfig,
  mensagemAlerta: string,
  dataHora: string,
  disableUrl?: string
): string {
  const desativarLink = disableUrl || 'https://smartlight-dashboard.vercel.app/leds';

  return `
  <body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#020617" style="background-color:#020617;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0b1220;border-radius:16px;border:1px solid #1f2937;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.5);">
            
            <!-- Header com cor do cômodo -->
            <tr>
              <td style="padding:28px 32px;background:${config.gradiente};background-color:${config.bgHeader};">
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="font-size:40px;line-height:1;">
                    ${config.emoji}
                  </div>
                  <div>
                    <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${config.corPrincipal};font-weight:700;">
                      Smart Palafita
                    </p>
                    <h1 style="margin:0;font-size:18px;color:#e5e7eb;font-weight:600;line-height:1.3;">
                      Luz da ${config.nome} ligada
                    </h1>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Conteúdo -->
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#d1d5db;">
                  Detectamos que a luz está ligada há mais tempo que o esperado:
                </p>

                <!-- Mensagem de alerta -->
                <div style="margin:20px 0;padding:16px;border-radius:10px;background:#111827;border-left:4px solid ${config.corPrincipal};border:1px solid #1f2937;">
                  <p style="margin:0;font-size:13px;color:#bfdbfe;font-weight:500;">
                    ${mensagemAlerta}
                  </p>
                </div>

                <!-- Info cards -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
                  <tr>
                    <td style="width:50%;padding-right:6px;">
                      <div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;">
                        <p style="margin:0 0 4px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;font-weight:600;">
                          ⏱️ Horário
                        </p>
                        <p style="margin:0;font-size:12px;color:#e5e7eb;">
                          ${dataHora}
                        </p>
                      </div>
                    </td>
                    <td style="width:50%;padding-left:6px;">
                      <div style="padding:12px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;">
                        <p style="margin:0 0 4px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:${config.corPrincipal};font-weight:600;">
                          📍 Cômodo
                        </p>
                        <p style="margin:0;font-size:12px;color:${config.corPrincipal};">
                          ${config.nome}
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- CTA Button -->
                <div style="margin:24px 0;text-align:center;">
                  <a
                    href="${desativarLink}"
                    style="
                      display:inline-block;
                      padding:12px 28px;
                      border-radius:8px;
                      background:${config.gradiente};
                      background-color:${config.corPrincipal};
                      color:#ffffff;
                      font-size:13px;
                      font-weight:600;
                      text-decoration:none;
                      box-shadow:0 4px 12px rgba(29,78,216,0.4);
                    "
                  >
                    Acessar Dashboard
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px;background:#020617;border-top:1px solid #1f2937;">
                <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;text-align:center;">
                  <strong style="color:#e5e7eb;">Smart Palafita</strong> • Sistema de Automação Residencial<br/>
                  Este é um alerta automático de sustentabilidade
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
    console.log('[EMAIL-LUZ] 🔷 Iniciando requisição de envio de email de luz...');

    const { message, comodo } = await request.json();
    console.log('[EMAIL-LUZ] 📝 Mensagem recebida:', message);
    console.log('[EMAIL-LUZ] 🏠 Cômodo:', comodo || 'não especificado');

    const alertEmail = process.env.ALERT_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    console.log('[EMAIL-LUZ] 🔍 Verificando configurações:');
    console.log('[EMAIL-LUZ]   - ALERT_EMAIL:', alertEmail ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
    console.log('[EMAIL-LUZ]   - RESEND_API_KEY:', resendKey ? '✅ Configurado' : '❌ NÃO CONFIGURADO');

    if (!alertEmail) {
      console.error('[EMAIL-LUZ] ❌ Email de destino não configurado!');
      return NextResponse.json(
        { error: 'Email de destino não configurado. Configure ALERT_EMAIL no .env' },
        { status: 500 }
      );
    }

    if (!resendKey) {
      console.error('[EMAIL-LUZ] ❌ Resend API key não configurada!');
      return NextResponse.json(
        {
          error: 'Resend API key não configurada. Configure RESEND_API_KEY no .env',
        },
        { status: 500 }
      );
    }

    const mensagemAlerta =
      message ||
      'A luz está ligada há mais tempo que o esperado. Recomendamos desligá-la para economizar energia.';

    const dataHora = new Date().toLocaleString('pt-BR');

    // Selecionar configuração do cômodo ou usar sala como padrão
    const config = cômodoConfigs[comodo] || cômodoConfigs.sala;

    // Gerar assunto dinâmico por cômodo
    let assunto = '💡 Tempo de luz';
    if (comodo === 'sala') {
      assunto = '💡 Tempo de luz na Sala';
    } else if (comodo === 'quarto') {
      assunto = '🌙 Tempo de luz no Quarto';
    }

    console.log('[EMAIL-LUZ] 📧 Preparando para enviar email:');
    console.log('[EMAIL-LUZ]   - De: Alarme Smart Palafita <onboarding@resend.dev>');
    console.log('[EMAIL-LUZ]   - Para:', alertEmail);
    console.log('[EMAIL-LUZ]   - Assunto:', assunto);
    console.log('[EMAIL-LUZ]   - Cômodo:', config.nome);

    console.log('[EMAIL-LUZ] 🚀 Chamando API Resend...');

    const htmlContent = generateRoomEmailHTML(config, mensagemAlerta, dataHora);

    const emailResponse = await resend.emails.send({
      from: 'Alarme Smart Palafita <onboarding@resend.dev>',
      to: alertEmail,
      subject: assunto,
      html: htmlContent,
    });

    console.log('[EMAIL-LUZ] 📨 Resposta da Resend recebida');
    console.log('[EMAIL-LUZ]   - Erro:', emailResponse.error || 'Nenhum erro');
    console.log('[EMAIL-LUZ]   - ID:', emailResponse.data?.id || 'N/A');

    if (emailResponse.error) {
      console.error('[EMAIL-LUZ] ❌ Erro ao enviar email:', emailResponse.error);
      return NextResponse.json(
        {
          error: 'Erro ao enviar email de luz',
          details: emailResponse.error.message,
        },
        { status: 500 }
      );
    }

    console.log('[EMAIL-LUZ] ✅ Email enviado com sucesso! ID:', emailResponse.data?.id);
    return NextResponse.json(
      {
        success: true,
        message: 'Email de luz enviado com sucesso',
        id: emailResponse.data?.id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EMAIL-LUZ] ❌ Erro ao enviar email de luz:', error);
    console.error('[EMAIL-LUZ]    Stack:', error.stack);

    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar email de luz',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
