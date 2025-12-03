import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();
    
    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Número de telefone e código são obrigatórios' },
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

    // Verificar código recebido
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks
      .create({
        to: phone,
        code: code,
      });

    if (verificationCheck.status === 'approved') {
      return NextResponse.json(
        {
          success: true,
          status: verificationCheck.status,
          message: 'Código verificado com sucesso!',
          sid: verificationCheck.sid,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          status: verificationCheck.status,
          message: 'Código inválido ou expirado',
          sid: verificationCheck.sid,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao verificar código:', error);
    
    // Erro específico de código inválido
    if (error.code === 20404 || error.status === 404) {
      return NextResponse.json(
        {
          error: 'Código inválido ou expirado',
          status: 'pending',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Erro ao verificar código',
        details: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}

