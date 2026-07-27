const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.defineLayout({ name: 'HOMEWARD', width: 13.333, height: 7.5 });
pptx.layout = 'HOMEWARD';
pptx.author = 'HomeWard Team';
pptx.company = 'HomeWard';
pptx.subject = 'HomeWard pitch deck';
pptx.title = 'HomeWard - Purpose, proof and peace of mind';
pptx.lang = 'en-US';
pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US' };

const C = { navy: '063A45', green: '008A68', mint: 'DFF7EA', lime: 'C9F04A', cream: 'F7F8F4', white: 'FFFFFF', ink: '123039', muted: '60767A', line: 'D9E6E1', amber: 'F2B84B', rose: 'D76464', sky: 'DCEFF6' };
const S = pptx.ShapeType;
const HERO_IMAGE = 'C:/Users/Raheem/Desktop/Twala/homeward-anxious-uae-youth.png';
function slide(dark = false) { const s = pptx.addSlide(); s.background = { color: dark ? C.navy : C.cream }; return s; }
function rect(s, x, y, w, h, color, radius = 0.16) { s.addShape(S.roundRect, { x, y, w, h, rectRadius: radius, fill: { color }, line: { color, transparency: 100 } }); }
function txt(s, value, x, y, w, h, o = {}) { s.addText(value, { x, y, w, h, margin: o.margin ?? 0, fontFace: o.fontFace || 'Aptos', fontSize: o.fontSize || 14, color: o.color || C.ink, bold: o.bold || false, align: o.align || 'left', valign: o.valign || 'mid', breakLine: false, fit: 'shrink', paraSpaceAfterPt: 0, ...o }); }
function tag(s, value, x, y, w, dark = false) { rect(s, x, y, w, 0.32, dark ? '0D5A57' : C.mint); txt(s, value.toUpperCase(), x, y + 0.02, w, 0.18, { fontSize: 8.5, bold: true, color: dark ? C.lime : C.green, align: 'center', charSpacing: 1.1 }); }
function header(s, kicker, title, sub = '') { txt(s, kicker.toUpperCase(), 0.72, 0.38, 4.5, 0.18, { fontSize: 8.5, bold: true, color: C.green, charSpacing: 1.4 }); txt(s, title, 0.72, 0.72, 11.8, 0.62, { fontSize: 27, bold: true, color: C.navy }); if (sub) txt(s, sub, 0.72, 1.48, 11.3, 0.34, { fontSize: 12.5, color: C.muted }); s.addShape(S.line, { x: 0.72, y: 2.03, w: 11.86, h: 0, line: { color: C.line, width: 1 } }); }
function footer(s, number) { txt(s, 'HOMEWARD  |  DEVFEST BLOCKCHAIN HACKATHON', 0.72, 7.08, 4.8, 0.15, { fontSize: 7.5, color: C.muted, charSpacing: 0.6 }); txt(s, String(number).padStart(2, '0'), 12.1, 7.06, 0.4, 0.15, { fontSize: 8, color: C.muted, align: 'right' }); }
function dot(s, x, y, color) { s.addShape(S.ellipse, { x, y, w: 0.12, h: 0.12, fill: { color }, line: { color, transparency: 100 } }); }

// 1. Killer hook
{
  const s = slide(true);
  s.addImage({ path: HERO_IMAGE, x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addShape(S.rect, { x: 0, y: 0, w: 8.2, h: 7.5, fill: { color: '061E25', transparency: 5 }, line: { color: '061E25', transparency: 100 } });
  s.addShape(S.arc, { x: 8.25, y: -1.15, w: 6.1, h: 6.1, adjustPoint: 0.25, fill: { color: C.navy, transparency: 100 }, line: { color: C.green, transparency: 25, width: 11 } });
  s.addShape(S.arc, { x: 9.2, y: 3.1, w: 4.4, h: 4.4, adjustPoint: 0.25, fill: { color: C.navy, transparency: 100 }, line: { color: C.lime, transparency: 25, width: 7 } });
  tag(s, 'A 60-second story', 0.75, 0.65, 1.65, true);
  txt(s, 'Sunday sends money home\nevery month.', 0.75, 1.42, 7.1, 0.95, { fontSize: 33, bold: true, color: C.white, breakLine: true, valign: 'top' });
  txt(s, 'But after pressing send, she still asks:', 0.78, 2.72, 6.1, 0.3, { fontSize: 16, color: 'C9E6DE' });
  txt(s, '"Did it reach the right person?\nWhat did it actually achieve?"', 0.78, 3.28, 6.7, 0.78, { fontSize: 23, bold: true, color: C.lime, breakLine: true, valign: 'top' });
  rect(s, 0.75, 5.35, 5.5, 0.78, '0D5A57');
  txt(s, 'HomeWard turns a transfer into a\ntrusted family commitment.', 1.0, 5.51, 5.0, 0.4, { fontSize: 15, bold: true, color: C.white, breakLine: true, align: 'center' });
  txt(s, 'HOMEWARD', 0.75, 6.72, 3.0, 0.25, { fontSize: 13, bold: true, color: C.white, charSpacing: 1.5 });
  txt(s, 'Purpose. Proof. Peace of mind.', 8.2, 6.72, 3.9, 0.2, { fontSize: 10, color: 'C9E6DE', align: 'center' });
}

// 2. Problem
{
  const s = slide(); header(s, 'The problem', 'The hidden cost of remittance is uncertainty.', 'Families are not only paying fees. They are carrying anxiety after every transfer.');
  const cards = [
    ['Wrong-recipient fear', 'A number can be wrong, changed, or shared. The sender needs confidence before money moves.', C.rose],
    ['Invisible family outcomes', 'School fees, rent, land and medicine disappear into a generic transaction history.', C.amber],
    ['Language and literacy barriers', 'Financial English and complex screens exclude users who prefer local languages or voice.', C.green],
  ];
  cards.forEach((c, i) => { const x = 0.75 + i * 4.05; rect(s, x, 2.58, 3.55, 2.85, C.white); dot(s, x + 0.28, 2.93, c[2]); txt(s, `0${i + 1}`, x + 0.52, 2.86, 0.45, 0.22, { fontSize: 11, bold: true, color: C.muted }); txt(s, c[0], x + 0.28, 3.45, 2.9, 0.35, { fontSize: 17, bold: true, color: C.navy }); txt(s, c[1], x + 0.28, 4.0, 2.95, 0.85, { fontSize: 12.5, color: C.muted, valign: 'top' }); });
  rect(s, 0.75, 5.86, 11.82, 0.58, C.mint); txt(s, 'A transfer should feel like a promise kept - not a message sent into the dark.', 1.0, 6.03, 11.3, 0.2, { fontSize: 15, bold: true, color: C.navy, align: 'center' }); footer(s, 2);
}

// 3. Solution
{
  const s = slide(); header(s, 'The solution', 'HomeWard makes family support visible, safer, and easier to understand.');
  const features = [
    ['Trusted Recipient Passport', 'Full name, phone, network, relationship, history and changed-detail warning.'],
    ['Purpose-led transfer', 'Show the expected UGX, fee, rate and reason before the sender confirms.'],
    ['Goals and Circles', 'Organise school fees, land, construction and recurring family support.'],
    ['Proof after payment', 'Receipt, history, SMS sandbox update and independently verifiable Stellar proof.'],
  ];
  features.forEach((f, i) => { const x = 0.75 + (i % 2) * 6.0; const y = 2.48 + Math.floor(i / 2) * 1.55; rect(s, x, y, 5.58, 1.2, C.white); rect(s, x + 0.23, y + 0.25, 0.52, 0.52, i === 2 ? C.lime : C.mint); txt(s, String(i + 1), x + 0.23, y + 0.34, 0.52, 0.16, { fontSize: 11, bold: true, color: C.green, align: 'center' }); txt(s, f[0], x + 0.98, y + 0.2, 4.15, 0.26, { fontSize: 15.5, bold: true, color: C.navy }); txt(s, f[1], x + 0.98, y + 0.58, 4.2, 0.36, { fontSize: 11.5, color: C.muted, valign: 'top' }); }); footer(s, 3);
}

// 4. Sunbird
{
  const s = slide(true);
  tag(s, 'Inclusive by design', 0.75, 0.6, 1.52, true);
  txt(s, 'A money app should not\nrequire financial English.', 0.75, 1.26, 6.8, 0.92, { fontSize: 31, bold: true, color: C.white, breakLine: true, valign: 'top' });
  txt(s, 'HomeWard integrates Sunbird AI so people can navigate and ask for help in familiar Ugandan languages.', 0.78, 2.58, 6.0, 0.58, { fontSize: 15.5, color: 'C9E6DE', valign: 'top' });
  const items = [['Choose Luganda', 'Persistent language across core screens'], ['Speak naturally', 'Speech-to-text for the assistant'], ['Hear guidance', 'Text-to-speech support'], ['Stay in control', 'Voice and AI never bypass confirmation']];
  items.forEach((a, i) => { const y = 3.65 + i * 0.65; dot(s, 0.85, y + 0.11, C.lime); txt(s, a[0], 1.15, y, 2.0, 0.2, { fontSize: 13.5, bold: true, color: C.white }); txt(s, a[1], 3.25, y, 3.2, 0.2, { fontSize: 11.5, color: 'C9E6DE' }); });
  rect(s, 8.25, 1.3, 3.5, 4.55, '0D5A57');
  txt(s, 'SUNBIRD AI', 8.65, 1.85, 2.7, 0.25, { fontSize: 16, bold: true, color: C.lime, align: 'center', charSpacing: 1 });
  txt(s, 'Language is not\na feature.\nIt is access.', 8.62, 2.72, 2.75, 1.05, { fontSize: 23, bold: true, color: C.white, align: 'center', breakLine: true });
  txt(s, 'Translation\nConversation\nSpeech in\nSpeech out', 8.82, 4.33, 2.35, 0.7, { fontSize: 12, color: 'C9E6DE', align: 'center', breakLine: true });
  txt(s, 'HomeWard | Sunbird AI', 0.75, 6.75, 3.0, 0.18, { fontSize: 8.5, color: 'C9E6DE' });
}

// 5. Stellar proof
{
  const s = slide(); header(s, 'The blockchain moment', 'Judges can inspect the proof - not just trust the interface.', 'HomeWard provisions a user wallet and sends Test USDC on Stellar Testnet.');
  rect(s, 0.75, 2.5, 5.5, 3.35, C.navy);
  txt(s, 'LIVE IN THE DEMO', 1.1, 2.9, 2.0, 0.18, { fontSize: 9.5, bold: true, color: C.lime, charSpacing: 1 });
  txt(s, 'Test USDC moves\non Stellar Testnet.', 1.1, 3.35, 4.25, 0.75, { fontSize: 25, bold: true, color: C.white, breakLine: true, valign: 'top' });
  txt(s, 'Each successful transfer exposes its transaction hash and a one-tap Stellar explorer link.', 1.1, 4.55, 4.1, 0.5, { fontSize: 12.5, color: 'C9E6DE', valign: 'top' });
  const proof = [['1', 'User wallet', 'Individual Testnet wallet and USDC trustline'], ['2', 'On-chain transfer', 'Stellar transaction is submitted'], ['3', 'Independent receipt', 'Hash opens in Stellar Expert Testnet']];
  proof.forEach((p, i) => { const y = 2.5 + i * 1.12; rect(s, 7.0, y, 5.5, 0.91, C.white); rect(s, 7.25, y + 0.22, 0.42, 0.42, C.mint); txt(s, p[0], 7.25, y + 0.32, 0.42, 0.12, { fontSize: 10, bold: true, color: C.green, align: 'center' }); txt(s, p[1], 7.95, y + 0.14, 2.8, 0.2, { fontSize: 14, bold: true, color: C.navy }); txt(s, p[2], 7.95, y + 0.45, 3.9, 0.16, { fontSize: 10.5, color: C.muted }); }); footer(s, 5);
}

// 6. Flow
{
  const s = slide(); header(s, 'Production journey', 'One simple experience. Licensed partners handle regulated steps.', 'HomeWard is the trust and experience layer - not a bank or unlicensed money transmitter.');
  const flow = [['1', 'Save recipient', 'Passport + purpose'], ['2', 'Fund abroad', 'Approved partner\nKYC + AED'], ['3', 'Settle value', 'USDC on Stellar'], ['4', 'Deliver UGX', 'Licensed partner\nMTN / Airtel'], ['5', 'Keep proof', 'Receipt + history']];
  flow.forEach((f, i) => { const x = 0.55 + i * 2.55; rect(s, x, 2.72, 2.1, 2.15, i === 2 ? C.navy : C.white); tag(s, f[0], x + 0.2, 2.98, 0.4, i === 2); txt(s, f[1], x + 0.2, 3.62, 1.7, 0.34, { fontSize: 14, bold: true, color: i === 2 ? C.white : C.navy, align: 'center' }); txt(s, f[2], x + 0.2, 4.13, 1.7, 0.38, { fontSize: 10.5, color: i === 2 ? 'C9E6DE' : C.muted, align: 'center', breakLine: true }); if (i < 4) s.addShape(S.chevron, { x: x + 2.15, y: 3.67, w: 0.25, h: 0.3, fill: { color: C.green }, line: { color: C.green, transparency: 100 } }); });
  rect(s, 0.75, 5.55, 11.8, 0.65, C.mint); txt(s, 'Today: real Stellar Testnet proof. Production: funding, FX, custody and payout only through regulated partners.', 1.0, 5.75, 11.3, 0.2, { fontSize: 13.5, bold: true, color: C.navy, align: 'center' }); footer(s, 6);
}

// 7. Safety
{
  const s = slide(); header(s, 'Why users can trust it', 'HomeWard makes the sender slow down at the moments that matter.');
  const items = [['Recipient Passport', 'Known person, relationship, network, history and details-change warning.'], ['Smart guardrails', 'Warn on unfamiliar recipients, changed details, large transfers or missed plans.'], ['Human confirmation', 'AI can explain and prepare. The user must explicitly confirm payment.'], ['Private by default', 'User-scoped wallets, history, recipients, Goals, Circles and chats.']];
  items.forEach((a, i) => { const x = 0.75 + (i % 2) * 6.02; const y = 2.45 + Math.floor(i / 2) * 1.52; rect(s, x, y, 5.58, 1.2, C.white); dot(s, x + 0.28, y + 0.32, [C.green, C.amber, C.rose, C.green][i]); txt(s, a[0], x + 0.55, y + 0.2, 3.9, 0.24, { fontSize: 15.5, bold: true, color: C.navy }); txt(s, a[1], x + 0.55, y + 0.58, 4.45, 0.35, { fontSize: 11.5, color: C.muted, valign: 'top' }); }); footer(s, 7);
}

// 8. Traction
{
  const s = slide(); header(s, 'Traction', 'We have shipped proof - not just a concept.', 'We are deliberately reporting product evidence instead of inventing user-growth numbers before a regulated pilot.');
  const proof = [
    ['LIVE', 'Mobile-first deployed experience', 'Judges can open HomeWard on a phone, register, and complete the core journey.'],
    ['REAL', 'Stellar Testnet settlement', 'Individual wallets, Test USDC transfers, hashes and explorer links are in the demo.'],
    ['BUILT', 'Family-support operating system', 'Recipient Passports, Goals, Circles, receipts, filters, notifications and transfer guardrails.'],
    ['ACCESSIBLE', 'Sunbird AI language layer', 'Luganda interface coverage plus speech and conversational support when configured.'],
  ];
  proof.forEach((p, i) => { const x = 0.75 + (i % 2) * 6.02; const y = 2.45 + Math.floor(i / 2) * 1.55; rect(s, x, y, 5.58, 1.2, C.white); tag(s, p[0], x + 0.23, y + 0.22, 0.88, i === 1); txt(s, p[1], x + 1.35, y + 0.2, 3.7, 0.25, { fontSize: 15, bold: true, color: C.navy }); txt(s, p[2], x + 1.35, y + 0.57, 3.9, 0.38, { fontSize: 11.3, color: C.muted, valign: 'top' }); });
  rect(s, 0.75, 5.75, 11.8, 0.58, C.mint); txt(s, 'Next traction milestone: a regulated UAE-to-Uganda pilot with repeat family-support behavior measured in the field.', 1.0, 5.93, 11.3, 0.18, { fontSize: 13.5, bold: true, color: C.navy, align: 'center' }); footer(s, 8);
}

// 9. Roadmap and ask
{
  const s = slide(); header(s, 'From proof to pilot', 'Our next milestone is not more screens. It is a regulated, user-tested corridor.');
  const blocks = [['NOW', 'Prove the experience', 'Stellar Testnet, Recipient Passport, Goals, Circles, Sunbird access and safety guardrails.'], ['NEXT', 'Prove demand', 'Test with UAE-Uganda families and validate language, trust and repeat-support behavior.'], ['THEN', 'Prove delivery', 'Integrate approved funding and Uganda mobile-money payout partners for a regulated pilot.']];
  blocks.forEach((b, i) => { const x = 0.75 + i * 4.05; rect(s, x, 2.55, 3.55, 2.88, C.white); tag(s, b[0], x + 0.25, 2.85, 0.82, i === 1); txt(s, b[1], x + 0.25, 3.56, 2.9, 0.33, { fontSize: 18, bold: true, color: C.navy }); txt(s, b[2], x + 0.25, 4.15, 2.9, 0.72, { fontSize: 12, color: C.muted, valign: 'top' }); });
  txt(s, 'We are looking for: pilot users, regulated funding/payout partners, and mentors in diaspora finance and accessibility.', 1.0, 5.95, 11.2, 0.28, { fontSize: 14, bold: true, color: C.green, align: 'center' }); footer(s, 9);
}

// 10. Close
{
  const s = slide(true);
  tag(s, 'The final thought', 0.75, 0.65, 1.55, true);
  txt(s, 'When money goes home,\nconfidence should go with it.', 0.75, 1.38, 7.25, 1.0, { fontSize: 34, bold: true, color: C.white, breakLine: true, valign: 'top' });
  txt(s, 'HomeWard gives every family transfer a reason, a record, a language people understand, and proof that judges can verify.', 0.78, 2.88, 6.45, 0.64, { fontSize: 16, color: 'C9E6DE', valign: 'top' });
  rect(s, 8.15, 1.2, 3.75, 4.6, '0D5A57');
  txt(s, 'HOMEWARD', 8.55, 1.82, 2.95, 0.3, { fontSize: 23, bold: true, color: C.white, align: 'center', charSpacing: 1.2 });
  txt(s, 'Purpose\nProof\nPeace of mind', 8.55, 2.72, 2.95, 0.9, { fontSize: 22, bold: true, color: C.lime, align: 'center', breakLine: true });
  s.addShape(S.line, { x: 8.82, y: 4.05, w: 2.4, h: 0, line: { color: '5EA994', width: 1 } });
  txt(s, 'Kamwanga Raheem\nKisakye Abigail\nSunday Emmanuel Lugai', 8.55, 4.43, 2.95, 0.54, { fontSize: 11.5, color: C.white, align: 'center', breakLine: true });
  txt(s, 'Thank you', 0.78, 6.7, 1.5, 0.2, { fontSize: 13, bold: true, color: C.lime });
  txt(s, 'HomeWard | DevFest Blockchain Hackathon', 8.28, 6.72, 3.5, 0.15, { fontSize: 8.5, color: 'C9E6DE', align: 'center' });
}

pptx.writeFile({ fileName: 'C:/Users/Raheem/Desktop/Twala/HomeWard_DevFest_Winning_Pitch_Deck.pptx' });
