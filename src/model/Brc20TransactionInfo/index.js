"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Brc20TransactionInfo = new mongoose_1.default.Schema({
    poolAddress: { type: String, required: true },
    userAddress: { type: String, required: true },
    txId: { type: String, required: true },
    tokenAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    swapType: { type: Number, required: true },
    createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});
const Brc20TransactionInfoModal = mongoose_1.default.model("Brc20TransactionInfo", Brc20TransactionInfo);
exports.default = Brc20TransactionInfoModal;
