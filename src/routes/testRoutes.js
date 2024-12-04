"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.adminWallet = void 0;
const express_1 = require("express");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const service_1 = require("../service/service");
const config_1 = require("../config/config");
const localWallet_1 = require("../service/localWallet");
const testController_1 = require("../controller/testController");
exports.adminWallet = new localWallet_1.LocalWallet(config_1.privateKey, config_1.testVersion ? 1 : 0);
const testRouter = (0, express_1.Router)();
testRouter.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("");
    console.log(`Request received for ${req.method} ${req.url}`);
    next();
}));
testRouter.get("/test", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).send("test successfully");
    }
    catch (error) {
        res.status(404).send(error);
    }
}));
// Pool sign psbt user buy btc and sell rune and update pool database
testRouter.post("/poolTransferBrc20", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userSignedPsbt, userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress, } = req.body;
        const payload = yield (0, testController_1.poolTransferBrc20)(userSignedPsbt, userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt taht User buy Brc20 && send BTC
testRouter.post("/generateUserBuyBrc20SellBtcPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress } = req.body;
        const payload = yield (0, testController_1.generateUserBuyBrc20SellBtcPsbt)(userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress);
        console.log("payload :>> ", payload);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
testRouter.post("/combinePsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { hexedPsbt, signedHexedPsbt1, signedHexedPsbt2 } = req.body;
        const psbt = bitcoin.Psbt.fromHex(hexedPsbt);
        const signedPsbt1 = bitcoin.Psbt.fromHex(signedHexedPsbt1);
        if (signedHexedPsbt2) {
            const signedPsbt2 = bitcoin.Psbt.fromHex(signedHexedPsbt2);
            psbt.combine(signedPsbt1, signedPsbt2);
        }
        else {
            psbt.combine(signedPsbt1);
        }
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txId = yield (0, service_1.pushRawTx)(txHex);
        return res.status(200).send(txId);
    }
    catch (error) {
        return res.status(404).send(error);
    }
}));
// generate psbt that User buy BTC && send Rune
testRouter.post("/pushSwapPsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const { userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress } = req.body;
        const psbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000ffffffffeddb1b6c8e779a151b0eb1e9bf9383006afc6e8af9ec69ee60298677bb007e010100000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a62202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7e007b60200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2014ce0200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6011720df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763000000000000";
        // const psbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000fffffffff177002a60438a63ff0a40ea1078a913ee37861e7e81bc5f974530b27290fa510000000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc72202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7c0d4dd0500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b00e1f50500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e000000000000"
        const userSignedHexedPsbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000ffffffffeddb1b6c8e779a151b0eb1e9bf9383006afc6e8af9ec69ee60298677bb007e010100000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a62202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7e007b60200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2014ce0200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a601134048c4aa847e00a9f8560688831562f15c325c973119866e2585d3c93b942410e3228d730f9eb206398aed6031635d022fc529b1d4cdf954965553ce6bf2ba8279011720df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763000000000000";
        // const userSignedHexedPsbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000fffffffff177002a60438a63ff0a40ea1078a913ee37861e7e81bc5f974530b27290fa510000000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc72202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7c0d4dd0500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b00e1f50500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011340e3e203b37e1798cd7022221ef5e709d4722762c620f4f0ab0d2efd1a6a611a90106ddb722346b66d78065e5e38b680b7297b2cf289619c71da92e844830f3539011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e000000000000"
        const userInputArray = [2];
        const poolInputArray = [0, 1];
        const userPubkey = "03df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763";
        const userAddress = "tb1p2vw4xepu6glhrtt62m7pjs2exmvmesytmsmc4zce8tym9elfyxnq6506a5";
        const userBuyRuneAmount = 10;
        const userSendingBtcAmount = 0.01;
        const poolAddress = "tb1pw7dtq290mkjq36q3yv5h2s3wz79k2696zftd0ctsydruwjxktlrs8x8cmh";
        const poolPubkey = "02c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e";
        const payload = yield (0, testController_1.pushSwapPsbt)(psbt, userSignedHexedPsbt, userInputArray, poolInputArray);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// generate psbt that User buy BTC && send Rune
testRouter.post("/generateUserBuyRunePsbt", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const { userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress } = req.body;
        const userPubkey = "02c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e";
        const userAddress = "tb1pw7dtq290mkjq36q3yv5h2s3wz79k2696zftd0ctsydruwjxktlrs8x8cmh";
        const userBuyRuneAmount = 10;
        const userSendingBtcAmount = 0.01;
        const poolAddress = "tb1p2vw4xepu6glhrtt62m7pjs2exmvmesytmsmc4zce8tym9elfyxnq6506a5";
        const poolPubkey = "03df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763";
        const payload = yield (0, testController_1.generateUserBuyRunePsbt)(userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress, poolPubkey);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
exports.default = testRouter;
