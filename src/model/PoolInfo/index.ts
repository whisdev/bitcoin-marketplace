import mongoose from "mongoose";

const PoolInfo = new mongoose.Schema({
    address: { type: String, required: true },
    publickey: { type: String, required: true },
    privatekey: { type: String, required: true },
    runeBlockNumber: { type: Number, required: true },
    runeTxout: { type: Number, required: true },
    divisibility: { type: Number, required: true },
    runeAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    createdAt: { type: Date, default: new Date() },
});

const PoolInfoModal = mongoose.model("PoolInfo", PoolInfo);

export default PoolInfoModal;