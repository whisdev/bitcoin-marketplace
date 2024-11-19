import mongoose from "mongoose";

const TransactionInfo = new mongoose.Schema({
    poolId: {type:String, required: true},
    txId: { type: String, required: true },
    vout: {type: Number, required: true},
    runeAmount: {type: Number, required: true},
    isConfirmed: {type:Boolean, default: false},
    createdAt: { type: Date, default: new Date() },
});

const TransactionInfoModal = mongoose.model("TransactionInfo", TransactionInfo);

export default TransactionInfoModal;