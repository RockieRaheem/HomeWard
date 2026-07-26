import { Linking, Platform, Share } from 'react-native';
import type { TransactionItem } from '../services/api';

function receiptNumber(tx: TransactionItem): string {
  return `HW-${tx.id.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

export function formatTransactionReceipt(tx: TransactionItem, title = 'HOMEWARD RECEIPT'): string {
  const direction = tx.type === 'sent' ? 'Sent' : 'Received';
  const ugx = tx.amountUgx ? `UGX ${tx.amountUgx.toLocaleString()}` : '—';
  return [
    title,
    '',
    `${direction}: $${tx.amountUsdc.toFixed(2)} USDC`,
    `UGX value: ${ugx}`,
    `Recipient: ${tx.recipientName || 'HomeWard wallet'}`,
    tx.recipientPhone ? `Mobile: ${tx.recipientPhone}` : null,
    tx.recipientNetwork ? `Network: ${tx.recipientNetwork}` : null,
    `Purpose: ${tx.purpose || 'Transfer'}`,
    `Status: ${tx.status.toUpperCase()}`,
    `Receipt: ${receiptNumber(tx)}`,
    `Date: ${new Date(tx.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}`,
    tx.stellarTxHash ? `Stellar transaction: ${tx.stellarTxHash}` : null,
  ].filter(Boolean).join('\n');
}

export async function shareOnWhatsApp(text: string): Promise<void> {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

export async function downloadText(filename: string, text: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ title: filename, message: text });
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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

