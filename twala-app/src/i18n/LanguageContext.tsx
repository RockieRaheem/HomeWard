import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { HomewardLanguage } from '../services/api';

export const HOMEWARD_LANGUAGES: HomewardLanguage[] = [
  { code: 'eng', name: 'English' }, { code: 'lug', name: 'Luganda' }, { code: 'ach', name: 'Acholi' },
  { code: 'teo', name: 'Ateso' }, { code: 'lgg', name: 'Lugbara' }, { code: 'nyn', name: 'Runyankole' }, { code: 'swa', name: 'Swahili' },
];

type LanguageContextValue = { language: HomewardLanguage['code']; setLanguage: (language: HomewardLanguage['code']) => void; languageName: string; t: (english: string) => string; };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'homeward-language';
const LUGANDA: Record<string, string> = {
  'Dashboard': 'Awaka', 'Goals': 'Ebigendererwa', 'Assistant': 'Muyambi', 'Transfer': 'Weereza', 'History': 'Ebyafaayo',
  'Choose your language': 'Londa olulimi lwo', 'This choice stays with HomeWard on this device.': 'Olulimi luno lujja kusigala mu HomeWard ku kyuma kino.',
  'Welcome Back': 'Tusanyuse okulaba neera', 'Send home. Stay connected.': 'Weereza awaka. Sigala nga muli wamu.', 'Set up your profile to start sending money': 'Teekateeka ebikwata ku ggwe otandike okuweereza ssente.', 'Enter your PIN to continue': 'Wandiika PIN yo okugenda mu maaso.',
  'Full Name': 'Amannya amatuufu', 'Phone Number (e.g. +256712345678)': 'Namba y’essimu (ng’ekyokulabirako +256712345678)', 'Create PIN (4-6 digits)': 'Tonda PIN (ennamba 4-6)', 'Confirm PIN': 'Kakasa PIN', 'Create Account': 'Ggulawo akawunti', 'Log In': 'Yingira', 'Already have an account? Log in': 'Olina akawunti dda? Yingira', "Don't have an account? Create one": 'Tolina akawunti? Ggulawo emu',
  'Good morning': 'Wasuze otya', 'Good afternoon': 'Osiibye otya', 'Good evening': 'Osiibye otya', 'Everything you send home, in one clear view.': 'Byonna by’oweereza awaka mu ndabika emu etegeerekeka.',
  'AVAILABLE TO SEND': 'SSENTE EZIRIWO OKUWEEREZA', 'USDC': 'USDC', 'Send money': 'Weereza ssente', 'Cash in': 'Teeka ssente', 'Ask HomeWard': 'Buuza HomeWard', 'Circles': 'Ebibiina',
  'Your goals': 'Ebigendererwa byo', 'See all': 'Laba byonna', 'Recent activity': 'Ebikoleddwa gye buvuddeko', 'View history': 'Laba ebyafaayo', 'Today’s exchange rate': 'Omuwendo gw’ensimbi ogwa leero',
  'Edit details': 'Kyusa ebikwata ku ggwe', 'My receipts': 'Obujulizi bwange', 'HomeWard Circles': 'Ebibiina bya HomeWard', 'Sign out': 'Fuluma',
  'HomeWard': 'HomeWard', 'New chat': 'Emboozi empya', 'Chats': 'Emboozi', 'How can I help you?': 'Nnyinza nkuyambe ntya?', 'Send Money': 'Weereza ssente', 'Savings': 'Kutereka',
  'HOME PROJECTS': 'Pulojekiti ez’awaka', 'MONEY MOVEMENT': 'Entambuza y’ensimbi', 'Secured on Stellar': 'Kikuumiddwa ku Stellar',
  'Recipient Details': 'Ebikwata ku afuna ssente', 'Trusted recipients': 'Abafuna ssente be weesiga', 'Confirm & send': 'Kakasa era oweereze',
  'Smart Transfer': 'Okuweereza ssente mu magezi', 'Send': 'Weereza', 'Deposit': 'Teeka ssente', 'Live': 'Kiriwo kakano', 'You Send': 'Ky’oweereza',
  'Cash-in amount at MoneyGram': 'Ssente z’oteeka ku MoneyGram', 'Transfer Breakdown': 'Ebikwata ku kuweereza', 'Amount': 'Omuwendo', 'Fee (0.5%)': 'Ebisale (0.5%)',
  'Recipient Gets': 'Afuna ssente zino', 'Rate': 'Omuwendo gw’ensimbi', 'Delivery': 'Okutuusa', 'Cash in with MoneyGram': 'Teeka ssente ne MoneyGram',
  'Funding method': 'Engeri y’okuteekamu ssente', 'You fund': 'Ssente z’oteeka', 'Asset destination': 'Gy’ensimbi zigenda', 'Status': 'Embeera',
  'Demo flow': 'Enkola ey’okulaga', 'Passport': 'Ppaasipooti', '+ Add recipient': '+ Gattako afuna ssente', 'Save someone once, then choose them quickly next time.': 'Tereka afuna ssente omulundi gumu, omulonde mangu omulundi oguddako.',
  'Full name (e.g., Maama Namubiru)': 'Amannya amatuufu (nga Maama Namubiru)', 'Relationship (e.g., Mother, School, Supplier)': 'Enkolagana (nga Maama, Ssomero, Omusuubuzi)',
  'Monthly support plan in USDC (optional)': 'Enteekateeka y’obuyambi obwa buli mwezi mu USDC (bw’oba oyagala)', 'Phone (required, e.g., +256712345678)': 'Essimu (yeetaagisa, nga +256712345678)',
  'Update trusted recipient': 'Kyusa afuna ssente gwe weesiga', 'Save as trusted recipient': 'Tereka ng’afuna ssente gwe weesiga', 'Remove saved recipient': 'Ggyawo afuna ssente aterekeddwa',
  'Purpose': 'Ensonga', 'Processing...': 'Kikolebwa...', 'Continue to MoneyGram': 'Weyongereyo ku MoneyGram', 'Run MoneyGram Testnet cash-in': 'Kola okugeza kwa MoneyGram Testnet',
  'Family Support': 'Obuyambi eri amaka', 'Send to parents or spouse': 'Weereza eri bazadde oba munno mu bufumbo', 'Construction Milestone': 'Eddaala ly’okuzimba', 'Release payment to contractor': 'Sasula omuzimbi',
  'Deposit to your HomeWard Vault': 'Teeka mu tterekero lyo erya HomeWard', 'School Fees': 'Sente za ssomero', 'Pay tuition directly': 'Sasula ssente za ssomero butereevu',
  'Business Investment': 'Okuteeka ssente mu bizinensi', 'Invoice or partnership payment': 'Sasula invoice oba obw’omu kibiina',
  'Review before sending': 'Kebera nga tonnaweereza', 'Recipient will receive': 'Afuna ssente zino', 'Why this is safe to send': 'Lwaki kino kirungi okuweereza',
  'Family outcome': 'Ekyetaagisa mu maka', 'Delivery estimate': 'Ekiseera eky’okutuusa', 'Known since': 'Mw’otomanyidde', 'Completed payments': 'Okusasula okwaawedde',
  'Usual transfer': 'Omuwendo gw’owa bulijjo', 'Monthly plan': 'Enteekateeka ya mwezi', 'Not set': 'Tekiteekeddwa', 'Last successful payment': 'Okusasula okwasembyeyo okwaawedde',
  'No completed payment yet': 'Tewaba kusasula kuwedde', 'Use this recipient': 'Kozesa afuna ssente ono', 'Cash-in demonstration': 'Okulaga okuteeka ssente',
  'Confirm your identity': 'Kakasa ggwe ani', 'Customer': 'Mukasitoma', 'HomeWard customer': 'Mukasitoma wa HomeWard', 'Demo verification': 'Okukakasa okw’okulaga',
  'Ready for Testnet cash-in': 'Mwetegefu okuteeka ssente ku Testnet', 'Continue to location': 'Weyongereyo ku kifo', 'Choose a cash-in location': 'Londa ekifo eky’okuteekamu ssente',
  'Review cash-in': 'Kebera okuteeka ssente', 'Cash handed to agent': 'Ssente eziweereddwa agenti', 'Selected location': 'Ekifo ekirondeddwa',
  'HomeWard receives': 'HomeWard efuna', 'Settlement network': 'Omukutu ogw’okusasulirako', 'Confirm demo cash handover': 'Kakasa okuwa ssente okw’okulaga',
  'Settling on Stellar Testnet': 'Kikakasibwa ku Stellar Testnet', 'USDC received in HomeWard': 'USDC efuniddwa mu HomeWard', 'Continue to send home': 'Weyongereyo okuweereza awaka',
  'Recipient details': 'Ebikwata ku afuna ssente', 'Enter a full name and valid international phone number before saving.': 'Wandiika amannya amatuufu ne namba y’essimu ey’ensi yonna entuufu nga tonnateresa.',
  'Required': 'Kyetaagisa', 'Title and target amount are required': 'Omutwe n’omuwendo gw’ogenderera byetaagisa', 'Invalid': 'Tekikkirizibwa', 'Enter a valid target amount': 'Wandiika omuwendo gw’ogenderera omutuufu',
  'All': 'Byonna', 'Sent': 'Yaweerezebwa', 'Received': 'Yafunibwa', 'Completed': 'Kyawedde', 'Pending': 'Kikyali mu kkubo', 'Failed': 'Kigaanye',
  'RECEIPT': 'BUJULIZI', 'Transaction details': 'Ebikwata ku kuweereza', 'You sent': 'Waweereza', 'You received': 'Wafuna', 'Pending confirmation': 'Kikyali kikakasibwa',
  'Recipient': 'Afuna ssente', 'Source': 'Ssente we zaava', 'HomeWard wallet': 'Waleti ya HomeWard', 'Mobile': 'Essimu', 'Network': 'Omukutu',
  'Receipt': 'Obujulizi', 'Date': 'Olunaku', 'Verified on Stellar Testnet': 'Kikakasiddwa ku Stellar Testnet', 'Download receipt': 'Wanikula obujulizi',
  'Transfer Successful!': 'Okuweereza kuwedde bulungi!', 'Money is on its way to': 'Ssente ziri mu kkubo okugenda eri', 'You Sent': 'Waweereza', 'Phone': 'Essimu',
  'Relationship': 'Enkolagana', 'Fee': 'Ebisale', 'New Balance': 'Bbalansi empya', 'Reference': 'Namba y’obujulizi', 'FAMILY OUTCOME UPDATED': 'EKIGENDERERWA KY’AMAKA KIZZA BUPYA',
  'This transfer has been linked to the family goal.': 'Okuweereza kuno kugattiddwa ku kigendererwa ky’amaka.', 'Confirmed by you': 'Wakakasa ggwe', 'Done': 'Kiwedde',
  'Could not load circles': 'Tetuyise kulaba bibiina', 'Check your connection and try again.': 'Kebera omukutu gwo oddemu ogezeeko.', 'Complete your circle': 'Jjuza ekibiina kyo',
  'CIRCLES': 'EBIBIINA', 'Organise recurring support around people and home projects—then keep every contribution and receipt in one place.': 'Tegeka obuyambi obuddiŋŋana eri abantu n’emirimu gy’awaka, era kuuma buli ky’owa n’obujulizi mu kifo kimu.',
  'e.g., Mum’s monthly support': 'nga Obuyambi bwa Maama obwa buli mwezi', 'Recurring amount in USDC': 'Omuwendo ogwa buli kiseera mu USDC', 'Usual purpose': 'Ensonga esinga okukozesebwa',
  'Trusted recipient (optional when a goal is selected)': 'Afuna ssente gwe weesiga (si kya buwaze singa olonze ekigendererwa)', 'Home goal (optional when a recipient is selected)': 'Ekigendererwa ky’awaka (si kya buwaze singa olonze afuna ssente)',
  'saved': 'eterese', 'Family plan': 'Enteekateeka y’amaka', 'active': 'kikola', 'paused': 'kiyimiridde', 'each plan': 'ku buli nteekateeka', 'payments': 'okusasula', 'delivered': 'ezituusiddwa',
  'Latest receipt': 'Obujulizi obwasembyeyo', 'No completed payment yet. Send from Transfer and keep the receipt here.': 'Tewaba kusasula kuwedde. Weereza okuva ku Transfer era obujulizi bugenda kulabika wano.',
  'Pause plan': 'Yimiriza enteekateeka', 'Resume plan': 'Ddamu okutandika enteekateeka', 'Share summary': 'Gabana mu bufunze', 'Start with one family plan': 'Tandika n’enteekateeka emu ey’amaka',
  'A Circle turns a regular payment into a clear shared story.': 'Ekibiina kifuula okusasula okuddiŋŋana okuba emboozi etegeerekeka eri bonna.', 'Plan': 'Enteekateeka', 'each time': 'buli kiseera', 'Contributions': 'Ebiweereddwayo', 'Total delivered': 'Byonna ebituusiddwa',
  'A live MoneyGram journey verifies identity before showing eligible cash-in locations. This screen demonstrates that required step.': 'Enkola ya MoneyGram ekakasizza omuntu nga tennalaga bifo eby’okuteekamu ssente. Olutimbe luno lulaga ddaala eryo.',
  'Live availability is supplied by MoneyGram after approval. Select an illustrative UAE location for this Testnet demonstration.': 'MoneyGram y’eraga ebifo ebiriwo ng’ekkiriza. Londa ekifo eky’okulabirako mu UAE ku kulaga kwa Testnet.',
  'In production, the agent collects AED cash only after the regulated MoneyGram flow is approved and completed.': 'Mu nkola entuufu, agenti afuna ssente za AED oluvannyuma lw’enkola ya MoneyGram ekkiriziddwa n’ewedde.',
  'Creating a real Testnet USDC transaction and waiting for its ledger confirmation.': 'Tukola kuweereza kwa USDC okw’amazima ku Testnet era tulinda okukakasibwa mu ledger.',
  'Add a name, recurring amount, and a trusted recipient or goal.': 'Gattako erinnya, omuwendo ogwa buli kiseera, n’afuna ssente gwe weesiga oba ekigendererwa.', 'Could not create circle': 'Tetuyise kutonda kibiina',
  'All time': 'Buli kiseera', 'Today': 'Leero', 'Yesterday': 'Jjo', '7 days': 'Ennaku 7', '30 days': 'Ennaku 30', 'Period': 'Ekiseera', 'Total Sent': 'Byonna ebiweereddwa',
  'This Month': 'Omwezi guno', 'Transactions': 'Ebiweerezeddwa', 'No transactions yet': 'Tewaba kuweereza kugezaako', 'NEW': 'KIPYA',
  'Error': 'Wabaddemu kiremya', 'Failed to create goal': 'Tetuyise kutonda kigendererwa', 'Failed to update goal': 'Tetuyise kukyusa kigendererwa', 'Could not delete goal': 'Tetuyise kuggyawo kigendererwa',
  'Turn every transfer into visible progress.': 'Fuula buli kuweereza okulaga enkulaakulana yo.', 'All goals': 'Ebigendererwa byonna', 'Start a goal': 'Tandika ekigendererwa', 'projects': 'pulojekiti',
  'Build something meaningful': 'Zimba ekintu ekirina amakulu', 'Set a goal for a family project, school fees, land, or a brighter home.': 'Teeka ekigendererwa ku pulojekiti y’amaka, ssente za ssomero, ettaka, oba awaka awalungi.',
  'Create a goal': 'Tonda ekigendererwa', 'New Savings Goal': 'Ekigendererwa ekipya eky’okutereka', 'Title': 'Omutwe', 'e.g. Buy Land in Wakiso': 'nga Gula Ettaka e Wakiso',
  'Target Amount (UGX)': 'Omuwendo gw’ogenderera (UGX)', 'Category': 'Ekika', 'Home': 'Awaka', 'Land': 'Ettaka', 'Education': 'Obuyigirize', 'Business': 'Bizinensi', 'Other': 'Ekirala',
  'Description (optional)': 'Ennyonnyola (bw’oba oyagala)', 'What is this goal for?': 'Ekigendererwa kino kya ki?', 'Create Goal': 'Tonda ekigendererwa', 'Edit Goal': 'Kyusa ekigendererwa', 'Save Changes': 'Tereka enkyukakyuka',
  'Could not save recipient': 'Tetuyise kutereka afuna ssente', 'Please try again.': 'Ddamu ogezeeko.', 'Recipient saved': 'Afuna ssente aterekeddwa', 'is ready for future transfers.': 'mwetegefu okuweerezebwa mu biseera eby’omu maaso.',
  'Remove saved recipient?': 'Oyinza okuggyawo afuna ssente ono?', 'This recipient': 'Afuna ssente ono', 'will be removed from your private list.': 'ajja kuggyibwa ku lukalala lwo olw’ekyama.', 'Keep': 'Lekawo', 'Remove': 'Ggyawo', 'Could not remove': 'Tetuyise kuggyawo',
  'Minimum 10 USDC': 'Wa wansi wa 10 USDC', 'Enter at least 10 USDC to send.': 'Wandiika waakiri 10 USDC okuweereza.', 'No quote': 'Tewali muwendo',
  'Unable to get exchange rate. Try again.': 'Tetuyise kufuna muwendo gw’ensimbi. Ddamu ogezeeko.', 'Recipient Name': 'Erinnya ly’afuna ssente', 'Enter the recipient name.': 'Wandiika erinnya ly’afuna ssente.',
  'Recipient Phone': 'Essimu y’afuna ssente', 'A phone number is required for Mobile Money and SMS notification.': 'Namba y’essimu yeetaagisa ku Mobile Money n’obubaka bwa SMS.',
  'Invalid Phone': 'Essimu si ntuufu', 'Use international format, for example +256712345678.': 'Kozesa enkola ey’ensi yonna, nga +256712345678.',
  'Create Circle': 'Tonda ekibiina', 'Your Circles': 'Ebibiina byo', 'Family plans, together': 'Enteekateeka z’amaka, awamu',
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<HomewardLanguage['code']>('eng');
  useEffect(() => { if (Platform.OS === 'web' && typeof localStorage !== 'undefined') { const saved = localStorage.getItem(STORAGE_KEY) as HomewardLanguage['code'] | null; if (saved && HOMEWARD_LANGUAGES.some((item) => item.code === saved)) setLanguageState(saved); } }, []);
  const setLanguage = (next: HomewardLanguage['code']) => { setLanguageState(next); if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next); };
  const value = useMemo(() => ({ language, setLanguage, languageName: HOMEWARD_LANGUAGES.find((item) => item.code === language)?.name || 'English', t: (english: string) => language === 'lug' ? (LUGANDA[english] || english) : english }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error('useLanguage must be used within LanguageProvider'); return value; }
