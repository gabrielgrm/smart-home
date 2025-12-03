import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const toNumber = process.env.ALERT_SMS_TO_NUMBER;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Credenciais Twilio não configuradas. Verifique o arquivo .env' },
        { status: 500 }
      );
    }

    if (!toNumber) {
      return NextResponse.json(
        { error: 'Número de destino não configurado. Configure ALERT_SMS_TO_NUMBER no .env' },
        { status: 500 }
      );
    }

    // Garantir que exista um remetente configurado (From) ou Messaging Service
    if (!fromNumber && !messagingServiceSid) {
      return NextResponse.json(
        {
          error:
            "É necessário configurar 'TWILIO_FROM_NUMBER' ou 'TWILIO_MESSAGING_SERVICE_SID' no .env para enviar mensagens",
        },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);


    // Mensagem padrão se não fornecida
    const mensagemAlerta = message || '🚨 ALERTA: O alarme foi ativado e está soando há mais de 2 minutos! 🚨';

    // Enviar SMS de alerta
    // Montar payload aceitando 'MessagingServiceSid' ou 'from'
    const payload: any = {
      body: mensagemAlerta,
      to: toNumber,
    };

    if (messagingServiceSid) {
      payload.messagingServiceSid = messagingServiceSid;
    } else if (fromNumber) {
      payload.from = fromNumber;
    }

    const messageResponse = await client.messages.create(payload);

    return NextResponse.json(
      {
        success: true,
        message: 'SMS de alerta enviado com sucesso',
        sid: messageResponse.sid,
        status: messageResponse.status,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao enviar SMS de alerta:', error);
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar SMS de alerta',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}

