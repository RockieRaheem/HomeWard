"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
var db = require("./database.js");
var stellar = require("./stellar.js");
var rates_js_1 = require("./rates.js");
var kotani = require("./kotani.js");
var sms_js_1 = require("./sms.js");
var events_js_1 = require("./events.js");
var config_js_1 = require("../config.js");
// Models in priority order (best function-calling first, then fallbacks)
// Only actively supported models — confirmed via Groq docs as of July 2026
var GROQ_MODELS = [
    'llama-3.3-70b-versatile', // Best function calling, 131K context
    'qwen/qwen3.6-27b', // Strong tool use, parallel calls, 131K context
    'minimaxai/minimax-m2.7', // Excellent tool use, parallel calls
    'llama-4-maverick-17b', // Llama 4, fast inference, tool support
    'llama-3.1-8b-instant', // Speed king — last resort, weak tool use
];
var _pendingNavigate = null;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fiat(amount) {
    if (amount >= 1000000)
        return "UGX ".concat((amount / 1000000).toFixed(1), "M");
    if (amount >= 1000)
        return "UGX ".concat((amount / 1000).toFixed(1), "K");
    return "UGX ".concat(amount.toLocaleString('en-US'));
}
function usdc(amount) {
    return "$".concat(amount.toFixed(2));
}
function percent(a, b) {
    if (b <= 0)
        return 0;
    return Math.round((a / b) * 100);
}
// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------
function buildContext() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet, goals, transactions, liveBalance, b, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, db.getWallet()];
                case 1:
                    wallet = _c.sent();
                    return [4 /*yield*/, db.getGoals()];
                case 2:
                    goals = _c.sent();
                    return [4 /*yield*/, db.getTransactions({ limit: 5 })];
                case 3:
                    transactions = (_c.sent()).transactions;
                    liveBalance = 0;
                    if (!(wallet === null || wallet === void 0 ? void 0 : wallet.publicKey)) return [3 /*break*/, 7];
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
                case 5:
                    b = _c.sent();
                    liveBalance = b.usdc;
                    return [3 /*break*/, 7];
                case 6:
                    _a = _c.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, { walletBalance: liveBalance, goals: goals, recentTransactions: transactions, activeGoal: goals.find(function (g) { return g.status === 'active'; }) }];
                case 8:
                    _b = _c.sent();
                    return [2 /*return*/, { walletBalance: 0, goals: [], recentTransactions: [], activeGoal: undefined }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// System prompt (compact)
// ---------------------------------------------------------------------------
function buildSystemPrompt(ctx) {
    var goalsBrief = ctx.goals.length > 0
        ? ctx.goals.map(function (g) {
            return "- \"".concat(g.title, "\" (").concat(fiat(g.savedAmountUgx), "/").concat(fiat(g.targetAmountUgx), ", ").concat(percent(g.savedAmountUgx, g.targetAmountUgx), "%) ID:").concat(g.id);
        }).join('\n')
        : '(none)';
    var txBrief = ctx.recentTransactions.length > 0
        ? ctx.recentTransactions.map(function (t) {
            return "- ".concat(t.type === 'sent' ? '→' : '←', " ").concat(usdc(t.amountUsdc), " ").concat(t.recipientName, " (").concat(t.status, ")");
        }).join('\n')
        : '(none)';
    return "You are Kanzu, an AI financial companion for HomeWard \u2014 USDC \u2192 Mobile Money for Uganda.\n\nWallet: ".concat(usdc(ctx.walletBalance), " USDC\nGoals:\n").concat(goalsBrief, "\nRecent txs:\n").concat(txBrief, "\nRate: 1 USDC \u2248 UGX 3,750 (0.5% fee, min $0.50)\n\nYou can perform these actions via function calls \u2014 DO IT when asked:\n1. create_goal(title, targetAmountUgx, category?, description?)\n2. contribute_to_goal(goalId, amountUgx)\n3. send_money(amountUsdc, recipientName, recipientPhone?, recipientNetwork?, purpose)\n4. update_goal(goalId, title?, targetAmountUgx?, category?, status?, description?)\n5. delete_goal(goalId)\n6. navigate(screen, goalId?) \u2014 go to Dashboard | Goals | Transfer | History | GoalDetail\n\nIMPORTANT: When calling functions that require a goalId, you MUST use the exact ID value shown after \"ID:\" in the Goals list above. Never make up a goalId \u2014 use the actual one from the context.\n\n## Formatting rules\n- Use ## for section headings (never ### or #)\n- Use **bold** for amounts, names, and emphasis\n- Use - for lists (never numbers or *)\n- Use an emoji on its own line for key points: \u2705 \u274C \u26A0\uFE0F \uD83C\uDF89 \uD83C\uDFAF \uD83D\uDCA1\n- Never use > blockquotes, --- rules, or backtick code\n- Keep responses concise and warm. Never fabricate data.\n- CRITICAL: Never display raw IDs, UUIDs, or internal identifiers in your response text.");
}
// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
var TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_goal',
            description: 'Create a new savings goal',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Goal title (e.g. "Buy Land in Wakiso")' },
                    description: { type: 'string', description: 'Optional description' },
                    targetAmountUgx: { type: 'number', description: 'Target amount in UGX' },
                    category: { type: 'string', enum: ['home', 'education', 'business', 'savings', 'land', 'other'], description: 'Category' },
                },
                required: ['title', 'targetAmountUgx'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'contribute_to_goal',
            description: 'Add funds to an existing savings goal — use the exact UUID from the goals list as goalId',
            parameters: {
                type: 'object',
                properties: {
                    goalId: { type: 'string', description: 'The exact UUID of the goal from the context (e.g. "550e8400-e29b-41d4-a716-446655440000")' },
                    amountUgx: { type: 'number', description: 'Amount in UGX to add' },
                },
                required: ['goalId', 'amountUgx'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_money',
            description: 'Send USDC to a recipient in Uganda via Mobile Money',
            parameters: {
                type: 'object',
                properties: {
                    amountUsdc: { oneOf: [{ type: 'number' }, { type: 'string' }], description: 'Amount in USDC (min 10, max 5000)' },
                    recipientName: { type: 'string', description: 'Recipient full name' },
                    recipientPhone: { type: 'string', description: 'Phone (e.g. +256...)' },
                    recipientNetwork: { type: 'string', enum: ['MTN', 'AIRTEL'], description: 'Mobile network: MTN or AIRTEL' },
                    purpose: { type: 'string', description: 'Purpose (e.g. "Family Support")' },
                },
                required: ['amountUsdc', 'recipientName', 'purpose'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_goal',
            description: 'Update an existing goal — use the exact UUID from the goals list as goalId',
            parameters: {
                type: 'object',
                properties: {
                    goalId: { type: 'string', description: 'The exact UUID of the goal from the context' },
                    title: { type: 'string', description: 'New title' },
                    description: { type: 'string', description: 'New description' },
                    targetAmountUgx: { type: 'number', description: 'New target amount in UGX' },
                    category: { type: 'string', enum: ['home', 'education', 'business', 'savings', 'land', 'other'], description: 'New category' },
                    status: { type: 'string', enum: ['active', 'completed', 'cancelled'], description: 'New status' },
                },
                required: ['goalId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'delete_goal',
            description: 'Delete a savings goal permanently — use the exact UUID from the goals list as goalId',
            parameters: {
                type: 'object',
                properties: { goalId: { type: 'string', description: 'The exact UUID of the goal from the context' } },
                required: ['goalId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'navigate',
            description: 'Navigate/redirect the user to a specific screen in the app',
            parameters: {
                type: 'object',
                properties: {
                    screen: { type: 'string', enum: ['Dashboard', 'Goals', 'Transfer', 'History', 'GoalDetail'], description: 'The screen to navigate to' },
                    goalId: { type: 'string', description: 'Goal UUID (only for GoalDetail screen)' },
                },
                required: ['screen'],
            },
        },
    },
];
// ---------------------------------------------------------------------------
// Tool execution (returns clean human-readable messages, no raw JSON)
// ---------------------------------------------------------------------------
function executeToolCall(toolCall) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, name, rawArgs, args, _b, goal, goal, pct, remaining, msg, amountUsdc, network, wallet, balance, rate, quote, referenceId, stellarTxHash, kotaniEscrow, hasKotaniApiKey, destination, _c, newBalance, kotaniResult, existing, updates, updated, goal, dest, foundGoal, err_1;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _a = toolCall.function, name = _a.name, rawArgs = _a.arguments;
                    try {
                        args = JSON.parse(rawArgs);
                    }
                    catch (_g) {
                        return [2 /*return*/, "\u274C Invalid arguments for ".concat(name)];
                    }
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 31, , 32]);
                    _b = name;
                    switch (_b) {
                        case 'create_goal': return [3 /*break*/, 2];
                        case 'contribute_to_goal': return [3 /*break*/, 4];
                        case 'send_money': return [3 /*break*/, 7];
                        case 'update_goal': return [3 /*break*/, 20];
                        case 'delete_goal': return [3 /*break*/, 23];
                        case 'navigate': return [3 /*break*/, 26];
                    }
                    return [3 /*break*/, 29];
                case 2: return [4 /*yield*/, db.createGoal({
                        title: args.title, description: args.description || '',
                        targetAmountUgx: args.targetAmountUgx, category: args.category || 'other',
                    })];
                case 3:
                    goal = _f.sent();
                    return [2 /*return*/, "\u2705 Created goal \"".concat(goal.title, "\" \u2014 target ").concat(fiat(goal.targetAmountUgx), ".")];
                case 4: return [4 /*yield*/, db.contributeToGoal(args.goalId, args.amountUgx)];
                case 5:
                    goal = _f.sent();
                    if (!goal)
                        return [2 /*return*/, "\u274C Goal not found."];
                    return [4 /*yield*/, db.createTransaction({
                            type: 'received', amountUsdc: args.amountUgx / 3750, amountUgx: args.amountUgx,
                            rate: 3750, recipientName: "Contribution to ".concat(goal.title), purpose: 'Goal Contribution',
                            status: 'completed', goalId: goal.id,
                        })];
                case 6:
                    _f.sent();
                    pct = percent(goal.savedAmountUgx, goal.targetAmountUgx);
                    remaining = goal.targetAmountUgx - goal.savedAmountUgx;
                    msg = "\u2705 Added ".concat(fiat(args.amountUgx), " to \"").concat(goal.title, "\". Now ").concat(fiat(goal.savedAmountUgx), "/").concat(fiat(goal.targetAmountUgx), " (").concat(pct, "%)");
                    if (remaining > 0)
                        msg += ". ".concat(fiat(remaining), " remaining to reach your goal! \uD83C\uDFAF");
                    else
                        msg += " \uD83C\uDF89 Fully funded \u2014 congratulations!";
                    return [2 /*return*/, msg];
                case 7:
                    amountUsdc = typeof args.amountUsdc === 'string' ? parseFloat(args.amountUsdc) : args.amountUsdc;
                    if (isNaN(amountUsdc))
                        return [2 /*return*/, "\u274C Invalid amount."];
                    network = ((_d = args.recipientNetwork) === null || _d === void 0 ? void 0 : _d.toUpperCase()) === 'AIRTEL' ? 'AIRTEL' : 'MTN';
                    return [4 /*yield*/, db.getWallet()];
                case 8:
                    wallet = _f.sent();
                    if (!wallet)
                        return [2 /*return*/, '❌ No wallet found. Create a wallet first.'];
                    return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
                case 9:
                    balance = _f.sent();
                    if (amountUsdc > balance.usdc)
                        return [2 /*return*/, "\u274C You have ".concat(usdc(balance.usdc), " USDC, but trying to send ").concat(usdc(amountUsdc), ".")];
                    if (amountUsdc < config_js_1.default.homeward.minTransferUsdc)
                        return [2 /*return*/, "\u274C Minimum is ".concat(config_js_1.default.homeward.minTransferUsdc, " USDC.")];
                    if (amountUsdc > config_js_1.default.homeward.maxTransferUsdc)
                        return [2 /*return*/, "\u274C Maximum is ".concat(config_js_1.default.homeward.maxTransferUsdc, " USDC.")];
                    return [4 /*yield*/, (0, rates_js_1.getExchangeRate)()];
                case 10:
                    rate = _f.sent();
                    quote = (0, rates_js_1.calculateQuote)(amountUsdc, rate);
                    referenceId = "ai-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 8));
                    stellarTxHash = '';
                    _f.label = 11;
                case 11:
                    _f.trys.push([11, 14, , 15]);
                    return [4 /*yield*/, stellar.ensureTrustline(wallet.secretKey)];
                case 12:
                    _f.sent();
                    kotaniEscrow = config_js_1.default.kotani.escrowAddress;
                    hasKotaniApiKey = !!config_js_1.default.kotani.apiKey;
                    destination = hasKotaniApiKey && stellar.isValidPublicKey(kotaniEscrow)
                        ? kotaniEscrow
                        : config_js_1.default.stellar.usdcIssuer;
                    return [4 /*yield*/, stellar.submitPayment(wallet.secretKey, destination, quote.sendAmountUsdc.toFixed(7), referenceId)];
                case 13:
                    stellarTxHash = _f.sent();
                    console.log("  \u2705 AI: Stellar payment sent ".concat(stellarTxHash.slice(0, 8), "..."));
                    return [3 /*break*/, 15];
                case 14:
                    _c = _f.sent();
                    stellarTxHash = "demo-".concat(Date.now());
                    return [3 /*break*/, 15];
                case 15: return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
                case 16:
                    newBalance = _f.sent();
                    return [4 /*yield*/, db.updateWalletBalance(wallet.publicKey, newBalance.usdc, newBalance.xlm)];
                case 17:
                    _f.sent();
                    (0, events_js_1.notifyChange)();
                    return [4 /*yield*/, kotani.createOfframp({
                            referenceId: referenceId,
                            cryptoAmount: quote.sendAmountUsdc, currency: 'UGX',
                            chain: 'STELLAR', token: 'USDC', transactionHash: stellarTxHash,
                        })];
                case 18:
                    kotaniResult = _f.sent();
                    return [4 /*yield*/, db.createTransaction({
                            type: 'sent', amountUsdc: quote.sendAmountUsdc, amountUgx: quote.receiveAmountUgx,
                            rate: quote.rate, recipientName: args.recipientName, recipientPhone: args.recipientPhone || '',
                            recipientNetwork: network, status: 'pending', purpose: args.purpose || 'Transfer',
                            stellarTxHash: stellarTxHash,
                            kotaniReferenceId: referenceId,
                            kotaniStatus: ((_e = kotaniResult.data) === null || _e === void 0 ? void 0 : _e.status) || 'pending',
                        })];
                case 19:
                    _f.sent();
                    // Send SMS if phone provided (fire-and-forget)
                    if (args.recipientPhone) {
                        (0, sms_js_1.sendTransferNotificationAsync)({
                            phoneNumber: args.recipientPhone,
                            recipientName: args.recipientName,
                            amountUgx: quote.receiveAmountUgx,
                            amountUsdc: quote.sendAmountUsdc,
                            senderName: args.senderName || args.recipientName,
                        });
                    }
                    return [2 /*return*/, "\u2705 **Sent ".concat(usdc(quote.sendAmountUsdc), " to ").concat(args.recipientName, "!** Delivery: ~").concat(fiat(quote.receiveAmountUgx), " UGX via ").concat(network, ". Fee: ").concat(usdc(quote.feeUsdc), ". Balance: ").concat(usdc(newBalance.usdc), " remaining. Ref: ").concat(referenceId.slice(-8))];
                case 20: return [4 /*yield*/, db.getGoal(args.goalId)];
                case 21:
                    existing = _f.sent();
                    if (!existing)
                        return [2 /*return*/, "\u274C Goal not found."];
                    updates = {};
                    if (args.title !== undefined)
                        updates.title = args.title;
                    if (args.description !== undefined)
                        updates.description = args.description;
                    if (args.targetAmountUgx !== undefined)
                        updates.targetAmountUgx = args.targetAmountUgx;
                    if (args.category !== undefined)
                        updates.category = args.category;
                    if (args.status !== undefined)
                        updates.status = args.status;
                    return [4 /*yield*/, db.updateGoal(args.goalId, updates)];
                case 22:
                    updated = _f.sent();
                    if (!updated)
                        return [2 /*return*/, "\u274C Failed to update goal."];
                    return [2 /*return*/, "\u2705 Goal \"".concat(updated.title, "\" updated! Target: ").concat(fiat(updated.targetAmountUgx), ", Saved: ").concat(fiat(updated.savedAmountUgx), " (").concat(percent(updated.savedAmountUgx, updated.targetAmountUgx), "%)")];
                case 23: return [4 /*yield*/, db.getGoal(args.goalId)];
                case 24:
                    goal = _f.sent();
                    if (!goal)
                        return [2 /*return*/, "\u274C Goal not found."];
                    return [4 /*yield*/, db.deleteGoal(args.goalId)];
                case 25:
                    _f.sent();
                    return [2 /*return*/, "\u2705 Goal \"".concat(goal.title, "\" deleted permanently.")];
                case 26:
                    _pendingNavigate = { screen: args.screen, goalId: args.goalId };
                    dest = "the ".concat(args.screen, " screen");
                    if (!(args.screen === 'GoalDetail' && args.goalId)) return [3 /*break*/, 28];
                    return [4 /*yield*/, db.getGoal(args.goalId)];
                case 27:
                    foundGoal = _f.sent();
                    dest = foundGoal ? "\"".concat(foundGoal.title, "\" details") : "your goal details";
                    _f.label = 28;
                case 28: return [2 /*return*/, "\u2705 Navigating to ".concat(dest, "...")];
                case 29: return [2 /*return*/, "\u274C Unknown action: ".concat(name)];
                case 30: return [3 /*break*/, 32];
                case 31:
                    err_1 = _f.sent();
                    return [2 /*return*/, "\u274C Error executing ".concat(name, ": ").concat(err_1.message)];
                case 32: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Gemini 2.0 Flash — works on free tier, 15 RPM, 1M TPM
// ---------------------------------------------------------------------------
function callGemini(userMessage, ctx, history) {
    return __awaiter(this, void 0, void 0, function () {
        var key, contents, _i, _a, msg, res, body, data, err_2;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    key = process.env.GEMINI_API_KEY;
                    if (!key)
                        return [2 /*return*/, null];
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 6, , 7]);
                    contents = [];
                    for (_i = 0, _a = history.slice(-10); _i < _a.length; _i++) {
                        msg = _a[_i];
                        contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
                    }
                    contents.push({ role: 'user', parts: [{ text: userMessage }] });
                    return [4 /*yield*/, fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: AbortSignal.timeout(25000),
                            body: JSON.stringify({
                                system_instruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
                                contents: contents,
                                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
                            }),
                        })];
                case 2:
                    res = _h.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text().catch(function () { return ''; })];
                case 3:
                    body = _h.sent();
                    console.error("Gemini ".concat(res.status, ":"), body);
                    return [2 /*return*/, null];
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    data = _h.sent();
                    return [2 /*return*/, ((_g = (_f = (_e = (_d = (_c = (_b = data === null || data === void 0 ? void 0 : data.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) === null || _g === void 0 ? void 0 : _g.trim()) || null];
                case 6:
                    err_2 = _h.sent();
                    console.error('Gemini fail:', err_2);
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Groq — tries models in priority order, returns null if all exhausted
// ---------------------------------------------------------------------------
function callGroq(userMessage, ctx, history) {
    return __awaiter(this, void 0, void 0, function () {
        var key, _i, GROQ_MODELS_1, model, result, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    key = process.env.GROQ_API_KEY;
                    if (!key)
                        return [2 /*return*/, null];
                    _i = 0, GROQ_MODELS_1 = GROQ_MODELS;
                    _a.label = 1;
                case 1:
                    if (!(_i < GROQ_MODELS_1.length)) return [3 /*break*/, 7];
                    model = GROQ_MODELS_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, tryGroqModel(model, key, userMessage, ctx, history)];
                case 3:
                    result = _a.sent();
                    if (result !== null)
                        return [2 /*return*/, result];
                    return [3 /*break*/, 5];
                case 4:
                    err_3 = _a.sent();
                    console.error("Groq ".concat(model, " exception:"), err_3);
                    return [3 /*break*/, 5];
                case 5:
                    console.warn("  Groq ".concat(model, ": no response, trying next..."));
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
function tryGroqModel(model, key, userMessage, ctx, history) {
    return __awaiter(this, void 0, void 0, function () {
        var messages, _i, _a, msg, response, body, data, choice, _b, _c, toolCall, result, finalRes, finalData, finalContent, lastToolResults;
        var _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    messages = [{ role: 'system', content: buildSystemPrompt(ctx) }];
                    for (_i = 0, _a = history.slice(-10); _i < _a.length; _i++) {
                        msg = _a[_i];
                        messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
                    }
                    messages.push({ role: 'user', content: userMessage });
                    return [4 /*yield*/, fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer ".concat(key) },
                            signal: AbortSignal.timeout(25000),
                            body: JSON.stringify({ model: model, messages: messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.7, max_tokens: 1024 }),
                        })];
                case 1:
                    response = _k.sent();
                    if (!!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, response.text().catch(function () { return ''; })];
                case 2:
                    body = _k.sent();
                    if (response.status === 429)
                        return [2 /*return*/, null];
                    if (!(response.status === 400 && body.includes('tool call validation'))) return [3 /*break*/, 4];
                    return [4 /*yield*/, groqTextFallback(model, key, messages)];
                case 3: return [2 /*return*/, _k.sent()];
                case 4:
                    console.error("Groq ".concat(model, " ").concat(response.status, ":"), body);
                    return [2 /*return*/, null];
                case 5: return [4 /*yield*/, response.json()];
                case 6:
                    data = _k.sent();
                    choice = (_e = (_d = data === null || data === void 0 ? void 0 : data.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message;
                    if (!choice)
                        return [2 /*return*/, null];
                    if (!choice.tool_calls || choice.tool_calls.length === 0) {
                        return [2 /*return*/, choice.content || null];
                    }
                    _b = 0, _c = choice.tool_calls;
                    _k.label = 7;
                case 7:
                    if (!(_b < _c.length)) return [3 /*break*/, 10];
                    toolCall = _c[_b];
                    return [4 /*yield*/, executeToolCall(toolCall)];
                case 8:
                    result = _k.sent();
                    messages.push({ role: 'assistant', content: null, tool_calls: [toolCall] });
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
                    _k.label = 9;
                case 9:
                    _b++;
                    return [3 /*break*/, 7];
                case 10: return [4 /*yield*/, fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer ".concat(key) },
                        signal: AbortSignal.timeout(25000),
                        body: JSON.stringify({ model: model, messages: messages, temperature: 0.7, max_tokens: 1024 }),
                    })];
                case 11:
                    finalRes = _k.sent();
                    if (!finalRes.ok) return [3 /*break*/, 13];
                    return [4 /*yield*/, finalRes.json()];
                case 12:
                    finalData = _k.sent();
                    finalContent = (_j = (_h = (_g = (_f = finalData === null || finalData === void 0 ? void 0 : finalData.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.content) === null || _j === void 0 ? void 0 : _j.trim();
                    if (finalContent)
                        return [2 /*return*/, finalContent];
                    _k.label = 13;
                case 13:
                    lastToolResults = messages.filter(function (m) { return m.role === 'tool'; }).map(function (m) { return m.content; });
                    if (lastToolResults.length > 0) {
                        return [2 /*return*/, lastToolResults.join('\n\n')];
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
function groqTextFallback(model, key, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var res, data, _a;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer ".concat(key) },
                            signal: AbortSignal.timeout(25000),
                            body: JSON.stringify({ model: model, messages: messages, temperature: 0.7, max_tokens: 1024 }),
                        })];
                case 1:
                    res = _f.sent();
                    if (!res.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _f.sent();
                    return [2 /*return*/, ((_e = (_d = (_c = (_b = data === null || data === void 0 ? void 0 : data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.trim()) || null];
                case 3:
                    _a = _f.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Startup log
// ---------------------------------------------------------------------------
console.log("  AI      : ".concat(process.env.GEMINI_API_KEY ? 'Gemini ✓ (2.0 Flash)' : 'Gemini ✗', " | ").concat(process.env.GROQ_API_KEY ? "Groq \u2713 (".concat(GROQ_MODELS.join(', '), ")") : 'Groq ✗'));
// ---------------------------------------------------------------------------
// Public API — never throws
// ---------------------------------------------------------------------------
function chat(userMessage, sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var e_1, ctx, history, e_2, reply, e_3, e_4, e_5, messages, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _pendingNavigate = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, db.addChatMessage({ role: 'user', content: userMessage, sessionId: sessionId })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('Failed to save user msg:', e_1);
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, buildContext()];
                case 5:
                    ctx = _a.sent();
                    history = [];
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, db.getChatMessages(sessionId)];
                case 7:
                    history = _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    e_2 = _a.sent();
                    console.error('Failed to load history:', e_2);
                    return [3 /*break*/, 9];
                case 9:
                    reply = null;
                    if (!process.env.GROQ_API_KEY) return [3 /*break*/, 13];
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, callGroq(userMessage, ctx, history)];
                case 11:
                    reply = _a.sent();
                    return [3 /*break*/, 13];
                case 12:
                    e_3 = _a.sent();
                    console.error('Groq exception:', e_3);
                    return [3 /*break*/, 13];
                case 13:
                    if (!(!reply && process.env.GEMINI_API_KEY)) return [3 /*break*/, 17];
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, callGemini(userMessage, ctx, history)];
                case 15:
                    reply = _a.sent();
                    return [3 /*break*/, 17];
                case 16:
                    e_4 = _a.sent();
                    console.error('Gemini exception:', e_4);
                    return [3 /*break*/, 17];
                case 17:
                    if (!reply) {
                        reply = "I'm here to help! You can ask me to send money to Uganda, create or manage savings goals, check your balance, or navigate to any screen in the app. What would you like to do?";
                        console.warn('  AI: all providers exhausted, using fallback');
                    }
                    _a.label = 18;
                case 18:
                    _a.trys.push([18, 20, , 21]);
                    return [4 /*yield*/, db.addChatMessage({ role: 'assistant', content: reply, sessionId: sessionId })];
                case 19:
                    _a.sent();
                    return [3 /*break*/, 21];
                case 20:
                    e_5 = _a.sent();
                    console.error('Failed to save reply:', e_5);
                    return [3 /*break*/, 21];
                case 21:
                    messages = [];
                    _a.label = 22;
                case 22:
                    _a.trys.push([22, 24, , 25]);
                    return [4 /*yield*/, db.getChatMessages(sessionId)];
                case 23:
                    messages = _a.sent();
                    return [3 /*break*/, 25];
                case 24:
                    e_6 = _a.sent();
                    console.error('Failed to get messages:', e_6);
                    return [3 /*break*/, 25];
                case 25: return [2 /*return*/, { messages: messages, navigate: _pendingNavigate }];
            }
        });
    });
}
