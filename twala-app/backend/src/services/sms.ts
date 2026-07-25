import config from '../config.js';

export interface SmsResult {
  success: boolean;
  message: string;
  recipient?: string;
  messageId?: string;
  statusCode?: number;
  status?: string;
}

interface AtRecipient {
  statusCode?: number | string;
  status?: string;
  number?: string;
  messageId?: string;
  cost?: string;
}

function buildSmsContent(params: {
  recipientName: string;
  amountUgx: number;
  senderName: string;
}): string {
  const ref = `HW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const date = new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return [
    'HOMEWARD',
    '',
    `Hello ${params.recipientName},`,
    '',
    `UGX ${params.amountUgx.toLocaleString()} received`,
    `from ${params.senderName}.`,
    '',
    `Receipt: ${ref}`,
    date,
    '',
    'Keep this SMS as your receipt.',
  // Africa's Talking's simulator normalises CRLF/LF into spaces. U+2028 is a
  // Unicode line separator, so the HOMEWARD heading remains a distinct row.
  ].join('\u2028');
}

function formatPhone(phone: string): string {
  const compact = phone.trim().replace(/[\s\-()]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  return compact.startsWith('+') ? compact : `+${compact}`;
}

function logToConsole(phone: string, message: string) {
  console.log(`  📱 SMS → ${phone}:\n${'-'.repeat(40)}\n${message}\n${'-'.repeat(40)}`);
}

function isAccepted(recipient: AtRecipient): boolean {
  // Africa's Talking uses statusCode 101 for an accepted SMS. Keep the status
  // check as a compatibility fallback for sandbox response variants.
  return Number(recipient.statusCode) === 101 || recipient.status?.toLowerCase() === 'success';
}

async function sendViaAfricasTalking(to: string, message: string): Promise<SmsResult> {
  const { apiKey, username, senderId, useSandbox, sandboxUrl, baseUrl } = config.africasTalking;
  if (!apiKey) {
    return { success: false, message: 'Africa\'s Talking API key is not configured', recipient: to };
  }

  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    return { success: false, message: 'Recipient must be an E.164 phone number (for example +256712345678)', recipient: to };
  }

  // Sandbox uses the fixed username "sandbox" and its own endpoint.
  // Do not allow a sandbox failure to spill into the live API.
  const activeUsername = useSandbox ? 'sandbox' : username.trim();
  if (!activeUsername || (!useSandbox && activeUsername.toLowerCase() === 'sandbox')) {
    return { success: false, message: 'A live Africa\'s Talking username is required when AT_USE_SANDBOX=false', recipient: to };
  }

  const endpoint = `${useSandbox ? sandboxUrl : baseUrl}/messaging`;
  const body = new URLSearchParams({
    username: activeUsername,
    to,
    message,
    bulkSMSMode: '1',
    enqueue: '0',
  });

  // A 502/503/504 means the gateway did not produce an acceptance response.
  // Retrying these is safe enough; do not retry connection resets because the
  // provider may have accepted the request before the connection was dropped.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        apikey: apiKey,
      };
      if (!useSandbox && senderId.trim()) body.set('from', senderId.trim());

      const response = await fetch(endpoint, {
        method: 'POST', headers, body: body.toString(), signal: AbortSignal.timeout(12_000),
      });
      const raw = await response.text();
      let payload: any = null;
      try { payload = JSON.parse(raw); } catch { /* provider may return plain text on gateway errors */ }

      if (!response.ok) {
        const providerMessage = payload?.SMSMessageData?.Message || payload?.errorMessage || raw || `HTTP ${response.status}`;
        const retryable = [502, 503, 504].includes(response.status);
        if (retryable && attempt < maxAttempts) {
          console.warn(`  ⚠️ Africa's Talking HTTP ${response.status}; retrying SMS (${attempt}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          continue;
        }
        return { success: false, message: `Africa's Talking HTTP ${response.status}: ${providerMessage}`, recipient: to };
      }

      const recipients: AtRecipient[] = payload?.SMSMessageData?.Recipients || [];
    const recipient = recipients.find((entry) => formatPhone(entry.number || '') === to) || recipients[0];

    if (!recipient) {
      return {
        success: false,
        message: payload?.SMSMessageData?.Message || 'Africa\'s Talking did not return a recipient result',
        recipient: to,
      };
    }

      const statusCode = Number(recipient.statusCode);
      const status = recipient.status || 'Unknown';
      const environment = useSandbox ? 'sandbox simulator' : 'live network';
      if (!isAccepted(recipient)) {
        const simulatorHint = useSandbox && (statusCode === 403 || status.toLowerCase().includes('invalidphone'))
          ? ' Open https://simulator.africastalking.com:1517/ and log in the exact destination number in a browser session before sending.'
          : '';
        return {
          success: false,
          message: `Africa's Talking rejected SMS (${environment}): ${status} [${statusCode || 'no code'}].${simulatorHint}`,
          recipient: recipient.number || to,
          messageId: recipient.messageId,
          statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
          status,
        };
      }

      return {
        success: true,
        message: `Africa's Talking accepted SMS for ${environment}: ${status} [${statusCode}]`,
        recipient: recipient.number || to,
        messageId: recipient.messageId,
        statusCode,
        status,
      };
    } catch (err) {
      const error = err as Error & { cause?: { code?: string } };
      const detail = error.name === 'TimeoutError'
        ? 'request timed out after 12 seconds'
        : error.cause?.code || error.message;
      return { success: false, message: `Africa's Talking network request failed: ${detail}`, recipient: to };
    }
  }

  return { success: false, message: 'Africa\'s Talking SMS request failed', recipient: to };
}

export async function sendTransferNotification(params: {
  phoneNumber: string;
  recipientName: string;
  amountUgx: number;
  amountUsdc: number;
  senderName: string;
}): Promise<SmsResult> {
  const phone = formatPhone(params.phoneNumber || '');
  if (!phone || phone === '+') return { success: false, message: 'No phone number provided' };

  const message = buildSmsContent({
    recipientName: params.recipientName,
    amountUgx: params.amountUgx,
    senderName: params.senderName,
  });

  const result = await sendViaAfricasTalking(phone, message);
  if (result.success) {
    console.log(`  ✅ SMS accepted by Africa's Talking (${config.africasTalking.useSandbox ? 'sandbox' : 'live'}) → ${result.recipient} [${result.messageId || 'no message id'}]`);
  } else {
    console.warn(`  ⚠️ SMS was not accepted: ${result.message}`);
    logToConsole(phone, message);
  }
  return result;
}

// SMS must never block a transfer, but failures are now truthful in the logs.
export async function sendTransferNotificationAsync(params: {
  phoneNumber: string;
  recipientName: string;
  amountUgx: number;
  amountUsdc: number;
  senderName: string;
}): Promise<void> {
  try {
    await sendTransferNotification(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️ SMS unexpected error: ${msg}`);
  }
}
