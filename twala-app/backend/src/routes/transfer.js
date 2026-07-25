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
var express_1 = require("express");
var stellar = require("../services/stellar.js");
var kotani = require("../services/kotani.js");
var rates_js_1 = require("../services/rates.js");
var db = require("../services/database.js");
var sms_js_1 = require("../services/sms.js");
var events_js_1 = require("../services/events.js");
var config_js_1 = require("../config.js");
var router = (0, express_1.Router)();
// ---------------------------------------------------------------------------
// GET /api/transfer/quote?amount=XXX
// ---------------------------------------------------------------------------
router.get('/quote', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var amount, rate, quote, err_1, msg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                amount = parseFloat(req.query.amount);
                if (!amount || amount <= 0) {
                    return [2 /*return*/, res.status(400).json({ success: false, message: 'Valid amount required' })];
                }
                if (amount < config_js_1.default.homeward.minTransferUsdc) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            message: "Minimum transfer is ".concat(config_js_1.default.homeward.minTransferUsdc, " USDC"),
                        })];
                }
                if (amount > config_js_1.default.homeward.maxTransferUsdc) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            message: "Maximum transfer is ".concat(config_js_1.default.homeward.maxTransferUsdc, " USDC"),
                        })];
                }
                return [4 /*yield*/, (0, rates_js_1.getExchangeRate)()];
            case 1:
                rate = _a.sent();
                quote = (0, rates_js_1.calculateQuote)(amount, rate);
                res.json({ success: true, data: quote });
                return [3 /*break*/, 3];
            case 2:
                err_1 = _a.sent();
                msg = err_1 instanceof Error ? err_1.message : String(err_1);
                res.status(500).json({ success: false, message: msg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// POST /api/transfer/offramp — Send USDC → Mobile Money (Uganda)
// ---------------------------------------------------------------------------
router.post('/offramp', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, amountUsdc, recipientName, recipientPhone, recipientNetwork, purpose, goalId, senderName, errors, wallet, balance, rate, quote, referenceId, kotaniEscrow, hasKotaniApiKey, destination, stellarTxHash, stellarErr_1, msg, newBalance, kotaniResult, tx, fromName, err_2, msg;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 15, , 16]);
                _a = req.body, amountUsdc = _a.amountUsdc, recipientName = _a.recipientName, recipientPhone = _a.recipientPhone, recipientNetwork = _a.recipientNetwork, purpose = _a.purpose, goalId = _a.goalId, senderName = _a.senderName;
                errors = [];
                if (!amountUsdc || amountUsdc <= 0)
                    errors.push('Valid amountUsdc required');
                if (!recipientName || !recipientName.trim())
                    errors.push('recipientName required');
                if (!purpose || !purpose.trim())
                    errors.push('purpose required');
                if (amountUsdc < config_js_1.default.homeward.minTransferUsdc)
                    errors.push("Minimum transfer is ".concat(config_js_1.default.homeward.minTransferUsdc, " USDC"));
                if (amountUsdc > config_js_1.default.homeward.maxTransferUsdc)
                    errors.push("Maximum transfer is ".concat(config_js_1.default.homeward.maxTransferUsdc, " USDC"));
                if (errors.length > 0) {
                    return [2 /*return*/, res.status(400).json({ success: false, message: errors.join('; ') })];
                }
                return [4 /*yield*/, db.getWallet()];
            case 1:
                wallet = _c.sent();
                if (!wallet) {
                    return [2 /*return*/, res.status(400).json({ success: false, message: 'No wallet found. Create a wallet first.' })];
                }
                return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
            case 2:
                balance = _c.sent();
                if (amountUsdc > balance.usdc) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            message: "Insufficient balance. You have $".concat(balance.usdc.toFixed(2), " USDC but trying to send $").concat(amountUsdc.toFixed(2), "."),
                            data: { balance: balance.usdc, shortfall: amountUsdc - balance.usdc },
                        })];
                }
                return [4 /*yield*/, (0, rates_js_1.getExchangeRate)()];
            case 3:
                rate = _c.sent();
                quote = (0, rates_js_1.calculateQuote)(amountUsdc, rate);
                referenceId = kotani.generateReferenceId();
                kotaniEscrow = config_js_1.default.kotani.escrowAddress;
                hasKotaniApiKey = !!config_js_1.default.kotani.apiKey;
                destination = hasKotaniApiKey && stellar.isValidPublicKey(kotaniEscrow)
                    ? kotaniEscrow
                    : config_js_1.default.stellar.usdcIssuer;
                stellarTxHash = '';
                _c.label = 4;
            case 4:
                _c.trys.push([4, 7, , 8]);
                return [4 /*yield*/, stellar.ensureTrustline(wallet.secretKey)];
            case 5:
                _c.sent();
                if (!stellar.isValidPublicKey(destination)) {
                    throw new Error("Invalid destination address: ".concat(destination));
                }
                return [4 /*yield*/, stellar.submitPayment(wallet.secretKey, destination, quote.sendAmountUsdc.toFixed(7), referenceId)];
            case 6:
                stellarTxHash = _c.sent();
                console.log("  \u2705 Stellar payment sent: ".concat(stellarTxHash.slice(0, 8), "... (").concat(quote.sendAmountUsdc, " USDC \u2192 ").concat(destination.slice(0, 8), "...)"));
                return [3 /*break*/, 8];
            case 7:
                stellarErr_1 = _c.sent();
                msg = stellarErr_1 instanceof Error ? stellarErr_1.message : String(stellarErr_1);
                console.warn("  \u26A0\uFE0F Stellar payment failed: ".concat(msg, " \u2014 using demo hash"));
                stellarTxHash = "demo-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 10));
                return [3 /*break*/, 8];
            case 8: return [4 /*yield*/, stellar.getBalance(wallet.publicKey)];
            case 9:
                newBalance = _c.sent();
                return [4 /*yield*/, db.updateWalletBalance(wallet.publicKey, newBalance.usdc, newBalance.xlm)];
            case 10:
                _c.sent();
                (0, events_js_1.notifyChange)();
                return [4 /*yield*/, kotani.createOfframp({
                        referenceId: referenceId,
                        cryptoAmount: quote.sendAmountUsdc, currency: 'UGX',
                        chain: 'STELLAR', token: 'USDC', transactionHash: stellarTxHash,
                    })];
            case 11:
                kotaniResult = _c.sent();
                return [4 /*yield*/, db.createTransaction({
                        type: 'sent', amountUsdc: quote.sendAmountUsdc, amountUgx: quote.receiveAmountUgx,
                        rate: quote.rate, recipientName: recipientName.trim(), recipientPhone: recipientPhone || '',
                        recipientNetwork: recipientNetwork || 'MTN',
                        status: 'pending', purpose: purpose.trim(),
                        stellarTxHash: stellarTxHash,
                        kotaniReferenceId: referenceId, kotaniStatus: ((_b = kotaniResult.data) === null || _b === void 0 ? void 0 : _b.status) || 'pending',
                        goalId: goalId || undefined,
                    })];
            case 12:
                tx = _c.sent();
                if (!goalId) return [3 /*break*/, 14];
                return [4 /*yield*/, db.contributeToGoal(goalId, quote.receiveAmountUgx)];
            case 13:
                _c.sent();
                _c.label = 14;
            case 14:
                // Step 7: Send response immediately — SMS is fire-and-forget
                if (recipientPhone) {
                    fromName = (senderName || '').trim() || recipientName.trim();
                    (0, sms_js_1.sendTransferNotificationAsync)({
                        phoneNumber: recipientPhone,
                        recipientName: recipientName.trim(),
                        amountUgx: quote.receiveAmountUgx,
                        amountUsdc: quote.sendAmountUsdc,
                        senderName: fromName,
                    });
                }
                res.json({
                    success: true,
                    data: {
                        transaction: tx,
                        quote: quote,
                        kotaniReferenceId: referenceId,
                        balance: newBalance.usdc,
                        sms: null, // SMS sent async, check logs
                        message: "Sent $".concat(quote.sendAmountUsdc.toFixed(2), " USDC \u2192 ").concat(recipientName.trim(), ". Delivering ~").concat(quote.receiveAmountUgx.toLocaleString(), " UGX via ").concat(recipientNetwork || 'MTN', " Mobile Money. Reference: ").concat(referenceId.slice(-8)),
                    },
                });
                return [3 /*break*/, 16];
            case 15:
                err_2 = _c.sent();
                msg = err_2 instanceof Error ? err_2.message : String(err_2);
                console.error("  \u274C Offramp error: ".concat(msg));
                res.status(500).json({ success: false, message: "Transfer failed: ".concat(msg) });
                return [3 /*break*/, 16];
            case 16: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// POST /api/transfer/onramp — Mobile Money → USDC (deposit from Uganda)
// ---------------------------------------------------------------------------
router.post('/onramp', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fiatAmount, phoneNumber, network, currency, errors, rate, cryptoAmount, referenceId, kotaniResult, tx, err_3, msg;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                _a = req.body, fiatAmount = _a.fiatAmount, phoneNumber = _a.phoneNumber, network = _a.network;
                currency = 'UGX';
                errors = [];
                if (!fiatAmount || fiatAmount <= 0)
                    errors.push('Valid fiatAmount required');
                if (!phoneNumber || !phoneNumber.trim())
                    errors.push('phoneNumber required');
                if (!network || !['MTN', 'AIRTEL'].includes(network))
                    errors.push('network must be MTN or AIRTEL');
                if (fiatAmount < 10000)
                    errors.push('Minimum onramp is UGX 10,000');
                if (fiatAmount > 20000000)
                    errors.push('Maximum onramp is UGX 20,000,000');
                if (errors.length > 0) {
                    return [2 /*return*/, res.status(400).json({ success: false, message: errors.join('; ') })];
                }
                return [4 /*yield*/, (0, rates_js_1.getExchangeRate)()];
            case 1:
                rate = _c.sent();
                cryptoAmount = (fiatAmount / rate.usdcToUgx) * 0.98;
                referenceId = kotani.generateReferenceId();
                return [4 /*yield*/, kotani.createOnramp({
                        referenceId: referenceId,
                        fiatAmount: fiatAmount,
                        currency: currency,
                        chain: 'STELLAR',
                        token: 'USDC',
                        phoneNumber: phoneNumber.trim(),
                        network: network,
                    })];
            case 2:
                kotaniResult = _c.sent();
                return [4 /*yield*/, db.createTransaction({
                        type: 'received',
                        amountUsdc: cryptoAmount,
                        amountUgx: fiatAmount,
                        rate: rate.usdcToUgx,
                        recipientName: phoneNumber.trim(),
                        recipientPhone: phoneNumber.trim(),
                        recipientNetwork: network,
                        status: 'pending',
                        purpose: 'Mobile Money Deposit',
                        kotaniReferenceId: referenceId,
                        kotaniStatus: ((_b = kotaniResult.data) === null || _b === void 0 ? void 0 : _b.status) || 'pending',
                    })];
            case 3:
                tx = _c.sent();
                res.json({
                    success: true,
                    data: {
                        transaction: tx,
                        kotaniReferenceId: referenceId,
                        message: "Deposit request submitted! Pay UGX ".concat(fiatAmount.toLocaleString(), " via ").concat(network, " Mobile Money to receive ~$").concat(cryptoAmount.toFixed(2), " USDC. Reference: ").concat(referenceId.slice(-8)),
                    },
                });
                return [3 /*break*/, 5];
            case 4:
                err_3 = _c.sent();
                msg = err_3 instanceof Error ? err_3.message : String(err_3);
                res.status(500).json({ success: false, message: "Onramp failed: ".concat(msg) });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// GET /api/transfer/status/:referenceId
// ---------------------------------------------------------------------------
router.get('/status/:referenceId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var referenceId, tx, statusResult, _a, kotaniStatus, newStatus, err_4, msg;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                referenceId = req.params.referenceId;
                return [4 /*yield*/, db.getTransactionByKotaniRef(referenceId)];
            case 1:
                tx = _b.sent();
                if (!tx) {
                    return [2 /*return*/, res.status(404).json({ success: false, message: 'Transaction not found' })];
                }
                if (!(tx.type === 'sent')) return [3 /*break*/, 3];
                return [4 /*yield*/, kotani.getOfframpStatus(referenceId)];
            case 2:
                _a = _b.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, kotani.getOnrampStatus(referenceId)];
            case 4:
                _a = _b.sent();
                _b.label = 5;
            case 5:
                statusResult = _a;
                if (!(statusResult.success && statusResult.data)) return [3 /*break*/, 7];
                kotaniStatus = statusResult.data.status;
                newStatus = void 0;
                if (kotaniStatus === 'completed' && tx.status === 'pending') {
                    newStatus = 'completed';
                }
                else if (kotaniStatus === 'failed' && tx.status === 'pending') {
                    newStatus = 'failed';
                }
                if (!newStatus) return [3 /*break*/, 7];
                return [4 /*yield*/, db.updateTransaction(tx.id, { status: newStatus, kotaniStatus: kotaniStatus })];
            case 6:
                _b.sent();
                tx.status = newStatus;
                tx.kotaniStatus = kotaniStatus;
                _b.label = 7;
            case 7:
                res.json({
                    success: true,
                    data: {
                        transaction: tx,
                        kotaniStatus: statusResult.data || null,
                    },
                });
                return [3 /*break*/, 9];
            case 8:
                err_4 = _b.sent();
                msg = err_4 instanceof Error ? err_4.message : String(err_4);
                res.status(500).json({ success: false, message: msg });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// POST /api/transfer/webhook — Kotani Pay webhook handler
// ---------------------------------------------------------------------------
router.post('/webhook', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var payload, signature, tx, err_5, msg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                payload = req.body;
                signature = req.headers['x-kotani-signature'];
                if (!kotani.verifyWebhookSignature(payload, signature, config_js_1.default.kotani.apiKey)) {
                    return [2 /*return*/, res.status(401).json({ success: false, message: 'Invalid signature' })];
                }
                return [4 /*yield*/, db.getTransactionByKotaniRef(payload.referenceId)];
            case 1:
                tx = _a.sent();
                if (!tx) return [3 /*break*/, 5];
                if (!payload.event.endsWith('.completed')) return [3 /*break*/, 3];
                return [4 /*yield*/, db.updateTransaction(tx.id, {
                        status: 'completed',
                        kotaniStatus: 'completed',
                        stellarTxHash: payload.transactionHash || tx.stellarTxHash,
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 5];
            case 3:
                if (!payload.event.endsWith('.failed')) return [3 /*break*/, 5];
                return [4 /*yield*/, db.updateTransaction(tx.id, {
                        status: 'failed',
                        kotaniStatus: 'failed',
                    })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5:
                res.json({ success: true, message: 'Webhook received' });
                return [3 /*break*/, 7];
            case 6:
                err_5 = _a.sent();
                msg = err_5 instanceof Error ? err_5.message : String(err_5);
                res.status(500).json({ success: false, message: msg });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// POST /api/transfer/retry/:referenceId
// ---------------------------------------------------------------------------
router.post('/retry/:referenceId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var referenceId, tx, kotaniResult, newRefId, err_6, msg;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                referenceId = req.params.referenceId;
                return [4 /*yield*/, db.getTransactionByKotaniRef(referenceId)];
            case 1:
                tx = _b.sent();
                if (!tx) {
                    return [2 /*return*/, res.status(404).json({ success: false, message: 'Transaction not found' })];
                }
                if (tx.status !== 'failed') {
                    return [2 /*return*/, res.status(400).json({ success: false, message: 'Only failed transactions can be retried' })];
                }
                return [4 /*yield*/, db.updateTransaction(tx.id, { status: 'pending', kotaniStatus: 'pending' })];
            case 2:
                _b.sent();
                tx.status = 'pending';
                tx.kotaniStatus = 'pending';
                if (!(tx.type === 'sent')) return [3 /*break*/, 5];
                return [4 /*yield*/, kotani.createOfframp({
                        referenceId: kotani.generateReferenceId(),
                        cryptoAmount: tx.amountUsdc,
                        currency: 'UGX',
                        chain: 'STELLAR',
                        token: 'USDC',
                        transactionHash: tx.stellarTxHash,
                    })];
            case 3:
                kotaniResult = _b.sent();
                newRefId = ((_a = kotaniResult.data) === null || _a === void 0 ? void 0 : _a.referenceId) || tx.kotaniReferenceId;
                return [4 /*yield*/, db.updateTransaction(tx.id, { kotaniReferenceId: newRefId })];
            case 4:
                _b.sent();
                tx.kotaniReferenceId = newRefId;
                _b.label = 5;
            case 5:
                res.json({ success: true, data: { transaction: tx }, message: 'Retry submitted' });
                return [3 /*break*/, 7];
            case 6:
                err_6 = _b.sent();
                msg = err_6 instanceof Error ? err_6.message : String(err_6);
                res.status(500).json({ success: false, message: msg });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// ---------------------------------------------------------------------------
// GET /api/transfer/kotani-balance
// ---------------------------------------------------------------------------
router.get('/kotani-balance', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var result, err_7, msg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, kotani.getMerchantBalance()];
            case 1:
                result = _a.sent();
                res.json(result);
                return [3 /*break*/, 3];
            case 2:
                err_7 = _a.sent();
                msg = err_7 instanceof Error ? err_7.message : String(err_7);
                res.status(500).json({ success: false, message: msg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
