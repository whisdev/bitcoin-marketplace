import mongoose from "mongoose";

const SwapHistory = new mongoose.Schema({
    address: { type: String, required: true },
    swapList: [
        {
            swapType: { type: Number, required: true }, // 1 : rune -> btc, 2: btc -> rune,
            txId: { type: String, required: false }
        }
    ],
    createdAt: { type: Date, default: new Date() },
});

const SwapHistoryModal = mongoose.model("SwapHistory", SwapHistory);

export default SwapHistoryModal;