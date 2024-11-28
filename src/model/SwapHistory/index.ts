import mongoose from "mongoose";

const SwapHistory = new mongoose.Schema({
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

const SwapHistoryModal = mongoose.model("SwapHistory", SwapHistory);

export default SwapHistoryModal;