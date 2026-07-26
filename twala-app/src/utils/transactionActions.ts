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

/** Shares a visual receipt card. Android Chrome can hand the PNG directly to WhatsApp. */
export async function shareReceiptOnWhatsApp(tx: TransactionItem): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const file = await createReceiptImage(tx);
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (file && shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))) {
      await shareNavigator.share({ files: [file], title: `HomeWard receipt ${receiptNumber(tx)}` });
      return;
    }
  }
  await shareOnWhatsApp(formatTransactionReceipt(tx));
}

async function createReceiptImage(tx: TransactionItem): Promise<File | null> {
  const canvas = document.createElement('canvas');
  const width = 1080;
  const height = 1400;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const receipt = receiptNumber(tx);
  const completed = tx.status === 'completed';
  const failed = tx.status === 'failed';
  const status = completed ? 'COMPLETED' : failed ? 'FAILED' : 'PENDING CONFIRMATION';
  const statusBackground = completed ? '#D7F5E9' : failed ? '#FFDAD6' : '#FFDDB5';
  const statusColor = completed ? '#004336' : failed ? '#93000A' : '#694300';
  const details = [
    [tx.type === 'sent' ? 'Recipient' : 'Source', tx.recipientName || 'HomeWard wallet'],
    ...(tx.recipientPhone ? [['Mobile', tx.recipientPhone]] : []),
    ...(tx.recipientNetwork ? [['Network', tx.recipientNetwork]] : []),
    ['Purpose', tx.purpose || 'Transfer'],
    ['Receipt', receipt],
    ['Date', new Date(tx.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' })],
    ...(tx.stellarTxHash ? [['Stellar transaction', `${tx.stellarTxHash.slice(0, 18)}...${tx.stellarTxHash.slice(-12)}`]] : []),
  ];

  context.fillStyle = '#F6FAFE';
  context.fillRect(0, 0, width, height);
  roundRect(context, 70, 70, 940, 1260, 42, '#FFFFFF');
  roundRect(context, 70, 70, 940, 365, 42, '#004336');
  context.fillStyle = '#FFFFFF';
  context.font = '800 28px Arial';
  context.textAlign = 'center';
  context.fillText('HOMEWARD', width / 2, 142);
  context.fillStyle = '#A6F1D9';
  context.font = '400 26px Arial';
  context.fillText('Transaction receipt', width / 2, 190);
  context.fillStyle = '#FFFFFF';
  context.font = '800 57px Arial';
  context.fillText(`$${tx.amountUsdc.toFixed(2)} USDC`, width / 2, 270);
  context.font = '400 30px Arial';
  context.fillText(tx.amountUgx ? `UGX ${tx.amountUgx.toLocaleString()}` : 'UGX value unavailable', width / 2, 320);

  roundRect(context, 350, 405, 380, 56, 28, statusBackground);
  context.fillStyle = statusColor;
  context.font = '800 22px Arial';
  context.fillText(status, width / 2, 441);

  let y = 515;
  context.textAlign = 'left';
  details.forEach(([label, value], index) => {
    context.fillStyle = '#6F7975';
    context.font = '400 24px Arial';
    context.fillText(label, 125, y);
    context.fillStyle = '#171C1F';
    context.font = '700 24px Arial';
    const lines = wrapCanvasText(context, value, 500);
    context.textAlign = 'right';
    lines.forEach((line, lineIndex) => context.fillText(line, 950, y + lineIndex * 30));
    context.textAlign = 'left';
    const rowHeight = Math.max(58, lines.length * 30 + 25);
    if (index < details.length - 1) {
      context.strokeStyle = '#EAEFF1';
      context.lineWidth = 2;
      context.beginPath(); context.moveTo(125, y + 25); context.lineTo(950, y + 25); context.stroke();
    }
    y += rowHeight;
  });
  context.fillStyle = '#6F7975';
  context.font = '400 21px Arial';
  context.textAlign = 'center';
  context.fillText('Keep this receipt for your records.', width / 2, 1265);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], `${receipt}.png`, { type: 'image/png' }) : null;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  return lines;
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
