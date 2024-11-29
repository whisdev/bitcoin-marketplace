import mongoose from "mongoose";

const RuneTransactionInfo = new mongoose.Schema({
	poolAddress: { type: String, required: true },
	userAddress: { type: String, required: true },
	txId: { type: String, required: true },
	vout: { type: Number, required: true },
	userRuneAmount: { type: Number, required: true },
	poolRuneAmount: { type: Number, required: true },
	btcAmount: { type: Number, required: true },
	swapType: { type: Number, required: true },
	isUsed: { type: Boolean, default: false },
	createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});

const RuneTransactionInfoModal = mongoose.model("RuneTransactionInfo", RuneTransactionInfo);

export default RuneTransactionInfoModal;
