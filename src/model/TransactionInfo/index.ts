import mongoose from "mongoose";

const TransactionInfo = new mongoose.Schema({
    poolAddress: { type: String, required: true },
    txId: { type: String, required: true },
    vout: { type: Number, required: true },
    userRuneAmount: { type: Number, required: true },
    poolRuneAmount: { type: Number, required: true },
    btcAmount: { type: Number, required: true },
    swapType: { type: Number, required: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: new Date() },
});

const TransactionInfoModal = mongoose.model("TransactionInfo", TransactionInfo);

export default TransactionInfoModal;