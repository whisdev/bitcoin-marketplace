"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const SwapHistory = new mongoose_1.default.Schema({
    poolAddress: { type: String, required: true },
    userAddress: { type: String, required: true },
    tokenType: { type: String, required: true },
    txId: { type: String, required: true },
    tokenAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    swapType: { type: Number, required: true },
    // vout: { type: Number, required: true },
    createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});
const SwapHistoryModal = mongoose_1.default.model("SwapHistory", SwapHistory);
exports.default = SwapHistoryModal;
