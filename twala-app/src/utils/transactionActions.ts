import { Linking, Platform, Share } from 'react-native';
import type { TransactionItem } from '../services/api';

function receiptNumber(tx: TransactionItem): string {
  return `HW-${tx.id.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

export function formatTransactionReceipt(tx: TransactionItem, title = 'HOMEWARD RECEIPT'): string {
  const direction = tx.type === 'sent' ? 'Sent' : 'Received';
  const ugx = tx.amountUgx ? `UGX ${tx.amountUgx.toLocaleString()}` : '—';
  return [
    `*${title}*`,
    '',
    `_${direction} successfully_`,
    `*${tx.type === 'sent' ? 'Amount sent' : 'Amount received'}:* $${tx.amountUsdc.toFixed(2)} USDC`,
    `*UGX value:* ${ugx}`,
    '──────────────────',
    `*Recipient:* ${tx.recipientName || 'HomeWard wallet'}`,
    tx.recipientPhone ? `Mobile: ${tx.recipientPhone}` : null,
    tx.recipientNetwork ? `Network: ${tx.recipientNetwork}` : null,
    `Purpose: ${tx.purpose || 'Transfer'}`,
    `*Status:* ${tx.status.toUpperCase()}`,
    `*Receipt:* ${receiptNumber(tx)}`,
    `*Date:* ${new Date(tx.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}`,
    tx.stellarTxHash ? `Stellar transaction: ${tx.stellarTxHash}` : null,
  ].filter(Boolean).join('\n');
}

export function formatTransactionReceiptHtml(tx: TransactionItem): string {
  const receipt = receiptNumber(tx);
  const status = tx.status === 'completed' ? 'Completed' : tx.status === 'failed' ? 'Failed' : 'Pending confirmation';
  const statusClass = tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending';
  const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
  const row = (label: string, value: string) => `<div class="row"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${receipt}</title><style>body{margin:0;background:#f6fafe;font-family:Arial,sans-serif;color:#171c1f;padding:28px}.receipt{max-width:520px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 36px #00201922}.hero{background:#004336;color:#fff;padding:30px;text-align:center}.brand{font-weight:800;letter-spacing:2px;font-size:13px}.sub{color:#a6f1d9;margin-top:8px;font-size:13px}.amount{font-size:30px;font-weight:800;margin-top:12px}.ugx{margin-top:5px}.body{padding:24px}.status{display:inline-block;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800}.success{background:#d7f5e9;color:#004336}.pending{background:#ffddb5;color:#694300}.failed{background:#ffdad6;color:#93000a}.rows{margin-top:20px;border:1px solid #d6dade;border-radius:16px;padding:8px 14px}.row{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid #eaeef2;font-size:14px}.row:last-child{border:0}.row span{color:#6f7975;flex:0 0 35%}.row strong{min-width:0;flex:1;text-align:right;overflow-wrap:anywhere;word-break:break-word}.footer{text-align:center;color:#6f7975;font-size:12px;padding-top:20px}@media(max-width:420px){body{padding:12px}.body{padding:16px}.row{gap:10px;font-size:13px}.row span{flex-basis:32%}}@media print{body{padding:0;background:#fff}.receipt{box-shadow:none}}</style></head><body><main class="receipt"><section class="hero"><div class="brand">HOMEWARD</div><div class="sub">Transaction receipt</div><div class="amount">$${tx.amountUsdc.toFixed(2)} USDC</div>${tx.amountUgx ? `<div class="ugx">UGX ${tx.amountUgx.toLocaleString()}</div>` : ''}</section><section class="body"><span class="status ${statusClass}">${status}</span><div class="rows">${row(tx.type === 'sent' ? 'Recipient' : 'Source', tx.recipientName || 'HomeWard wallet')}${tx.recipientPhone ? row('Mobile', tx.recipientPhone) : ''}${tx.recipientNetwork ? row('Network', tx.recipientNetwork) : ''}${row('Purpose', tx.purpose || 'Transfer')}${row('Receipt', receipt)}${row('Date', new Date(tx.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' }))}${tx.stellarTxHash ? row('Stellar transaction', tx.stellarTxHash) : ''}</div><div class="footer">Keep this receipt for your records.</div></section></main></body></html>`;
}

export async function shareOnWhatsApp(text: string): Promise<void> {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

export async function downloadText(filename: string, text: string): Promise<void> {
  await downloadFile(filename, text, 'text/plain;charset=utf-8');
}

export async function downloadReceipt(filename: string, tx: TransactionItem): Promise<void> {
  await downloadFile(filename, formatTransactionReceiptHtml(tx), 'text/html;charset=utf-8');
}

async function downloadFile(filename: string, text: string, mime: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ title: filename, message: text });
    return;
  }
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function downloadTransactions(filename: string, transactions: TransactionItem[]): Promise<void> {
  const csv = [
    ['Receipt', 'Date', 'Type', 'Recipient', 'Phone', 'Network', 'Purpose', 'USDC', 'UGX', 'Status', 'Stellar transaction'],
    ...transactions.map((tx) => [
      receiptNumber(tx), new Date(tx.createdAt).toISOString(), tx.type, tx.recipientName, tx.recipientPhone || '',
      tx.recipientNetwork || '', tx.purpose, tx.amountUsdc.toFixed(2), tx.amountUgx?.toString() || '', tx.status, tx.stellarTxHash || '',
    ]),
  ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  await downloadText(filename, csv);
}
