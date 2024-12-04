import mongoose from "mongoose";

const UsedTxInfo = new mongoose.Schema({
	txid: { type: String, required: true },
	confirmedTx: { type: String, required: true },
	createdAt: { type: Date, default: new Date(new Date().toUTCString()) },
});

const UsedTxInfoModal = mongoose.model("UsedTxInfo", UsedTxInfo);

export default UsedTxInfoModal;
