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
exports.getBrc20PullInfo = exports.getRunePullInfo = exports.getPullInfo = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const dotenv_1 = __importDefault(require("dotenv"));
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);
const RunePoolInfo_1 = __importDefault(require("../model/RunePoolInfo"));
const Brc20PoolInfo_1 = __importDefault(require("../model/Brc20PoolInfo"));
dotenv_1.default.config();
const getPullInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const runePoolInfo = yield RunePoolInfo_1.default.find();
    const brc20PoolInfo = yield Brc20PoolInfo_1.default.find();
    let runePoolInfoSet;
    let brc20PoolInfoSet;
    if (runePoolInfo) {
        runePoolInfoSet = runePoolInfo.map((item) => {
            return {
                poolAddress: item.address,
                tokenType: "RUNE",
                runeId: item.runeId,
                runeAmount: item.tokenAmount / Math.pow(10, item.divisibility),
                btcAmount: item.btcAmount,
                ticker: item.ticker,
                price: (item.btcAmount / item.tokenAmount).toFixed(6),
                createdAt: item.createdAt,
            };
        });
    }
    if (brc20PoolInfo) {
        brc20PoolInfoSet = brc20PoolInfo.map((item) => {
            return {
                poolAddress: item.address,
                ticker: item.ticker,
                tokenType: "BRC20",
                safeTokenAmount: item.safeTokenAmount,
                unsafeTokenAmount: item.unsafeTokenAmount,
                btcAmount: item.btcAmount,
                price: (item.btcAmount / (item.safeTokenAmount + item.unsafeTokenAmount)).toFixed(6),
                createdAt: item.createdAt,
            };
        });
    }
    return {
        success: true,
        message: "Fetch All Info",
        payload: {
            runePoolInfo: runePoolInfoSet,
            brc20PoolInfo: brc20PoolInfoSet,
        },
    };
});
exports.getPullInfo = getPullInfo;
const getRunePullInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const runePoolInfo = yield RunePoolInfo_1.default.find();
    let runePoolInfoSet;
    if (runePoolInfo) {
        runePoolInfoSet = runePoolInfo.map((item) => {
            return {
                poolAddress: item.address,
                runeId: item.runeId,
                runeAmount: item.tokenAmount,
                tokenType: "RUNE",
                btcAmount: item.btcAmount,
                ticker: item.ticker,
                price: (item.btcAmount / item.tokenAmount).toFixed(6),
                createdAt: item.createdAt,
            };
        });
    }
    return {
        success: true,
        message: "Fetch Rune pull Info",
        payload: runePoolInfoSet,
    };
});
exports.getRunePullInfo = getRunePullInfo;
const getBrc20PullInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const brc20PoolInfo = yield Brc20PoolInfo_1.default.find();
    let brc20PoolInfoSet;
    if (brc20PoolInfo) {
        brc20PoolInfoSet = brc20PoolInfo.map((item) => {
            return {
                poolAddress: item.address,
                ticker: item.ticker,
                safeTokenAmount: item.safeTokenAmount,
                unsafeTokenAmount: item.unsafeTokenAmount,
                tokenType: "BRC20",
                btcAmount: item.btcAmount,
                price: (item.btcAmount / (item.safeTokenAmount + item.unsafeTokenAmount)).toFixed(6),
                createdAt: item.createdAt,
            };
        });
    }
    return {
        success: true,
        message: "Fetch Brc20 pull Info",
        payload: brc20PoolInfoSet,
    };
});
exports.getBrc20PullInfo = getBrc20PullInfo;
