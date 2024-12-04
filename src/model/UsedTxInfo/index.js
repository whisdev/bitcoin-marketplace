"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const UsedTxInfo = new mongoose_1.default.Schema({
    txid: { type: String, required: true },
    confirmedTx: { type: String, required: true },
    createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});
const UsedTxInfoModal = mongoose_1.default.model("UsedTxInfo", UsedTxInfo);
exports.default = UsedTxInfoModal;
