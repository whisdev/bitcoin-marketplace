"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Brc20PoolInfo = new mongoose_1.default.Schema({
    address: { type: String, required: true },
    publickey: { type: String, required: true },
    privatekey: { type: String, required: true },
    ticker: { type: String, required: true },
    safeTokenAmount: { type: Number, required: true },
    unsafeTokenAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    volume: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false, required: true },
    lockedByAddress: { type: String },
    createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});
const Brc20PoolInfoModal = mongoose_1.default.model("Brc20PoolInfo", Brc20PoolInfo);
exports.default = Brc20PoolInfoModal;
