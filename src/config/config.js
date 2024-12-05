"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENAPI_UNISAT_URL = exports.SIGNATURE_SIZE = exports.networkType = exports.SEND_UTXO_FEE_LIMIT = exports.STANDARD_RUNE_UTXO_VALUE = exports.MongoDBUrl = exports.privateKey = exports.OPENAPI_UNISAT_TOKEN = exports.userSendBrc20Fee = exports.lockTime = exports.testFeeRate = exports.testVersion = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// user info
exports.testVersion = true;
exports.testFeeRate = 4000;
// export const brc20LockTime = 30;
// export const runeLockTime = 15;
exports.lockTime = 15;
exports.userSendBrc20Fee = exports.testVersion ? 400000 : 30000; // fee when user inscribe and send brc20 token to pool
// .env info
exports.OPENAPI_UNISAT_TOKEN = process.env.OPENAPI_UNISAT_TOKEN;
exports.privateKey = process.env.WIF_KEY;
exports.MongoDBUrl = process.env.MONGDB_URL;
// const info
exports.STANDARD_RUNE_UTXO_VALUE = 546;
exports.SEND_UTXO_FEE_LIMIT = 10000;
exports.networkType = exports.testVersion ? "testnet" : "mainnet";
exports.SIGNATURE_SIZE = 126;
// Api info
exports.OPENAPI_UNISAT_URL = exports.testVersion
    ? "https://open-api-testnet.unisat.io"
    : "https://open-api.unisat.io";
