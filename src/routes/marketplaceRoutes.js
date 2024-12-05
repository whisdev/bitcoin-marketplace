"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const marketplaceController_1 = require("../controller/marketplaceController");
const service_1 = require("../service/service");
const marketplaceRouter = (0, express_1.Router)();
marketplaceRouter.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    next();
}));
// generate psbt that User buy Rune && send BTC
marketplaceRouter.post("/generateUserBuyRuneSellBtcPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress } = req.body;
        console.log("req.body :>> ", req.body);
        const payload = yield (0, marketplaceController_1.generateUserBuyRuneSellBtcPsbt)(userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt that User buy BTC && send Rune
marketplaceRouter.post("/generateUserBuyBtcSellRunePsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress } = req.body;
        const payload = yield (0, marketplaceController_1.generateUserBuyBtcSellRunePsbt)(userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// Pool sign psbt user buy btc and sell rune and update pool database
marketplaceRouter.post("/poolTransferBrc20", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userSignedPsbt, userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress, } = req.body;
        const payload = yield (0, marketplaceController_1.poolTransferBrc20)(userSignedPsbt, userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBrc20SellBtcPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress } = req.body;
        const payload = yield (0, marketplaceController_1.generateUserBuyBrc20SellBtcPsbt)(userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress);
        console.log("payload :>> ", payload);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// Pool sign psbt user buy rune and sell btc and update pool database
marketplaceRouter.post("/pushBrc20SwapPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { psbt, userSignedHexedPsbt, userAddress, poolAddress, brc20Amount, btcAmount, poolInputArray, userInputArray, swapType, } = req.body;
        const payload = yield (0, marketplaceController_1.pushBrc20SwapPsbt)(psbt, userSignedHexedPsbt, userAddress, poolAddress, brc20Amount, btcAmount, poolInputArray, userInputArray, swapType);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBtcSellBrc20Psbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress } = req.body;
        console.log("req.body :>> ", req.body);
        const payload = yield (0, marketplaceController_1.generateUserBuyBtcSellBrc20Psbt)(userAddress, userPubkey, userSendBrc20Amount, userBuyBtcAmount, poolAddress);
        console.log("payload :>> ", payload);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBtcSendBrc20Psbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userSignedHexedPsbt, userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress, } = req.body;
        const payload = yield (0, marketplaceController_1.generateUserBuyBtcSendBrc20Psbt)(userSignedHexedPsbt, userAddress, userPubkey, userSendBrc20Amount, userBuyBtcAmount, poolAddress);
        console.log("payload :>> ", payload);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// sign and broadcast tx on Server side
marketplaceRouter.post("/pushRuneSwapPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, btcAmount, userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType, usingTxInfo, scriptpubkey, } = req.body;
        console.log("req.body :>> ", req.body);
        const payload = yield (0, marketplaceController_1.pushRuneSwapPsbt)(psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, Number(btcAmount), userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType, usingTxInfo, scriptpubkey);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// remove swap transaction
marketplaceRouter.post("/removeSwapTx", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { poolAddress, userAddress, tokenType } = req.body;
        const payload = yield (0, marketplaceController_1.removeSwapTransaction)(poolAddress, userAddress, tokenType);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// remove swap transaction
marketplaceRouter.get("/getMempoolBtcPrice", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = yield (0, service_1.getPrice)();
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
exports.default = marketplaceRouter;
