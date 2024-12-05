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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistorySocket = exports.updatePoolLockStatus = exports.checkConfirmedTx = exports.filterTransactionInfo = exports.splitData = void 0;
const mempool_js_1 = __importDefault(require("@mempool/mempool.js"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
const RuneTransactionInfo_1 = __importDefault(require("../model/RuneTransactionInfo"));
const Brc20TransactionInfo_1 = __importDefault(require("../model/Brc20TransactionInfo"));
const SwapHistory_1 = __importDefault(require("../model/SwapHistory"));
const RunePoolInfo_1 = __importDefault(require("../model/RunePoolInfo"));
const Brc20PoolInfo_1 = __importDefault(require("../model/Brc20PoolInfo"));
const server_1 = require("../server");
const service_1 = require("../service/service");
const UsedTxInfo_1 = __importDefault(require("../model/UsedTxInfo"));
const splitData = (data, bundleSize) => {
    // initialize new splited Data array
    let newSplitDataArray = [];
    // one element management item
    let item = [];
    // iterator for loop
    let iterator = 0;
    // loop whole data array
    for (let i = 0; i < data.length; i++) {
        if (iterator == bundleSize) {
            newSplitDataArray.push(item);
            item = [];
            iterator = 0;
        }
        else {
            item.push(data[i]);
            iterator++;
        }
    }
    if (iterator != 0) {
        newSplitDataArray.push(item);
    }
    return newSplitDataArray;
};
exports.splitData = splitData;
const filterTransactionInfo = (poolAddress, txList) => __awaiter(void 0, void 0, void 0, function* () {
    const txInfoList = yield RuneTransactionInfo_1.default.find({
        poolAddress: poolAddress,
        isUsed: false,
    });
    return txInfoList.filter((txInfo) => !txList.includes(txInfo.txId) && txInfo.isUsed === false && txInfo.swapType == 1);
});
exports.filterTransactionInfo = filterTransactionInfo;
const checkConfirmedTx = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bitcoin: { websocket }, } = config_1.testVersion
            ? (0, mempool_js_1.default)({
                hostname: "mempool.space",
                network: "testnet",
            })
            : (0, mempool_js_1.default)({
                hostname: "mempool.space",
            });
        const ws = websocket.initServer({
            options: ["blocks"],
        });
        ws.on("message", function incoming(data) {
            return __awaiter(this, void 0, void 0, function* () {
                const res = JSON.parse(data.toString());
                if (res.block) {
                    const blockId = res.block.id;
                    const txIds = yield axios_1.default.get(config_1.testVersion
                        ? `https://mempool.space/testnet/api/block/${blockId}/txids`
                        : `https://mempool.space/api/block/${blockId}/txids`);
                    const unconfirmedRuneTxs = yield RuneTransactionInfo_1.default.find();
                    const unconfirmedBrc20Txs = yield Brc20TransactionInfo_1.default.find();
                    const unConfirmedUsedTxs = yield UsedTxInfo_1.default.find();
                    console.log("after mempool block txids");
                    unconfirmedRuneTxs.map((unconfirmedTx) => __awaiter(this, void 0, void 0, function* () {
                        if (txIds.data.includes(unconfirmedTx.txId)) {
                            const newSwapHistory = new SwapHistory_1.default({
                                poolAddress: unconfirmedTx.poolAddress,
                                txId: unconfirmedTx.txId,
                                // vout: unconfirmedTx.vout,
                                tokenAmount: unconfirmedTx.userRuneAmount,
                                btcAmount: unconfirmedTx.btcAmount,
                                tokenType: "RUNE",
                                swapType: unconfirmedTx.swapType,
                                userAddress: unconfirmedTx.userAddress,
                            });
                            yield newSwapHistory.save();
                            yield RuneTransactionInfo_1.default.deleteOne({
                                txId: unconfirmedTx.txId,
                            });
                        }
                    }));
                    unconfirmedBrc20Txs.map((unconfirmedTx) => __awaiter(this, void 0, void 0, function* () {
                        if (txIds.data.includes(unconfirmedTx.txId)) {
                            const newSwapHistory = new SwapHistory_1.default({
                                poolAddress: unconfirmedTx.poolAddress,
                                txId: unconfirmedTx.txId,
                                tokenAmount: unconfirmedTx.tokenAmount,
                                btcAmount: unconfirmedTx.btcAmount,
                                tokenType: "BRC20",
                                swapType: unconfirmedTx.swapType,
                                userAddress: unconfirmedTx.userAddress,
                            });
                            yield newSwapHistory.save();
                            yield Brc20TransactionInfo_1.default.deleteOne({
                                txId: unconfirmedTx.txId,
                            });
                        }
                    }));
                    unConfirmedUsedTxs.map((unconfirmedUsedTx) => __awaiter(this, void 0, void 0, function* () {
                        if (txIds.data.includes(unconfirmedUsedTx.confirmedTx)) {
                            yield UsedTxInfo_1.default.deleteOne({
                                txid: unconfirmedUsedTx.txid,
                            });
                        }
                    }));
                    server_1.io.emit("mempool-socket", yield (0, exports.getHistorySocket)());
                    server_1.io.emit("mempool-price-socket", yield (0, service_1.getPrice)());
                }
            });
        });
    }
    catch (error) {
        console.log("checkConfirmedTx error ==> ", error);
    }
});
exports.checkConfirmedTx = checkConfirmedTx;
// Update pool lock status as false if pool and lockedbyaddress is matched
const updatePoolLockStatus = (poolAddress, tokenType, userAddress) => __awaiter(void 0, void 0, void 0, function* () {
    if (tokenType == "RUNE") {
        const poolInfoResult = yield RunePoolInfo_1.default.findOne({
            address: poolAddress,
        });
        setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
            if ((poolInfoResult === null || poolInfoResult === void 0 ? void 0 : poolInfoResult.isLocked) && poolInfoResult.lockedByAddress == userAddress) {
                yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
            }
        }), config_1.lockTime * Math.pow(10, 3));
    }
    else {
        const poolInfoResult = yield Brc20PoolInfo_1.default.findOne({
            address: poolAddress,
        });
        setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
            if ((poolInfoResult === null || poolInfoResult === void 0 ? void 0 : poolInfoResult.isLocked) && poolInfoResult.lockedByAddress == userAddress) {
                yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
            }
        }), config_1.lockTime * Math.pow(10, 3));
    }
});
exports.updatePoolLockStatus = updatePoolLockStatus;
// socket about tx info
const getHistorySocket = () => __awaiter(void 0, void 0, void 0, function* () {
    const historyInfo = yield SwapHistory_1.default.find();
    const runePoolInfo = yield RunePoolInfo_1.default.find();
    const brc20PoolInfo = yield Brc20PoolInfo_1.default.find();
    const historyInfoSet = historyInfo.map((item) => {
        const matchedPool = runePoolInfo.find((pool) => pool.address == item.poolAddress && item.tokenType == "RUNE") ||
            brc20PoolInfo.find((pool) => pool.address == item.poolAddress && item.tokenType == "BRC20");
        return {
            ticker: matchedPool === null || matchedPool === void 0 ? void 0 : matchedPool.ticker,
            poolAddress: item.poolAddress,
            tokenAmount: item.tokenAmount,
            tokenType: item.tokenType,
            btcAmount: item.btcAmount,
            userAddress: item.userAddress,
            swapType: item.swapType,
            txId: item.txId,
            createdAt: item.createdAt,
        };
    });
    return historyInfoSet;
});
exports.getHistorySocket = getHistorySocket;
