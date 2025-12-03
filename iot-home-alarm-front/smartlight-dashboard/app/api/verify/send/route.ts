import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return NextResponse.json(
        { error: 'Credenciais Twilio não configuradas. Verifique o arquivo .env' },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Enviar código de verificação
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications
      .create({
        to: phone,
        channel: 'sms', // ou 'whatsapp' se preferir
      });

    return NextResponse.json(
      {
        success: true,
        message: 'Código de verificação enviado com sucesso',
        status: verification.status,
        sid: verification.sid,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao enviar código de verificação:', error);
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar código de verificação',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}

