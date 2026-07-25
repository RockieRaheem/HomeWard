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
exports.sendTransferNotification = sendTransferNotification;
exports.sendTransferNotificationAsync = sendTransferNotificationAsync;
var config_js_1 = require("../config.js");
function isDemoMode() {
    return !config_js_1.default.africasTalking.apiKey;
}
function sendViaApi(to, message) {
    return __awaiter(this, void 0, void 0, function () {
        var params, url, res, data, errMsg, err_1, msg;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 3, , 4]);
                    params = new URLSearchParams({
                        username: config_js_1.default.africasTalking.username,
                        to: to,
                        message: message,
                    });
                    if (config_js_1.default.africasTalking.senderId && config_js_1.default.africasTalking.username !== 'sandbox') {
                        params.append('from', config_js_1.default.africasTalking.senderId);
                    }
                    url = "".concat(config_js_1.default.africasTalking.baseUrl, "/messaging");
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'apiKey': config_js_1.default.africasTalking.apiKey,
                                'Accept': 'application/json',
                            },
                            body: params.toString(),
                            signal: AbortSignal.timeout(8000),
                        })];
                case 1:
                    res = _e.sent();
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _e.sent();
                    if (res.ok && ((_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.SMSMessageData) === null || _a === void 0 ? void 0 : _a.Recipients) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.status) === 'Success') {
                        return [2 /*return*/, { success: true, message: 'SMS sent', recipient: to }];
                    }
                    errMsg = ((_d = data === null || data === void 0 ? void 0 : data.SMSMessageData) === null || _d === void 0 ? void 0 : _d.Message) || (data === null || data === void 0 ? void 0 : data.error) || "HTTP ".concat(res.status);
                    return [2 /*return*/, { success: false, message: "SMS failed: ".concat(errMsg), recipient: to }];
                case 3:
                    err_1 = _e.sent();
                    msg = err_1 instanceof Error ? err_1.message : String(err_1);
                    return [2 /*return*/, { success: false, message: "SMS error: ".concat(msg), recipient: to }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function buildSmsContent(params) {
    var ref = "HOMEWARD-".concat(Date.now().toString(36).toUpperCase().slice(-6));
    var date = new Date().toLocaleDateString('en-UG', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return [
        "HOMEWARD",
        "",
        "Hi ".concat(params.recipientName, ","),
        "",
        "You've received UGX ".concat(params.amountUgx.toLocaleString(), " from ").concat(params.senderName, "."),
        "Converted from $".concat(params.amountUsdc.toFixed(2), " USDC at 1 USDC = UGX ").concat((params.amountUgx / params.amountUsdc).toFixed(0), "."),
        "",
        "Reference: ".concat(ref),
        "Date: ".concat(date),
        "",
        "Sent via HomeWard \u2014 Secure cross-border payments",
    ].join('\n');
}
function sendTransferNotification(params) {
    return __awaiter(this, void 0, void 0, function () {
        var message, formattedPhone;
        return __generator(this, function (_a) {
            if (isDemoMode()) {
                message = buildSmsContent(params);
                console.log("  \uD83D\uDCF1 SMS (demo) \u2192 ".concat(params.phoneNumber, ":\n").concat('-'.repeat(40), "\n").concat(message, "\n").concat('-'.repeat(40)));
                return [2 /*return*/, { success: true, message: 'SMS logged (demo mode)', recipient: params.phoneNumber }];
            }
            if (!params.phoneNumber) {
                return [2 /*return*/, { success: false, message: 'No phone number provided' }];
            }
            formattedPhone = params.phoneNumber.startsWith('+') ? params.phoneNumber : "+".concat(params.phoneNumber);
            return [2 /*return*/, sendViaApi(formattedPhone, buildSmsContent(params))];
        });
    });
}
function sendTransferNotificationAsync(params) {
    return __awaiter(this, void 0, void 0, function () {
        var result, err_2, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, sendTransferNotification(params)];
                case 1:
                    result = _a.sent();
                    if (result.success) {
                        console.log("  \u2705 SMS sent to ".concat(params.phoneNumber));
                    }
                    else {
                        console.warn("  \u26A0\uFE0F SMS: ".concat(result.message));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    msg = err_2 instanceof Error ? err_2.message : String(err_2);
                    console.warn("  \u26A0\uFE0F SMS error: ".concat(msg));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
