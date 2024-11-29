import mongoose from "mongoose";

const RunePoolInfo = new mongoose.Schema({
	address: { type: String, required: true },
	publickey: { type: String, required: true },
	privatekey: { type: String, required: true },
	runeId: { type: String, required: true },
	ticker: { type: String, required: true },
	divisibility: { type: Number, required: true },
	tokenAmount: { type: Number, required: true },
	btcAmount: { type: Number, required: true },
	volume: { type: Number, default: 0 },
	isLocked: { type: Boolean, default: false, required: true },
	lockedByAddress: { type: String },
	createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});

const RunePoolInfoModal = mongoose.model("RunePoolInfo", RunePoolInfo);

export default RunePoolInfoModal;
