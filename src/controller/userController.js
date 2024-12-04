"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletBalance = exports.getUserBrc20Info = exports.getUserRuneInfo = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const dotenv_1 = __importDefault(require("dotenv"));
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);
const service_1 = require("../service/service");
dotenv_1.default.config();
const getUserRuneInfo = (userAddress) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield (0, service_1.getRuneBalanceListByAddress)(userAddress);
    const userRuneInfo = response;
    return {
        success: true,
        message: "get user rune info successfully",
        payload: userRuneInfo,
    };
});
exports.getUserRuneInfo = getUserRuneInfo;
const getUserBrc20Info = (userAddress) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield (0, service_1.getBrc20SummaryByAddress)(userAddress);
    const userBrc20Info = response;
    return {
        success: true,
        message: "get user rune info successfully",
        payload: userBrc20Info,
    };
});
exports.getUserBrc20Info = getUserBrc20Info;
const getWalletBalance = (userAddress) => __awaiter(void 0, void 0, void 0, function* () {
    // const response = await getBtcBalanceByAddress(userAddress);
    const utxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    let balance = 0;
    for (const utxo of utxos) {
        if (utxo.value > 1000) {
            balance += utxo.value;
        }
    }
    // const balance = response;
    return {
        success: true,
        message: "get user rune info successfully",
        payload: balance,
    };
});
exports.getWalletBalance = getWalletBalance;
