import mongoose from "mongoose";

const Brc20PoolInfo = new mongoose.Schema({
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

const Brc20PoolInfoModal = mongoose.model("Brc20PoolInfo", Brc20PoolInfo);

export default Brc20PoolInfoModal;
