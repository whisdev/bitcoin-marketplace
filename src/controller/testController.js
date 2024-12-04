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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolTransferBrc20 = exports.generateUserBuyBrc20SellBtcPsbt = exports.pushSwapPsbt = exports.generateUserBuyRunePsbt = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const runelib_1 = require("runelib");
const service_1 = require("../service/service");
const config_1 = require("../config/config");
const ecc = __importStar(require("tiny-secp256k1"));
const ecpair_1 = __importDefault(require("ecpair"));
const localWallet_1 = require("../service/localWallet");
const Brc20PoolInfo_1 = __importDefault(require("../model/Brc20PoolInfo"));
const util_1 = require("../utils/util");
const RunePoolInfo_1 = __importDefault(require("../model/RunePoolInfo"));
const poolController_1 = require("./poolController");
const Brc20TransactionInfo_1 = __importDefault(require("../model/Brc20TransactionInfo"));
const server_1 = require("../server");
bitcoin.initEccLib(ecc);
const ECPair = (0, ecpair_1.default)(ecc);
const network = config_1.testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
const poolWallet = new localWallet_1.LocalWallet(config_1.privateKey, config_1.testVersion ? 1 : 0);
const generateUserBuyRunePsbt = (userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress, poolPubkey) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("poolAddress :>> ", poolAddress);
    const runeBlockNumber = 2866933;
    const runeTxout = 192;
    const divisibility = 0;
    const requiredAmount = userBuyRuneAmount * Math.pow(10, divisibility);
    // Fetch UTXOs
    const userBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    const poolRuneUtxos = yield (0, service_1.getRuneUtxoByAddress)(poolAddress, `${runeBlockNumber}:${runeTxout}`);
    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts = [];
    const userInputArray = [];
    const poolInputArray = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];
    const usedTxList = [];
    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of poolRuneUtxos.runeUtxos) {
        if (tokenSum >= requiredAmount)
            break;
        psbt.addInput({
            hash: runeutxo.txid,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.value,
                script: Buffer.from(runeutxo.scriptpubkey, "hex"),
            },
            tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
            // sighashType: bitcoin.Transaction.SIGHASH_ALL
        });
        poolInputArray.push(cnt++);
        tokenSum += runeutxo.amount;
        txList.push(runeutxo.txid);
    }
    // Add any missing rune UTXOs from transaction history
    // const filterTxInfo = await filterTransactionInfo(poolAddress, txList);
    // for (const runeutxo of filterTxInfo) {
    //     if (tokenSum >= requiredAmount) break;
    //     psbt.addInput({
    //         hash: runeutxo.txId,
    //         index: runeutxo.vout,
    //         witnessUtxo: {
    //             value: runeutxo.runeAmount,
    //             script: pubkeyBuffer,
    //         },
    //         tapInternalKey: pubkeyBuffer.slice(1, 33),
    //         sighashType: bitcoin.Transaction.SIGHASH_ALL
    //     });
    //     poolInputArray.push(cnt++);
    //     tokenSum += runeutxo.runeAmount;
    //     usedTxList.push(runeutxo.txId);
    // }
    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }
    // Add edicts for Rune outputs
    const runeId = new runelib_1.RuneId(runeBlockNumber, runeTxout);
    edicts.push({
        id: runeId,
        amount: requiredAmount,
        output: 1,
    });
    edicts.push({
        id: runeId,
        amount: tokenSum - requiredAmount,
        output: 2,
    });
    // Add Rune outputs to PSBT
    const mintstone = new runelib_1.Runestone(edicts, (0, runelib_1.none)(), (0, runelib_1.none)(), (0, runelib_1.none)());
    psbt.addOutput({
        script: mintstone.encipher(),
        value: 0,
    });
    psbt.addOutput({
        address: userAddress,
        value: config_1.STANDARD_RUNE_UTXO_VALUE,
    });
    psbt.addOutput({
        address: poolAddress,
        value: config_1.STANDARD_RUNE_UTXO_VALUE,
    });
    psbt.addOutput({
        address: poolAddress,
        value: userSendBtcAmount * Math.pow(10, 8),
    });
    // Calculate transaction fee
    const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
    // Add BTC UTXOs for covering fees
    let totalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
        const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + userSendBtcAmount * Math.pow(10, 8);
        if (totalBtcAmount >= fee)
            break;
        if (btcutxo.value > config_1.SEND_UTXO_FEE_LIMIT) {
            totalBtcAmount += btcutxo.value;
            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
                // sighashType: 131
                // sighashType: bitcoin.Transaction.SIGHASH_ALL
            });
            userInputArray.push(cnt++);
        }
    }
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + userSendBtcAmount * Math.pow(10, 8);
    // Check if enough BTC balance is available
    if (totalBtcAmount < fee) {
        return {
            success: false,
            message: "Insufficient BTC balance",
            payload: undefined,
        };
    }
    // Add change output
    psbt.addOutput({
        address: userAddress,
        value: totalBtcAmount - fee,
    });
    return {
        success: true,
        message: "PSBT generated successfully",
        payload: {
            psbt: psbt.toHex(),
            poolInputArray,
            userInputArray,
            // usedTxList,
            runeAmount: tokenSum - requiredAmount,
        },
    };
});
exports.generateUserBuyRunePsbt = generateUserBuyRunePsbt;
const pushSwapPsbt = (psbt, userSignedHexedPsbt, userInputArray, poolInputArray) => __awaiter(void 0, void 0, void 0, function* () {
    const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);
    userInputArray.forEach((input) => userSignedPsbt.finalizeInput(input));
    console.log("poolInputArray :>> ", poolInputArray);
    const poolSignedPsbt = yield poolWallet.signPsbt(userSignedPsbt, poolInputArray);
    // poolInputArray.forEach((input: number) => poolSignedPsbt.finalizeInput(input));
    console.log("dfdfd1");
    const txId = yield (0, service_1.combinePsbt)(psbt, userSignedPsbt.toHex(), poolSignedPsbt.toHex());
    return txId;
});
exports.pushSwapPsbt = pushSwapPsbt;
// export const setTime = async () => {
//     const flag = true;
//     setTimeout(() => {
//         if (flag) {
//             flag = false
//         }
//     }, 15000);
// }
const generateUserBuyBrc20SellBtcPsbt = (userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, service_1.delay)(10000);
    const psbt = new bitcoin.Psbt({ network });
    const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
    const userBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    const requiredAmount = Math.floor(userSendBtcAmount * Math.pow(10, 8));
    const poolInfoResult = yield Brc20PoolInfo_1.default.findOne({
        address: poolAddress,
    });
    if (!poolInfoResult) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
        $set: {
            isLocked: true,
            lockedByAddress: userAddress,
        },
    });
    yield (0, util_1.updatePoolLockStatus)(poolAddress, "BRC20", userAddress);
    const ticker = poolInfoResult.ticker;
    const poolPubkey = poolInfoResult.publickey;
    const transferableBrc20TickerInfo = yield (0, service_1.getBrc20TransferableInscriptionUtxoByAddress)(poolAddress, ticker);
    const matchedTickerInfo = transferableBrc20TickerInfo.find((item) => item.data.amt == userBuyBrc20Amount);
    if (!matchedTickerInfo) {
        const psbt = new bitcoin.Psbt({ network });
        const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
        const brc20TickerInfo = yield (0, service_1.getBrc20TickerInfoByAddress)(poolAddress, ticker);
        if (brc20TickerInfo.availableBalance < userBuyBrc20Amount)
            throw `No sufficient available BRC20 amount`;
        console.log("poolAddress, feeRate, ticker, userBuyBrc20Amount :>> ", poolAddress, feeRate, ticker, userBuyBrc20Amount);
        const orderInscriptionInfo = yield (0, service_1.createOrderBrc20Transfer)(poolAddress, feeRate, ticker, userBuyBrc20Amount);
        console.log("orderInscriptionInfo :>> ", orderInscriptionInfo);
        const payAddress = orderInscriptionInfo.payAddress;
        const inscriptionPayAmount = orderInscriptionInfo.amount;
        console.log("inscriptionPayAmount :>> ", inscriptionPayAmount);
        psbt.addOutput({
            address: payAddress,
            value: inscriptionPayAmount,
        });
        psbt.addOutput({
            address: poolAddress,
            value: requiredAmount,
        });
        psbt.addOutput({
            address: poolAddress,
            value: config_1.userSendBrc20Fee,
        });
        // add btc utxo input
        let totalBtcAmount = 0;
        for (const btcutxo of userBtcUtxos) {
            const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + inscriptionPayAmount + requiredAmount + config_1.userSendBrc20Fee;
            if (totalBtcAmount < fee && btcutxo.value > 10000) {
                totalBtcAmount += btcutxo.value;
                psbt.addInput({
                    hash: btcutxo.txid,
                    index: btcutxo.vout,
                    witnessUtxo: {
                        value: btcutxo.value,
                        script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                    },
                    tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
                });
            }
        }
        const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + inscriptionPayAmount + requiredAmount + config_1.userSendBrc20Fee;
        if (totalBtcAmount < fee)
            throw `BTC balance in User of ${userAddress} is not enough`;
        psbt.addOutput({
            address: userAddress,
            value: totalBtcAmount - fee,
        });
        return {
            success: true,
            message: `You need to pay for the pool inscription`,
            payload: {
                psbt: psbt.toHex(),
                status: "INSCRIBE",
            },
        };
    }
    psbt.addOutput({
        address: userAddress,
        value: matchedTickerInfo.satoshi,
    });
    psbt.addOutput({
        address: poolAddress,
        value: requiredAmount,
    });
    const poolInputArray = [];
    const userInputArray = [];
    let userTotalBtcAmount = 0;
    let cnt = 0;
    psbt.addInput({
        hash: matchedTickerInfo.txid,
        index: matchedTickerInfo.vout,
        witnessUtxo: {
            value: matchedTickerInfo.satoshi,
            script: Buffer.from(poolPubkey, "hex"),
        },
        tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
    });
    poolInputArray.push(cnt++);
    for (const btcutxo of userBtcUtxos) {
        const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + userSendBtcAmount;
        if (userTotalBtcAmount >= fee)
            break;
        if (btcutxo.value > config_1.SEND_UTXO_FEE_LIMIT) {
            userTotalBtcAmount += btcutxo.value;
            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
            });
            userInputArray.push(cnt++);
        }
    }
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + userSendBtcAmount;
    // Check if enough BTC balance is available
    if (userTotalBtcAmount < fee) {
        yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: "Insufficient BTC balance in User wallet",
            payload: undefined,
        };
    }
    psbt.addOutput({
        address: userAddress,
        value: userTotalBtcAmount - fee,
    });
    return {
        success: true,
        message: `PSBT generated successfully`,
        payload: {
            psbt: psbt.toHex(),
            poolInputArray,
            userInputArray,
            userBuyBrc20Amount,
            status: "TRANSFER",
        },
    };
});
exports.generateUserBuyBrc20SellBtcPsbt = generateUserBuyBrc20SellBtcPsbt;
const poolTransferBrc20 = (userSignedHexedPsbt, userPubkey, userAddress, poolSendBrc20Amount, poolReceiveBtcAmount, poolAddress) => __awaiter(void 0, void 0, void 0, function* () {
    const isPoolAddressExisted = yield Brc20PoolInfo_1.default.findOne({
        address: poolAddress,
    });
    if (!isPoolAddressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    const userTxId = "await pushRawTx(userTxHex)";
    if (userTxId) {
        console.log("userTxId :>> ", userTxId);
        yield (0, service_1.delay)(10000);
        const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
        const poolInfoResult = yield Brc20PoolInfo_1.default.findOne({
            address: poolAddress,
        });
        if (!poolInfoResult) {
            return {
                success: false,
                message: `No pool found at address ${poolAddress}`,
                payload: undefined,
            };
        }
        const ticker = poolInfoResult.ticker;
        const poolPubkey = poolInfoResult.publickey;
        const poolPrivkey = poolInfoResult.privatekey;
        const poolWallet = new localWallet_1.LocalWallet(poolPrivkey, config_1.testVersion ? 1 : 0);
        const psbt = new bitcoin.Psbt({ network });
        const inscriptionList = yield (0, service_1.getBrc20TransferableInscriptionUtxoByAddress)(poolAddress, ticker);
        const btcUtxos = yield (0, service_1.getBtcUtxoByAddress)(poolAddress);
        const existedInscription = inscriptionList.find((inscription) => inscription.data.tick.toUpperCase() == ticker.toUpperCase() &&
            inscription.data.amt == poolSendBrc20Amount);
        if (!existedInscription) {
            return {
                success: false,
                message: `No inscription of ${ticker} - ${poolSendBrc20Amount} at address ${userAddress}`,
                payload: undefined,
            };
        }
        const inscriptionData = yield (0, service_1.getInscriptionData)(poolAddress, existedInscription.inscriptionId);
        console.log("inscriptionData :>> ", inscriptionData);
        psbt.addInput({
            hash: inscriptionData.txid,
            index: inscriptionData.vout,
            witnessUtxo: {
                value: inscriptionData.satoshi,
                script: Buffer.from(inscriptionData.scriptPk, "hex"),
            },
            tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
        });
        psbt.addOutput({
            address: userAddress,
            value: inscriptionData.satoshi,
        });
        // add btc utxo input
        let totalBtcAmount = 0;
        for (const btcutxo of btcUtxos) {
            const fee = (0, service_1.calculateTxFee)(psbt, feeRate);
            if (totalBtcAmount < fee && btcutxo.value > 10000) {
                totalBtcAmount += btcutxo.value;
                psbt.addInput({
                    hash: btcutxo.txid,
                    index: btcutxo.vout,
                    witnessUtxo: {
                        value: btcutxo.value,
                        script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                    },
                    tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
                });
            }
        }
        const fee = (0, service_1.calculateTxFee)(psbt, feeRate);
        if (totalBtcAmount < fee)
            throw "BTC balance is not enough";
        psbt.addOutput({
            address: poolAddress,
            value: totalBtcAmount - fee,
        });
        console.log("psbt :>> ", psbt);
        const poolSignedPsbt = yield poolWallet.signPsbt(psbt);
        const poolTx = poolSignedPsbt.extractTransaction();
        const poolTxHex = poolTx.toHex();
        const poolTxId = yield (0, service_1.pushRawTx)(poolTxHex);
        // db features
        if (poolTxId) {
            let updatedPoolInfo;
            updatedPoolInfo = yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
                $set: {
                    safeTokenAmount: isPoolAddressExisted.safeTokenAmount - poolSendBrc20Amount,
                    btcAmount: isPoolAddressExisted.btcAmount + poolReceiveBtcAmount,
                    volume: isPoolAddressExisted.volume + poolReceiveBtcAmount,
                    isLocked: false,
                },
            });
            const newBrc20Transaction = new Brc20TransactionInfo_1.default({
                poolAddress: poolAddress,
                userAddress: userAddress,
                txId: poolTxId,
                tokenAmount: poolSendBrc20Amount,
                btcAmount: poolReceiveBtcAmount,
                swapType: 1,
            });
            yield newBrc20Transaction.save();
            if (!updatedPoolInfo) {
                yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
                return {
                    success: false,
                    message: `No pool found at address ${poolAddress}`,
                    payload: undefined,
                };
            }
            // socket connection with Front end of price, volume, runeAmount, btcAmount
            server_1.io.emit("brc20-pool-socket", (0, poolController_1.getBrc20PullInfo)());
            return {
                success: true,
                message: `Push swap psbt successfully`,
                payload: poolTxId,
            };
        }
        else {
            yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
            return {
                success: false,
                message: `No pool found at address ${poolAddress}`,
                payload: undefined,
            };
        }
    }
    else {
        yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: `User ${userAddress} not paid for Brc20 transfer`,
            payload: undefined,
        };
    }
});
exports.poolTransferBrc20 = poolTransferBrc20;
