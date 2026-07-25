const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Twaala';
pptx.company = 'Twaala';
pptx.subject = 'Twaala pitch deck';
pptx.title = 'Twaala — Family money, made visible';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US'
};
pptx.defineLayout({ name: 'TWALA', width: 13.333, height: 7.5 });
pptx.layout = 'TWALA';

const C = {
  navy: '063A45', green: '0C8A68', mint: 'DFF7EA', lime: 'B8F23A', cream: 'F8F6F0',
  ink: '102A31', muted: '5F7177', line: 'D8E4E0', white: 'FFFFFF', amber: 'E9A23B', red: 'C85250'
};
const W = 13.333, H = 7.5;
const slide = () => {
  const s = pptx.addSlide();
  s.background = { color: C.cream };
  return s;
};
const box = (s, x, y, w, h, color, radius = 0.18) => s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: radius, fill: { color }, line: { color, transparency: 100 } });
const text = (s, t, x, y, w, h, opts = {}) => s.addText(t, { x, y, w, h, fontFace: opts.fontFace || 'Aptos', fontSize: opts.fontSize || 16, color: opts.color || C.ink, bold: opts.bold || false, breakLine: false, margin: opts.margin ?? 0, valign: opts.valign || 'mid', align: opts.align || 'left', fit: 'shrink', paraSpaceAfterPt: 0, ...opts });
const title = (s, kicker, heading, sub = '') => {
  text(s, kicker.toUpperCase(), 0.7, 0.42, 5.5, 0.24, { fontSize: 9, bold: true, color: C.green, charSpacing: 1.5 });
  text(s, heading, 0.7, 0.75, 11.6, 0.72, { fontSize: 29, bold: true, color: C.navy });
  if (sub) text(s, sub, 0.7, 1.53, 11.6, 0.46, { fontSize: 13, color: C.muted });
  s.addShape(pptx.ShapeType.line, { x: 0.7, y: 2.08, w: 11.93, h: 0, line: { color: C.line, width: 1 } });
};
const pill = (s, t, x, y, w, color = C.mint, txtColor = C.green) => { box(s, x, y, w, 0.35, color); text(s, t, x, y + 0.02, w, 0.28, { fontSize: 9.5, bold: true, color: txtColor, align: 'center' }); };
const footer = (s, n) => { text(s, 'TWĀALA  •  CONFIDENTIAL HACKATHON PITCH', 0.7, 7.08, 4.5, 0.18, { fontSize: 7.5, color: C.muted, charSpacing: 0.7 }); text(s, String(n).padStart(2, '0'), 12.1, 7.05, 0.45, 0.2, { fontSize: 8, color: C.muted, align: 'right' }); };
const arrow = (s, x, y, w, color = C.green) => s.addShape(pptx.ShapeType.chevron, { x, y, w, h: 0.32, fill: { color }, line: { color, transparency: 100 } });

// 1
{
  const s = slide();
  s.background = { color: C.navy };
  s.addShape(pptx.ShapeType.arc, { x: 8.1, y: -1.3, w: 6.2, h: 6.2, adjustPoint: 0.25, line: { color: C.green, transparency: 25, width: 11 }, fill: { color: C.navy, transparency: 100 } });
  s.addShape(pptx.ShapeType.arc, { x: 9.2, y: 2.9, w: 4.7, h: 4.7, adjustPoint: 0.25, line: { color: C.lime, transparency: 22, width: 7 }, fill: { color: C.navy, transparency: 100 } });
  pill(s, 'DEVFEST BLOCKCHAIN HACKATHON', 0.72, 0.74, 2.45, '0F5D58', C.lime);
  text(s, 'TWĀALA', 0.72, 1.58, 6, 0.74, { fontSize: 38, bold: true, color: C.white, charSpacing: 1 });
  text(s, 'Family money, made visible.', 0.72, 2.41, 7.3, 0.62, { fontSize: 27, bold: true, color: C.lime });
  text(s, 'A purpose-led way for diaspora families to fund what matters at home — with transparent Stellar settlement and mobile-money delivery.', 0.72, 3.26, 6.8, 0.85, { fontSize: 16, color: 'D5E8E1', breakLine: true, valign: 'top' });
  box(s, 0.72, 5.52, 4.2, 0.88, '0F5D58');
  text(s, 'Dubai → Uganda\nUSDC on Stellar → UGX mobile money', 1.0, 5.68, 3.75, 0.5, { fontSize: 14, color: C.white, bold: true, breakLine: true, valign: 'mid' });
  text(s, 'DEVFEST 2026', 0.72, 6.86, 2.0, 0.2, { fontSize: 9, color: 'B5D7CE', charSpacing: 1.2 });
}

// 2
{
  const s = slide(); title(s, 'The problem', 'Sending money home is fast — but family outcomes are invisible.', 'Diaspora workers need confidence that a transfer reached the right person, for the intended purpose.');
  const cards = [
    ['Fragmented journeys', 'Workers move between banks, cash agents, wallets and mobile money — often with unclear fees and status.'],
    ['Low trust after send', '“I sent it” is not the same as knowing Mum received it, what it funded, or having a lasting receipt.'],
    ['Generic remittance', 'Most products optimize the transaction, not family goals: school fees, construction milestones and emergencies.'],
  ];
  cards.forEach((c, i) => { const x = 0.72 + i * 4.08; box(s, x, 2.55, 3.63, 2.72, C.white); text(s, `0${i + 1}`, x + 0.25, 2.82, 0.5, 0.3, { fontSize: 12, bold: true, color: C.green }); text(s, c[0], x + 0.25, 3.25, 3.05, 0.38, { fontSize: 18, bold: true, color: C.navy }); text(s, c[1], x + 0.25, 3.85, 3.05, 0.95, { fontSize: 13, color: C.muted, valign: 'top' }); });
  box(s, 0.72, 5.75, 11.8, 0.68, C.mint); text(s, 'The opportunity: make every remittance a verified family commitment — not just another payment.', 1.0, 5.91, 11.2, 0.28, { fontSize: 16, bold: true, color: C.navy, align: 'center' }); footer(s, 2);
}

// 3
{
  const s = slide(); title(s, 'The solution', 'Twaala turns “send money” into a trusted family-money experience.');
  const items = [
    ['Recipient Passport', 'Saved full name, verified phone, network, relationship and delivery preference.'],
    ['Purpose-first transfers', 'Send against a real family need: school fees, building milestones, savings or emergency support.'],
    ['Proof, not promises', 'A receipt, settlement status and a Stellar transaction link make the flow auditable.'],
    ['Family memory', 'Goals and transfer history turn scattered remittances into a shared record of progress.'],
  ];
  items.forEach((it, i) => { const x = 0.75 + (i % 2) * 6.0; const y = 2.5 + Math.floor(i / 2) * 1.58; box(s, x, y, 5.62, 1.22, C.white); box(s, x + 0.22, y + 0.23, 0.6, 0.6, i % 2 ? C.mint : 'E9F4F0'); text(s, String(i + 1), x + 0.22, y + 0.31, 0.6, 0.22, { fontSize: 13, bold: true, color: C.green, align: 'center' }); text(s, it[0], x + 1.02, y + 0.22, 4.2, 0.26, { fontSize: 16, bold: true, color: C.navy }); text(s, it[1], x + 1.02, y + 0.58, 4.25, 0.38, { fontSize: 11.5, color: C.muted, valign: 'top' }); });
  footer(s, 3);
}

// 4
{
  const s = slide(); title(s, 'Customer journey', 'One simple journey; specialized partners behind the scenes.');
  const flow = [
    ['1', 'Choose beneficiary', 'Recipient Passport\n+ purpose'],
    ['2', 'Fund wallet', 'Transak checkout\nKYC + payment'],
    ['3', 'Move USDC', 'Stellar\nfast settlement'],
    ['4', 'Deliver UGX', 'Kotani / licensed\npayout partner'],
    ['5', 'Keep proof', 'Receipt, status\n+ family history'],
  ];
  flow.forEach((f, i) => { const x = 0.58 + i * 2.52; box(s, x, 2.72, 2.05, 2.2, i === 2 ? C.navy : C.white); box(s, x + 0.18, 2.93, 0.43, 0.43, i === 2 ? C.lime : C.mint); text(s, f[0], x + 0.18, 3.02, 0.43, 0.18, { fontSize: 10, bold: true, color: i === 2 ? C.navy : C.green, align: 'center' }); text(s, f[1], x + 0.18, 3.65, 1.67, 0.38, { fontSize: 15, bold: true, color: i === 2 ? C.white : C.navy, align: 'center' }); text(s, f[2], x + 0.18, 4.17, 1.67, 0.42, { fontSize: 10.5, color: i === 2 ? 'C7E9E0' : C.muted, align: 'center', breakLine: true }); if (i < 4) arrow(s, x + 2.13, 3.73, 0.28, C.green); });
  text(s, 'Twaala owns the experience, beneficiary intelligence and proof layer. Regulated partners perform fiat funding, KYC, FX, custody and payout.', 1.1, 5.68, 11.15, 0.54, { fontSize: 14, color: C.muted, align: 'center' }); footer(s, 4);
}

// 5
{
  const s = slide(); title(s, 'Blockchain that judges can verify', 'Stellar is not a background claim. It is part of the live demo.');
  box(s, 0.75, 2.58, 5.62, 3.32, C.navy); text(s, 'LIVE DEMO', 1.08, 2.93, 1.3, 0.22, { fontSize: 10, bold: true, color: C.lime, charSpacing: 1 }); text(s, 'Every proof starts\non Stellar Testnet.', 1.08, 3.36, 4.55, 0.9, { fontSize: 26, bold: true, color: C.white, breakLine: true, valign: 'top' }); text(s, 'Fund demo wallet → issue test USDC → send payment → open Stellar Expert link → inspect ledger, hash and memo.', 1.08, 4.67, 4.45, 0.66, { fontSize: 13, color: 'C7E9E0', breakLine: true, valign: 'top' });
  const proof = [['Immutable transaction hash', 'No fabricated demo hashes'], ['Horizon verification', 'Transaction read back from the network'], ['Explorer receipt', 'One tap opens Stellar Expert Testnet']];
  proof.forEach((p, i) => { const y = 2.58 + i * 1.1; box(s, 7.05, y, 5.42, 0.9, C.white); box(s, 7.28, y + 0.22, 0.43, 0.43, C.mint); text(s, '✓', 7.28, y + 0.27, 0.43, 0.18, { fontSize: 12, bold: true, color: C.green, align: 'center' }); text(s, p[0], 7.95, y + 0.16, 3.9, 0.24, { fontSize: 14, bold: true, color: C.navy }); text(s, p[1], 7.95, y + 0.46, 3.9, 0.18, { fontSize: 10.5, color: C.muted }); }); footer(s, 5);
}

// 6
{
  const s = slide(); title(s, 'Why now', 'A practical stack makes the vision buildable without pretending Twaala is a bank.');
  const cols = [
    ['TWAALA', C.navy, ['Beneficiary experience', 'Purpose + goals', 'Receipts + notifications', 'Routing intelligence']],
    ['REGULATED PARTNERS', C.green, ['Transak: fiat-to-USDC checkout', 'Kotani: mobile-money delivery', 'KYC / AML / custody / FX', 'Local payout operations']],
    ['STELLAR', '197E9D', ['Low-cost settlement rail', 'USDC transport', 'Testnet proof for demo', 'Public-network path to launch']],
  ];
  cols.forEach((c, i) => { const x = 0.72 + i * 4.1; box(s, x, 2.55, 3.62, 3.5, C.white); box(s, x, 2.55, 3.62, 0.67, c[1]); text(s, c[0], x + 0.25, 2.77, 3.1, 0.2, { fontSize: 12, bold: true, color: C.white, align: 'center', charSpacing: 0.8 }); c[2].forEach((item, j) => { text(s, '•', x + 0.28, 3.55 + j * 0.53, 0.15, 0.2, { fontSize: 16, bold: true, color: c[1] }); text(s, item, x + 0.55, 3.53 + j * 0.53, 2.75, 0.25, { fontSize: 12, color: C.ink }); }); }); footer(s, 6);
}

// 7
{
  const s = slide(); title(s, 'Competitive edge', 'BOTIM and broad remittance apps move money. Twaala makes family money accountable.');
  const rows = [['Family-purpose transfers', 'Generic transfer', 'Goal-linked, named beneficiary, visible receipt'], ['Trust after send', 'Status only', 'Recipient Passport + proof + family history'], ['Blockchain role', 'Often invisible', 'Live, explorable Stellar settlement proof'], ['Expansion strategy', 'Many corridors first', 'Win UAE → Uganda family use cases; replicate by corridor']];
  box(s, 0.72, 2.45, 11.86, 0.57, C.navy); [['WHAT MATTERS', 0.98, 2.65, 3], ['BROAD REMITTANCE', 4.55, 2.65, 2.2], ['TWĀALA', 8.16, 2.65, 2.2]].forEach(h => text(s, h[0], h[1], h[2], h[3], 0.18, { fontSize: 10, bold: true, color: C.white, charSpacing: 0.8 }));
  rows.forEach((r, i) => { const y = 3.08 + i * 0.71; box(s, 0.72, y, 11.86, 0.62, i % 2 ? 'F0F5F2' : C.white); text(s, r[0], 0.98, y + 0.18, 3.0, 0.2, { fontSize: 11.5, bold: true, color: C.navy }); text(s, r[1], 4.55, y + 0.18, 2.7, 0.2, { fontSize: 11, color: C.muted }); text(s, r[2], 8.16, y + 0.16, 3.9, 0.24, { fontSize: 11, bold: true, color: C.green }); }); footer(s, 7);
}

// 8
{
  const s = slide(); title(s, 'Go-to-market', 'Start with one high-trust corridor, then earn the right to expand.');
  const steps = [
    ['NOW • HACKATHON', 'Prove behavior', 'Diaspora interview loop, beneficiary-first UX, Testnet settlement proof.'],
    ['NEXT • PILOT', 'Prove demand', 'UAE–Uganda community pilot with regulated on-ramp and payout partners.'],
    ['THEN • SCALE', 'Prove repeatability', 'Add new diaspora corridors and purpose-based verticals: school, construction, health.'],
  ];
  steps.forEach((st, i) => { const x = 0.75 + i * 4.05; box(s, x, 2.65, 3.56, 2.7, C.white); pill(s, st[0], x + 0.25, 2.95, 1.75, i === 1 ? C.lime : C.mint, C.navy); text(s, st[1], x + 0.25, 3.63, 2.9, 0.36, { fontSize: 19, bold: true, color: C.navy }); text(s, st[2], x + 0.25, 4.23, 2.88, 0.62, { fontSize: 12.5, color: C.muted, valign: 'top' }); });
  text(s, 'Target user: an East African diaspora worker who sends money home regularly and wants confidence, clarity and family progress.', 1.0, 5.93, 11.2, 0.42, { fontSize: 14, bold: true, color: C.green, align: 'center' }); footer(s, 8);
}

// 9
{
  const s = slide(); title(s, 'Demo script', 'A crisp 90-second experience for judges.');
  const script = [
    ['00:00', 'Create or select a recipient', 'Name, phone, MTN/Airtel, relationship and purpose.'],
    ['00:18', 'Open Transak checkout', 'Show the real partner-led KYC/payment experience when configured.'],
    ['00:38', 'Run Stellar Testnet proof', 'Issue test USDC and open the live transaction in Stellar Expert.'],
    ['00:58', 'Send to beneficiary', 'Create the on-chain USDC payment and start the payout status journey.'],
    ['01:18', 'Show family receipt', 'Amount, recipient, purpose, status and immutable proof link.'],
  ];
  script.forEach((r, i) => { const y = 2.38 + i * 0.76; text(s, r[0], 0.9, y + 0.12, 0.72, 0.22, { fontSize: 11, bold: true, color: C.green }); s.addShape(pptx.ShapeType.line, { x: 1.75, y: y + 0.24, w: 0.35, h: 0, line: { color: C.green, width: 2 } }); text(s, r[1], 2.35, y + 0.02, 2.9, 0.28, { fontSize: 14, bold: true, color: C.navy }); text(s, r[2], 5.45, y + 0.02, 6.3, 0.32, { fontSize: 12, color: C.muted }); });
  box(s, 0.75, 6.2, 11.8, 0.5, C.mint); text(s, 'Judge takeaway: Twaala has a human reason to exist, a credible regulated path, and blockchain proof they can inspect themselves.', 1.0, 6.33, 11.25, 0.2, { fontSize: 12.5, bold: true, color: C.navy, align: 'center' }); footer(s, 9);
}

// 10
{
  const s = slide(); s.background = { color: C.navy };
  pill(s, 'THE ASK', 0.75, 0.68, 1.0, '0F5D58', C.lime);
  text(s, 'Help us make family money\nmore trustworthy.', 0.75, 1.45, 7.3, 1.35, { fontSize: 35, bold: true, color: C.white, breakLine: true, valign: 'top' });
  text(s, 'We are seeking pilot users, regulated payout/on-ramp partners, and mentors who understand diaspora financial behavior.', 0.78, 3.14, 6.55, 0.65, { fontSize: 16, color: 'C7E9E0', valign: 'top' });
  box(s, 8.2, 1.18, 3.8, 4.55, '0F5D58');
  text(s, 'TWĀALA', 8.65, 1.75, 2.9, 0.38, { fontSize: 23, bold: true, color: C.white, align: 'center', charSpacing: 1 });
  text(s, 'Diaspora → family\nTrust → progress', 8.65, 2.65, 2.9, 0.7, { fontSize: 17, bold: true, color: C.lime, align: 'center', breakLine: true });
  s.addShape(pptx.ShapeType.line, { x: 8.78, y: 3.72, w: 2.62, h: 0, line: { color: '5CA78F', width: 1 } });
  text(s, 'A purpose-led remittance\nexperience on Stellar.', 8.65, 4.08, 2.9, 0.55, { fontSize: 13, color: C.white, align: 'center', breakLine: true });
  text(s, 'Thank you', 0.78, 6.63, 2.2, 0.25, { fontSize: 13, bold: true, color: C.lime });
  text(s, 'Twaala  •  DevFest Blockchain Hackathon', 8.4, 6.65, 3.6, 0.2, { fontSize: 8.5, color: 'B5D7CE', align: 'center' });
}

pptx.writeFile({ fileName: 'C:/Users/Raheem/Desktop/Twala/Twaala_DevFest_Pitch_Deck.pptx' });
