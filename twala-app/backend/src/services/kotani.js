"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.onOfframpComplete = onOfframpComplete;
exports.createOfframp = createOfframp;
exports.getOfframpStatus = getOfframpStatus;
exports.createOnramp = createOnramp;
exports.getOnrampStatus = getOnrampStatus;
exports.getMerchantBalance = getMerchantBalance;
exports.registerWebhook = registerWebhook;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.generateReferenceId = generateReferenceId;
var config_js_1 = require("../config.js");
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
var BASE_URL = config_js_1.default.kotani.useSandbox
    ? config_js_1.default.kotani.sandboxUrl
    : config_js_1.default.kotani.productionUrl;
function headers() {
    return {
        'Content-Type': 'application/json',
        Authorization: "Bearer ".concat(config_js_1.default.kotani.apiKey),
    };
}
var _onOfframpComplete = null;
function onOfframpComplete(cb) {
    _onOfframpComplete = cb;
}
function isDemoMode() {
    return !config_js_1.default.kotani.apiKey;
}
function demoDelay(ms) {
    if (ms === void 0) { ms = 600; }
    return new Promise(function (r) { return setTimeout(r, ms); });
}
var demoOfframps = new Map();
var demoOnramps = new Map();
var demoIdCounter = 0;
function nextDemoRefId() {
    return "homeward-demo-".concat(Date.now(), "-").concat(++demoIdCounter);
}
// ---------------------------------------------------------------------------
// Offramp — USDC → Mobile Money (HomeWard → Uganda)
// ---------------------------------------------------------------------------
function createOfframp(params) {
    return __awaiter(this, void 0, void 0, function () {
        var rate, fee, received, data_1, res, json, err_1, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay()];
                case 1:
                    _a.sent();
                    rate = 3750;
                    fee = Math.max(params.cryptoAmount * 0.02, 1);
                    received = params.cryptoAmount - fee;
                    data_1 = {
                        referenceId: params.referenceId,
                        status: 'pending',
                        cryptoAmount: params.cryptoAmount,
                        cryptoAmountReceived: received,
                        fiatAmount: Math.round(received * rate),
                        feeInCrypto: fee,
                        feeInFiat: Math.round(fee * rate),
                        rate: rate,
                        transactionHash: params.transactionHash || "demo-tx-".concat(Date.now()),
                        createdAt: new Date().toISOString(),
                    };
                    demoOfframps.set(data_1.referenceId, data_1);
                    // Simulate completion after 5s
                    setTimeout(function () {
                        var stored = demoOfframps.get(data_1.referenceId);
                        if (stored) {
                            stored.status = 'completed';
                            stored.completedAt = new Date().toISOString();
                            demoOfframps.set(data_1.referenceId, stored);
                            if (_onOfframpComplete) {
                                _onOfframpComplete(data_1.referenceId, 'completed');
                            }
                        }
                    }, 5000);
                    return [2 /*return*/, { success: true, statusCode: 200, message: 'Offramp created successfully', data: data_1 }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/offramp"), {
                            method: 'POST',
                            headers: headers(),
                            body: JSON.stringify({
                                referenceId: params.referenceId,
                                cryptoAmount: params.cryptoAmount,
                                currency: params.currency,
                                chain: params.chain,
                                token: params.token,
                                transactionHash: params.transactionHash,
                            }),
                        })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_1 = _a.sent();
                    msg = err_1 instanceof Error ? err_1.message : String(err_1);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getOfframpStatus(referenceId) {
    return __awaiter(this, void 0, void 0, function () {
        var data, res, json, err_2, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay(300)];
                case 1:
                    _a.sent();
                    data = demoOfframps.get(referenceId);
                    if (!data) {
                        return [2 /*return*/, { success: false, statusCode: 404, message: 'Offramp not found' }];
                    }
                    return [2 /*return*/, { success: true, statusCode: 200, message: 'OK', data: data }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/offramp/status/").concat(referenceId), {
                            headers: headers(),
                        })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_2 = _a.sent();
                    msg = err_2 instanceof Error ? err_2.message : String(err_2);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Onramp — Mobile Money → USDC (Uganda → HomeWard)
// ---------------------------------------------------------------------------
function createOnramp(params) {
    return __awaiter(this, void 0, void 0, function () {
        var rate, fee, cryptoAmount, data_2, res, json, err_3, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay()];
                case 1:
                    _a.sent();
                    rate = 3750;
                    fee = Math.max(params.fiatAmount * 0.02, 1000);
                    cryptoAmount = (params.fiatAmount - fee) / rate;
                    data_2 = {
                        referenceId: params.referenceId,
                        status: 'pending',
                        fiatAmount: params.fiatAmount,
                        cryptoAmount: cryptoAmount,
                        cryptoAmountSent: cryptoAmount * 0.98,
                        feeInFiat: fee,
                        feeInCrypto: fee / rate,
                        rate: rate,
                        phoneNumber: params.phoneNumber,
                        network: params.network,
                        transactionHash: '',
                        createdAt: new Date().toISOString(),
                    };
                    demoOnramps.set(data_2.referenceId, data_2);
                    // Simulate incoming USDC after 30s
                    setTimeout(function () {
                        var stored = demoOnramps.get(data_2.referenceId);
                        if (stored) {
                            stored.status = 'completed';
                            stored.transactionHash = "demo-incoming-".concat(Date.now());
                            stored.completedAt = new Date().toISOString();
                            demoOnramps.set(data_2.referenceId, stored);
                        }
                    }, 30000);
                    return [2 /*return*/, { success: true, statusCode: 200, message: 'Onramp created successfully', data: data_2 }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/onramp"), {
                            method: 'POST',
                            headers: headers(),
                            body: JSON.stringify({
                                referenceId: params.referenceId,
                                fiatAmount: params.fiatAmount,
                                currency: params.currency,
                                chain: params.chain,
                                token: params.token,
                                phoneNumber: params.phoneNumber,
                                network: params.network,
                            }),
                        })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_3 = _a.sent();
                    msg = err_3 instanceof Error ? err_3.message : String(err_3);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getOnrampStatus(referenceId) {
    return __awaiter(this, void 0, void 0, function () {
        var data, res, json, err_4, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay(300)];
                case 1:
                    _a.sent();
                    data = demoOnramps.get(referenceId);
                    if (!data) {
                        return [2 /*return*/, { success: false, statusCode: 404, message: 'Onramp not found' }];
                    }
                    return [2 /*return*/, { success: true, statusCode: 200, message: 'OK', data: data }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/onramp/status/").concat(referenceId), {
                            headers: headers(),
                        })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_4 = _a.sent();
                    msg = err_4 instanceof Error ? err_4.message : String(err_4);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Merchant balance
// ---------------------------------------------------------------------------
function getMerchantBalance() {
    return __awaiter(this, void 0, void 0, function () {
        var res, json, err_5, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay(300)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            statusCode: 200,
                            message: 'OK',
                            data: [
                                { asset: 'USDC', chain: 'STELLAR', balance: 25000, locked: 3200, available: 21800 },
                                { asset: 'XLM', chain: 'STELLAR', balance: 5000, locked: 0, available: 5000 },
                            ],
                        }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/balance"), { headers: headers() })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_5 = _a.sent();
                    msg = err_5 instanceof Error ? err_5.message : String(err_5);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Webhook registration
// ---------------------------------------------------------------------------
function registerWebhook(url) {
    return __awaiter(this, void 0, void 0, function () {
        var res, json, err_6, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDemoMode()) return [3 /*break*/, 2];
                    return [4 /*yield*/, demoDelay()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { success: true, statusCode: 200, message: 'Webhook registered (demo)' }];
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(BASE_URL, "/api/v3/webhook"), {
                            method: 'POST',
                            headers: headers(),
                            body: JSON.stringify({
                                url: url,
                                events: ['offramp.completed', 'offramp.failed', 'onramp.completed', 'onramp.failed'],
                            }),
                        })];
                case 3:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 4:
                    json = _a.sent();
                    return [2 /*return*/, __assign({ success: res.ok, statusCode: res.status }, json)];
                case 5:
                    err_6 = _a.sent();
                    msg = err_6 instanceof Error ? err_6.message : String(err_6);
                    return [2 /*return*/, { success: false, statusCode: 0, message: "Network error: ".concat(msg), error: msg }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Webhook payload verification
// ---------------------------------------------------------------------------
function verifyWebhookSignature(payload, signature, secret) {
    if (isDemoMode())
        return true;
    // In production, verify HMAC-SHA256 signature
    // const crypto = require('crypto');
    // const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return signature === secret;
}
// ---------------------------------------------------------------------------
// Helper: Generate unique reference ID
// ---------------------------------------------------------------------------
function generateReferenceId() {
    return isDemoMode()
        ? nextDemoRefId()
        : "homeward-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 10));
}
