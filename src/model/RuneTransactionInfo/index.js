"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const RuneTransactionInfo = new mongoose_1.default.Schema({
    poolAddress: { type: String, required: true },
    userAddress: { type: String, required: true },
    txId: { type: String, required: true },
    vout: { type: Number, required: true },
    userRuneAmount: { type: Number, required: true },
    poolRuneAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    swapType: { type: Number, required: true },
    isUsed: { type: Boolean, default: false },
    scriptpubkey: { type: String, default: true },
    createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});
const RuneTransactionInfoModal = mongoose_1.default.model("RuneTransactionInfo", RuneTransactionInfo);
exports.default = RuneTransactionInfoModal;
