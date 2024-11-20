import mongoose from "mongoose";

const PoolInfo = new mongoose.Schema({
    address: { type: String, required: true },
    publickey: { type: String, required: true },
    privatekey: { type: String, required: true },
    runeId: { type: String, required: true },
    ticker: { type: String, required: true },
    tokenType: { type: String, required: true },
    divisibility: { type: Number, required: true },
    runeAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    volume: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false, required: true },
    lockedByAddress: { type: String },
    createdAt: { type: Date, default: new Date() },
});

const PoolInfoModal = mongoose.model("PoolInfo", PoolInfo);

export default PoolInfoModal;