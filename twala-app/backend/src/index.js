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
require("dotenv/config");
var os_1 = require("os");
var express_1 = require("express");
var cors_1 = require("cors");
var config_js_1 = require("./config.js");
var wallet_js_1 = require("./routes/wallet.js");
var transfer_js_1 = require("./routes/transfer.js");
var goals_js_1 = require("./routes/goals.js");
var history_js_1 = require("./routes/history.js");
var chat_js_1 = require("./routes/chat.js");
var rates_js_1 = require("./routes/rates.js");
var kotani_js_1 = require("./routes/kotani.js");
var auth_js_1 = require("./routes/auth.js");
var stellar = require("./services/stellar.js");
var db = require("./services/database.js");
var kotani = require("./services/kotani.js");
var sms_js_1 = require("./services/sms.js");
var events_js_1 = require("./services/events.js");
function getLanIp() {
    var ifaces = os_1.default.networkInterfaces();
    for (var _i = 0, _a = Object.keys(ifaces); _i < _a.length; _i++) {
        var name_1 = _a[_i];
        for (var _b = 0, _c = ifaces[name_1] || []; _b < _c.length; _b++) {
            var iface = _c[_b];
            if (iface.family === 'IPv4' && !iface.internal)
                return iface.address;
        }
    }
    return '127.0.0.1';
}
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/health', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, goals, transactions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, db.getWallet().catch(function () { return null; })];
            case 1:
                wallet = _a.sent();
                return [4 /*yield*/, db.getGoals().catch(function () { return []; })];
            case 2:
                goals = _a.sent();
                return [4 /*yield*/, db.getTransactions({ limit: 1 }).catch(function () { return ({ transactions: [], total: 0 }); })];
            case 3:
                transactions = (_a.sent()).transactions;
                res.json({
                    success: true,
                    data: {
                        status: 'ok',
                        database: 'supabase',
                        stellarNetwork: config_js_1.default.stellar.network,
                        stellarHorizon: config_js_1.default.stellar.horizonUrl,
                        usdcIssuer: config_js_1.default.stellar.usdcIssuer,
                        walletExists: !!wallet,
                        walletAddress: (wallet === null || wallet === void 0 ? void 0 : wallet.publicKey) || null,
                        walletFunded: (wallet === null || wallet === void 0 ? void 0 : wallet.isFunded) || false,
                        goalsCount: goals.length,
                        transactionsCount: transactions.length,
                        kotaniConfigured: !!config_js_1.default.kotani.apiKey,
                        aiConfigured: !!process.env.GROQ_API_KEY || !!process.env.GEMINI_API_KEY,
                    },
                });
                return [2 /*return*/];
        }
    });
}); });
// GET /api/events/version — lightweight poll for detecting changes
app.get('/api/events/version', function (_req, res) {
    res.json({ success: true, data: { version: (0, events_js_1.getChangeVersion)() } });
});
app.use('/api/wallet', wallet_js_1.default);
app.use('/api/transfer', transfer_js_1.default);
app.use('/api/goals', goals_js_1.default);
app.use('/api/history', history_js_1.default);
app.use('/api/chat', chat_js_1.default);
app.use('/api/rates', rates_js_1.default);
app.use('/api/kotani', kotani_js_1.default);
app.use('/api/auth', auth_js_1.default);
// POST /api/sms/test — quick SMS test endpoint (fire-and-forget)
app.post('/api/sms/test', express_1.default.json(), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var phone;
    return __generator(this, function (_a) {
        phone = req.body.phone;
        if (!phone)
            return [2 /*return*/, res.status(400).json({ success: false, message: 'phone required' })];
        res.json({ success: true, message: 'SMS queued' });
        (0, sms_js_1.sendTransferNotificationAsync)({
            phoneNumber: phone,
            recipientName: 'Test Recipient',
            amountUgx: 50000,
            amountUsdc: 10,
            senderName: 'HomeWard Test',
        });
        return [2 /*return*/];
    });
}); });
// ---------------------------------------------------------------------------
// Kotani offramp completion listener — auto-completes demo mode transactions
// ---------------------------------------------------------------------------
kotani.onOfframpComplete(function (referenceId, status) { return __awaiter(void 0, void 0, void 0, function () {
    var tx, newStatus, err_1, msg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, db.getTransactionByKotaniRef(referenceId)];
            case 1:
                tx = _a.sent();
                if (!(tx && tx.status === 'pending')) return [3 /*break*/, 3];
                newStatus = status === 'completed' ? 'completed' : 'failed';
                return [4 /*yield*/, db.updateTransaction(tx.id, { status: newStatus, kotaniStatus: status })];
            case 2:
                _a.sent();
                (0, events_js_1.notifyChange)();
                console.log("  \u2705 Kotani offramp ".concat(referenceId.slice(-8), " \u2192 ").concat(status));
                _a.label = 3;
            case 3: return [3 /*break*/, 5];
            case 4:
                err_1 = _a.sent();
                msg = err_1 instanceof Error ? err_1.message : String(err_1);
                console.error("  Kotani callback error: ".concat(msg));
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// Background poller for pending transactions — catches stale demo offramps
// ---------------------------------------------------------------------------
setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var pending, txs, _i, txs_1, tx, result, newStatus, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 13, , 14]);
                return [4 /*yield*/, db.countPendingTransactions()];
            case 1:
                pending = _c.sent();
                if (!(pending > 0)) return [3 /*break*/, 12];
                return [4 /*yield*/, db.getPendingTransactions()];
            case 2:
                txs = _c.sent();
                _i = 0, txs_1 = txs;
                _c.label = 3;
            case 3:
                if (!(_i < txs_1.length)) return [3 /*break*/, 12];
                tx = txs_1[_i];
                if (!tx.kotaniReferenceId) return [3 /*break*/, 11];
                _c.label = 4;
            case 4:
                _c.trys.push([4, 10, , 11]);
                return [4 /*yield*/, kotani.getOfframpStatus(tx.kotaniReferenceId)];
            case 5:
                result = _c.sent();
                if (!(result.success && result.data)) return [3 /*break*/, 9];
                newStatus = result.data.status;
                if (!(newStatus === 'completed' && tx.status === 'pending')) return [3 /*break*/, 7];
                return [4 /*yield*/, db.updateTransaction(tx.id, { status: 'completed', kotaniStatus: 'completed' })];
            case 6:
                _c.sent();
                (0, events_js_1.notifyChange)();
                console.log("  \u2705 Background: offramp ".concat(tx.kotaniReferenceId.slice(-8), " completed"));
                return [3 /*break*/, 9];
            case 7:
                if (!(newStatus === 'failed' && tx.status === 'pending')) return [3 /*break*/, 9];
                return [4 /*yield*/, db.updateTransaction(tx.id, { status: 'failed', kotaniStatus: 'failed' })];
            case 8:
                _c.sent();
                console.log("  \u274C Background: offramp ".concat(tx.kotaniReferenceId.slice(-8), " failed"));
                _c.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                _a = _c.sent();
                return [3 /*break*/, 11];
            case 11:
                _i++;
                return [3 /*break*/, 3];
            case 12: return [3 /*break*/, 14];
            case 13:
                _b = _c.sent();
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); }, 10000); // poll every 10s
// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
app.listen(config_js_1.default.port, '0.0.0.0', function () { return __awaiter(void 0, void 0, void 0, function () {
    var lanIp, existing, balance, tlErr_1, msg, fresh, wallet, tlErr_2, msg, balance, err_2, msg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("\n  \uD83C\uDFE6 HomeWard Backend running");
                console.log("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
                console.log("  Network : ".concat(config_js_1.default.stellar.network));
                console.log("  Horizon : ".concat(config_js_1.default.stellar.horizonUrl));
                console.log("  Port    : ".concat(config_js_1.default.port));
                console.log("  Kotani  : ".concat(config_js_1.default.kotani.apiKey ? 'Configured ✓' : 'Demo mode'));
                console.log("  SMS     : ".concat(config_js_1.default.africasTalking.apiKey ? "LIVE (".concat(config_js_1.default.africasTalking.username, ")") : 'Demo mode (no AT key)'));
                lanIp = getLanIp();
                console.log("  Address : http://localhost:".concat(config_js_1.default.port));
                console.log("  LAN     : http://".concat(lanIp, ":").concat(config_js_1.default.port));
                console.log("  API     : http://localhost:".concat(config_js_1.default.port, "/api/health\n"));
                // Step 1: Initialize test USDC issuer
                return [4 /*yield*/, stellar.initializeTestUsdc()];
            case 1:
                // Step 1: Initialize test USDC issuer
                _a.sent();
                return [4 /*yield*/, db.getWallet().catch(function () { return null; })];
            case 2:
                existing = _a.sent();
                if (!existing) return [3 /*break*/, 13];
                console.log("  \uD83D\uDD04 Restoring wallet from database...");
                return [4 /*yield*/, stellar.getBalance(existing.publicKey)];
            case 3:
                balance = _a.sent();
                console.log("  \u2705 Wallet  : ".concat(existing.publicKey, " ").concat(existing.isFunded ? '(funded)' : '(unfunded)'));
                if (!existing.isFunded) return [3 /*break*/, 12];
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, stellar.ensureTrustline(existing.secretKey)];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6:
                tlErr_1 = _a.sent();
                msg = tlErr_1 instanceof Error ? tlErr_1.message : String(tlErr_1);
                console.log("  \u26A0\uFE0F  Trustline: ".concat(msg));
                return [3 /*break*/, 7];
            case 7:
                if (!(balance.usdc === 0)) return [3 /*break*/, 9];
                return [4 /*yield*/, stellar.mintTestUsdc(existing.secretKey, config_js_1.default.testUsdc.initialMintAmount)];
            case 8:
                _a.sent();
                _a.label = 9;
            case 9: return [4 /*yield*/, stellar.getBalance(existing.publicKey)];
            case 10:
                fresh = _a.sent();
                return [4 /*yield*/, db.updateWalletBalance(existing.publicKey, fresh.usdc, fresh.xlm)];
            case 11:
                _a.sent();
                console.log("  \uD83D\uDCB0 Balance : $".concat(fresh.usdc.toFixed(2), " USDC \u00B7 ").concat(fresh.xlm.toFixed(2), " XLM"));
                _a.label = 12;
            case 12: return [3 /*break*/, 26];
            case 13:
                console.log("  \uD83C\uDD95 Creating new wallet...");
                _a.label = 14;
            case 14:
                _a.trys.push([14, 25, , 26]);
                return [4 /*yield*/, stellar.createWallet()];
            case 15:
                wallet = _a.sent();
                return [4 /*yield*/, db.saveWallet(wallet)];
            case 16:
                _a.sent();
                console.log("  \u2705 Wallet  : ".concat(wallet.publicKey, " ").concat(wallet.isFunded ? '(funded via Friendbot)' : '(unfunded)'));
                console.log("  \uD83D\uDC5B Secret  : ".concat(wallet.secretKey));
                if (!wallet.isFunded) return [3 /*break*/, 24];
                _a.label = 17;
            case 17:
                _a.trys.push([17, 19, , 20]);
                return [4 /*yield*/, stellar.ensureTrustline(wallet.secretKey)];
            case 18:
                _a.sent();
                console.log("  \u2705 Trustline: USDC trustline established");
                return [3 /*break*/, 20];
            case 19:
                tlErr_2 = _a.sent();
                msg = tlErr_2 instanceof Error ? tlErr_2.message : String(tlErr_2);
                console.log("  \u26A0\uFE0F  Trustline: ".concat(msg));
                return [3 /*break*/, 20];
            case 20: return [4 /*yield*/, stellar.mintTestUsdc(wallet.secretKey, config_js_1.default.testUsdc.initialMintAmount)];
            case 21:
                _a.sent();
                return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
            case 22:
                balance = _a.sent();
                return [4 /*yield*/, db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm)];
            case 23:
                _a.sent();
                console.log("  \uD83D\uDCB0 Balance : $".concat(balance.usdc.toFixed(2), " USDC \u00B7 ").concat(balance.xlm.toFixed(2), " XLM"));
                if (balance.usdc > 0) {
                    console.log("  \uD83C\uDF89 Wallet is ready for test transactions!");
                }
                _a.label = 24;
            case 24: return [3 /*break*/, 26];
            case 25:
                err_2 = _a.sent();
                msg = err_2 instanceof Error ? err_2.message : String(err_2);
                console.log("  \u26A0\uFE0F  Wallet  : ".concat(msg));
                return [3 /*break*/, 26];
            case 26: return [2 /*return*/];
        }
    });
}); });
