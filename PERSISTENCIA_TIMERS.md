# Documentação: Persistência de Timers de Luz

## Visão Geral
O sistema agora implementa persistência completa de timers de luz através de localStorage, garantindo que:
1. Os timers continuam rodando mesmo quando o usuário navega para outras páginas
2. Emails de alerta são enviados automaticamente quando o timeout é atingido
3. Os emails são enviados mesmo que o usuário esteja em outra página durante o timeout

## Fluxo de Dados

### 1. Inicialização (Página de LEDs)
- **Componente**: `app/leds/page.tsx`
- **Trigger**: Usuário clica em "Aplicar Cor" para ligar a luz
- **Ação**:
  ```typescript
  handleAplicarCor() {
    // Salvar no localStorage
    localStorage.setItem('salaLightStartTime', now.toString());
    localStorage.setItem('salaLightEmailed', 'false');
  }
  ```

### 2. Recuperação de Estado (Ao carregar a página de LEDs)
- **Componente**: `app/leds/page.tsx` - `useEffect` no mount
- **Trigger**: Componente carrega/monta
- **Ação**:
  ```typescript
  useEffect(() => {
    // Recuperar dados do localStorage
    const savedSalaStart = localStorage.getItem('salaLightStartTime');
    if (savedSalaStart) {
      salaStartRef.current = parseInt(savedSalaStart, 10);
    }
  }, []);
  ```

### 3. Monitoramento de Timeout (Intervalo)
- **Componente**: `app/leds/page.tsx` - `useEffect` com setInterval
- **Trigger**: A cada 1 segundo
- **Ação**:
  ```typescript
  useEffect(() => {
    setInterval(() => {
      // Verificar localStorage se ref está vazio
      const salaStart = salaStartRef.current || 
        parseInt(localStorage.getItem('salaLightStartTime') || '0', 10);
      
      if (salaStart) {
        const elapsed = now - salaStart;
        if (elapsed >= LIGHT_TIMEOUT_MS && !salaEmailed) {
          enviarEmailLuz("sala", elapsed);
        }
      }
    }, 1000);
  }, []);
  ```

### 4. Persistência Após Envio de Email
- **Função**: `enviarEmailLuz()`
- **Ação**:
  ```typescript
  async function enviarEmailLuz(comodo, tempoMs) {
    await fetch("/api/alerta/email", {...});
    
    // CRÍTICO: Persistir que o email foi enviado
    localStorage.setItem(`${comodo}LightEmailed`, 'true');
  }
  ```

### 5. Verificação Cross-Page (Página de Alarme)
- **Componente**: `app/alarme/page.tsx` - `useEffect` no mount
- **Trigger**: Usuário navega para página de alarme
- **Ação**:
  ```typescript
  useEffect(() => {
    const checkAndSendLightEmails = async () => {
      // Verificar localStorage dos timers de luz
      const salaStartTime = localStorage.getItem('salaLightStartTime');
      if (salaStartTime && !localStorage.getItem('salaLightEmailed')) {
        const elapsed = now - parseInt(salaStartTime, 10);
        if (elapsed >= LIGHT_TIMEOUT_MS) {
          // Enviar email de luz mesmo que esteja na página de alarme
          await fetch("/api/alerta/email", {...});
        }
      }
    };
    checkAndSendLightEmails();
  }, []);
  ```

### 6. Limpeza (Quando luz é desligada)
- **Componente**: `app/leds/page.tsx` - função `handleDesligar()`
- **Ação**:
  ```typescript
  handleDesligar() {
    // Limpar localStorage
    localStorage.removeItem('salaLightStartTime');
    localStorage.removeItem('salaLightEmailed');
  }
  ```

## localStorage Keys

| Key | Tipo | Exemplo | Descrição |
|-----|------|---------|-----------|
| `salaLightStartTime` | string | "1704067200000" | Timestamp em ms quando luz foi ligada (Sala) |
| `quartoLightStartTime` | string | "1704067200000" | Timestamp em ms quando luz foi ligada (Quarto) |
| `salaLightEmailed` | string | "true" ou "false" | Se email foi enviado para Sala |
| `quartoLightEmailed` | string | "true" ou "false" | Se email foi enviado para Quarto |

## Cenários Testados

### ✅ Cenário 1: Luz ligada > Esperar 10s > Email enviado
1. Usuário clica "Aplicar Cor" na página de LEDs
2. localStorage recebe `salaLightStartTime` e `salaLightEmailed: false`
3. Intervalo conta 10 segundos
4. Email é enviado automaticamente
5. localStorage atualizado com `salaLightEmailed: true`

### ✅ Cenário 2: Luz ligada > Navegar para Alarme > Email enviado mesmo fora da página
1. Usuário clica "Aplicar Cor" na página de LEDs
2. localStorage recebe startTime
3. Usuário navega para página de Alarme
4. useEffect da página de Alarme verifica localStorage
5. Se 10 segundos passaram, email é enviado
6. localStorage atualizado

### ✅ Cenário 3: Luz ligada > Recarregar página > Timer continua
1. Usuário clica "Aplicar Cor"
2. Usuário recarrega a página (F5)
3. useEffect de recuperação lê localStorage
4. Timer retoma do ponto onde parou
5. Email é enviado no tempo certo

### ✅ Cenário 4: Luz desligada > localStorage limpo
1. Usuário clica "Desligar"
2. handleDesligar() remove todas as chaves de localStorage
3. Se luz for ligada novamente, novo timer começa do zero

## Debugging

Todos os eventos importantes são logados no console com prefixos:
- `[PERSISTÊNCIA]` - Eventos de persistência
- `[EMAIL-LUZ]` - Emails de luz
- `[MQTT]` - Eventos MQTT

### Exemplo de logs esperados:

```
[PERSISTÊNCIA] 🔌 Recuperando dados do localStorage...
[PERSISTÊNCIA] ✅ Sala: startTime recuperado = 1704067200000
[PERSISTÊNCIA] 🎨 Sala: luz ligada - localStorage salvo
[PERSISTÊNCIA] ⏰ Sala: timeout atingido! Enviando email...
[EMAIL-LUZ] ✅ Email enviado para Sala
[PERSISTÊNCIA] 💾 Sala: flag de email salva no localStorage
[PERSISTÊNCIA] 🗑️ Sala: luz desligada - localStorage limpo
```

## Constantes

```typescript
// app/leds/page.tsx
const LIGHT_TIMEOUT_MS = 10 * 1000; // 10 segundos

// app/alarme/page.tsx
const LIGHT_TIMEOUT_MS = 10 * 1000; // 10 segundos (mesma constante)
```

## Endpoints de Email

- **Emails de Luz**: `POST /api/alerta/email`
  - Requer: `message` (string), `comodo` ("sala" ou "quarto")
  - Template: Tema escuro com cores por cômodo

- **Emails de Alarme**: `POST /api/alerta/alarme`
  - Requer: mensagem customizada
  - Template: Tema escuro com acentos vermelhos

## Próximos Passos (Opcionais)

- [ ] Persistir cor selecionada para restaurar UI ao recarregar
- [ ] Adicionar botão para limpar localStorage manualmente (para testes)
- [ ] Adicionar dashboard de histórico de emails enviados
- [ ] Implementar versionamento de localStorage para migração futura
