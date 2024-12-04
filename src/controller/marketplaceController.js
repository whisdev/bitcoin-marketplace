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
exports.removeSwapTransaction = exports.getMempoolBtcPrice = exports.pushRuneSwapPsbt = exports.pushBrc20SwapPsbt = exports.generateUserBuyBtcSellBrc20Psbt = exports.poolTransferBrc20 = exports.generateUserBuyBrc20SellBtcPsbt = exports.generateUserBuyBtcSellRunePsbt = exports.generateUserBuyRuneSellBtcPsbt = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecpair_1 = require("ecpair");
const runelib_1 = require("runelib");
const dotenv_1 = __importDefault(require("dotenv"));
const service_1 = require("../service/service");
const config_1 = require("../config/config");
const util_1 = require("../utils/util");
const poolController_1 = require("./poolController");
const RuneTransactionInfo_1 = __importDefault(require("../model/RuneTransactionInfo"));
const server_1 = require("../server");
const localWallet_1 = require("../service/localWallet");
const RunePoolInfo_1 = __importDefault(require("../model/RunePoolInfo"));
const Brc20PoolInfo_1 = __importDefault(require("../model/Brc20PoolInfo"));
const Brc20TransactionInfo_1 = __importDefault(require("../model/Brc20TransactionInfo"));
const UsedTxInfo_1 = __importDefault(require("../model/UsedTxInfo"));
const ecc = require("@bitcoinerlab/secp256k1");
const ECPair = (0, ecpair_1.ECPairFactory)(ecc);
bitcoin.initEccLib(ecc);
dotenv_1.default.config();
const network = config_1.testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
const generateUserBuyRuneSellBtcPsbt = (userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress) => __awaiter(void 0, void 0, void 0, function* () {
    const poolInfo = yield RunePoolInfo_1.default.findOne({ address: poolAddress });
    if (!poolInfo) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    if (poolInfo.isLocked) {
        return {
            success: false,
            message: `Pool is locked. you can access ${config_1.lockTime}sec later`,
            payload: undefined,
        };
    }
    yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
        $set: {
            isLocked: true,
            lockedByAddress: userAddress,
        },
    });
    yield (0, util_1.updatePoolLockStatus)(poolAddress, "RUNE", userAddress);
    const { divisibility, publickey: poolPubkey, runeId } = poolInfo;
    const requiredAmount = userBuyRuneAmount * Math.pow(10, divisibility);
    // Fetch UTXOs
    const userBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    const poolRuneUtxoInfo = yield (0, service_1.getRuneUtxoByAddress)(poolAddress, runeId);
    const usedTxInfo = yield UsedTxInfo_1.default.find();
    const usingTxInfo = [];
    const poolRuneUtxos = poolRuneUtxoInfo.runeUtxos.filter((item) => !(usedTxInfo === null || usedTxInfo === void 0 ? void 0 : usedTxInfo.find((i) => i.txid === item.txid)));
    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts = [];
    const userInputArray = [];
    const poolInputArray = [];
    let cnt = 0;
    let tokenSum = 0;
    let scriptpubkey;
    const txList = [];
    const usedTxList = [];
    const runeBlock = Number(runeId.split(":")[0]);
    const runeIdx = Number(runeId.split(":")[1]);
    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of poolRuneUtxos) {
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
        });
        usingTxInfo.push(runeutxo.txid);
        poolInputArray.push(cnt++);
        tokenSum += runeutxo.amount;
        txList.push(runeutxo.txid);
        scriptpubkey = runeutxo.scriptpubkey;
    }
    // Add any missing rune UTXOs from transaction history
    const filterTxInfo = yield (0, util_1.filterTransactionInfo)(poolAddress, txList);
    for (const runeutxo of filterTxInfo) {
        if (tokenSum >= requiredAmount)
            break;
        psbt.addInput({
            hash: runeutxo.txId,
            index: runeutxo.vout,
            witnessUtxo: {
                value: 546,
                script: Buffer.from(runeutxo.scriptpubkey, "hex"),
            },
            tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
        });
        poolInputArray.push(cnt++);
        tokenSum += runeutxo.poolRuneAmount;
        usedTxList.push(runeutxo.txId);
    }
    console.log("tokenSum < requiredAmount :>> ", tokenSum, requiredAmount);
    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }
    // Add edicts for Rune outputs
    edicts.push({
        id: new runelib_1.RuneId(runeBlock, runeIdx),
        amount: requiredAmount,
        output: 1,
    });
    edicts.push({
        id: new runelib_1.RuneId(runeBlock, runeIdx),
        amount: tokenSum - requiredAmount,
        output: 2,
    });
    console.log("psbt :>> ", psbt);
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
        value: Math.floor(userSendBtcAmount * Math.pow(10, 8)),
    });
    // Calculate transaction fee
    const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + Math.floor(userSendBtcAmount * Math.pow(10, 8));
    // Add BTC UTXOs for covering fees
    let totalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
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
            });
            userInputArray.push(cnt++);
        }
    }
    // Check if enough BTC balance is available
    if (totalBtcAmount < fee) {
        const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
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
            usedTxList,
            userRuneAmount: requiredAmount,
            poolRuneAmount: tokenSum - requiredAmount,
            usingTxInfo,
            scriptpubkey,
        },
    };
});
exports.generateUserBuyRuneSellBtcPsbt = generateUserBuyRuneSellBtcPsbt;
const generateUserBuyBtcSellRunePsbt = (userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress) => __awaiter(void 0, void 0, void 0, function* () {
    const poolInfo = yield RunePoolInfo_1.default.findOne({ address: poolAddress });
    if (!poolInfo) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    if (poolInfo.isLocked) {
        return {
            success: false,
            message: `Pool is locked. you can access ${config_1.lockTime}s later`,
            payload: undefined,
        };
    }
    yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
        $set: {
            isLocked: true,
            lockedByAddress: userAddress,
        },
    });
    yield (0, util_1.updatePoolLockStatus)(poolAddress, "RUNE", userAddress);
    const { runeId, divisibility, publickey: poolPubkey } = poolInfo;
    const requiredAmount = userSendRuneAmount * Math.pow(10, divisibility);
    // Fetch UTXOs
    const poolBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(poolAddress);
    const userBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    const userRuneInfo = yield (0, service_1.getRuneUtxoByAddress)(userAddress, runeId);
    const usedTxInfo = yield UsedTxInfo_1.default.find();
    const usingTxInfo = [];
    const userRuneUtxos = userRuneInfo.runeUtxos.filter((item) => !(usedTxInfo === null || usedTxInfo === void 0 ? void 0 : usedTxInfo.find((i) => i.txid === item.txid)));
    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts = [];
    const userInputArray = [];
    const poolInputArray = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];
    const runeBlock = Number(runeId.split(":")[0]);
    const runeIdx = Number(runeId.split(":")[1]);
    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of userRuneUtxos) {
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
        });
        userInputArray.push(cnt++);
        tokenSum += runeutxo.amount;
        txList.push(runeutxo.txid);
        usingTxInfo.push(runeutxo.txid);
    }
    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }
    // Add edicts for Rune outputs
    edicts.push({
        id: new runelib_1.RuneId(runeBlock, runeIdx),
        amount: requiredAmount,
        output: 1,
    });
    edicts.push({
        id: new runelib_1.RuneId(runeBlock, runeIdx),
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
        address: poolAddress,
        value: config_1.STANDARD_RUNE_UTXO_VALUE,
    });
    psbt.addOutput({
        address: userAddress,
        value: config_1.STANDARD_RUNE_UTXO_VALUE,
    });
    // Add BTC UTXOs for user buy btc amount
    let totalBtcAmount = 0;
    for (const btcutxo of poolBtcUtxos) {
        if (totalBtcAmount >= Math.floor(userBuyBtcAmount * Math.pow(10, 8)))
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
                tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
            });
            poolInputArray.push(cnt++);
        }
    }
    // Check if enough BTC balance is available
    if (totalBtcAmount < Math.floor(userBuyBtcAmount * Math.pow(10, 8))) {
        const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: "Insufficient BTC balance in Pool",
            payload: undefined,
        };
    }
    // Add change output
    psbt.addOutput({
        address: userAddress,
        value: Math.floor(userBuyBtcAmount * Math.pow(10, 8)),
    });
    psbt.addOutput({
        address: poolAddress,
        value: totalBtcAmount - Math.floor(userBuyBtcAmount * Math.pow(10, 8)),
    });
    // Calculate transaction fee
    const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, service_1.getFeeRate)();
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate);
    console.log("fee :>> ", fee);
    // Add BTC UTXOs for covering fees
    let userTotalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
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
    const usedTxList = [];
    console.log("psbt :>> ", psbt);
    return {
        success: true,
        message: "PSBT generated successfully",
        payload: {
            psbt: psbt.toHex(),
            poolInputArray,
            userInputArray,
            usedTxList,
            poolRuneAmount: requiredAmount,
            userRuneAmount: requiredAmount,
            usingTxInfo: usingTxInfo,
        },
    };
});
exports.generateUserBuyBtcSellRunePsbt = generateUserBuyBtcSellRunePsbt;
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
    if (poolInfoResult.isLocked) {
        return {
            success: false,
            message: `Pool is locked. you can access ${config_1.lockTime}s later`,
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
        const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + requiredAmount;
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
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate) + requiredAmount;
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
    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);
        userSignedPsbt.finalizeAllInputs();
        const userTx = userSignedPsbt.extractTransaction();
        const userTxHex = userTx.toHex();
        const userTxId = yield (0, service_1.pushRawTx)(userTxHex);
        if (userTxId) {
            console.log("userTxId :>> ", userTxId);
            yield (0, service_1.delay)(20000);
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
            const btcUtxos = yield (0, service_1.getBtcUtxoByAddress)(poolAddress);
            let existedInscription;
            do {
                const inscriptionList = yield (0, service_1.getBrc20TransferableInscriptionUtxoByAddress)(poolAddress, ticker);
                console.log("inscriptionList :>> ", inscriptionList);
                existedInscription = inscriptionList.find((inscription) => inscription.data.tick.toUpperCase() === ticker.toUpperCase() &&
                    inscription.data.amt === poolSendBrc20Amount);
            } while (!existedInscription);
            const inscriptionData = yield (0, service_1.getInscriptionData)(poolAddress, existedInscription.inscriptionId);
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
    }
    else {
        return {
            success: false,
            message: `This user keep signing over ${config_1.lockTime} sec`,
            payload: undefined,
        };
    }
});
exports.poolTransferBrc20 = poolTransferBrc20;
const generateUserBuyBtcSellBrc20Psbt = (userAddress, userPubkey, userSendBrc20Amount, userBuyBtcAmount, poolAddress) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, service_1.delay)(10000);
    const psbt = new bitcoin.Psbt({ network });
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
    if (poolInfoResult.isLocked) {
        return {
            success: false,
            message: `Pool is locked. you can access ${config_1.lockTime}s later`,
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
    const userBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(userAddress);
    let existedInscription;
    // do {
    // 	const inscriptionList = await getBrc20TransferableInscriptionUtxoByAddress(userAddress, ticker);
    // 	console.log("inscriptionList :>> ", inscriptionList);
    // 	existedInscription = inscriptionList.find(
    // 		(inscription) =>
    // 			inscription.data.tick.toUpperCase() === ticker.toUpperCase() &&
    // 			inscription.data.amt === userSendBrc20Amount
    // 	);
    // } while (!existedInscription);
    const transferableBrc20TickerInfo = yield (0, service_1.getBrc20TransferableInscriptionUtxoByAddress)(userAddress, ticker);
    const matchedTickerInfo = transferableBrc20TickerInfo.find((item) => item.data.amt == userSendBrc20Amount);
    if (!matchedTickerInfo) {
        const psbt = yield (0, service_1.generateUserInscribeBrc20Psbt)(userAddress, userPubkey, userSendBrc20Amount, ticker, userBtcUtxos);
        return {
            success: true,
            message: "User need to inscribe Brc20 token first",
            payload: {
                psbt: psbt,
                status: "INSCRIBE",
            },
        };
    }
    const poolBtcUtxos = yield (0, service_1.getBtcUtxoByAddress)(poolAddress);
    psbt.addOutput({
        address: poolAddress,
        value: matchedTickerInfo.satoshi,
    });
    psbt.addOutput({
        address: userAddress,
        value: Math.floor(userBuyBtcAmount * Math.pow(10, 8)),
    });
    const poolInputArray = [];
    const userInputArray = [];
    let userTotalBtcAmount = 0;
    let poolTotalBtcAmount = 0;
    let cnt = 0;
    psbt.addInput({
        hash: matchedTickerInfo.txid,
        index: matchedTickerInfo.vout,
        witnessUtxo: {
            value: matchedTickerInfo.satoshi,
            script: Buffer.from(matchedTickerInfo.scriptPk, "hex"),
        },
        tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
    });
    for (const btcutxo of poolBtcUtxos) {
        if (poolTotalBtcAmount >= Math.floor(userBuyBtcAmount * Math.pow(10, 8)))
            break;
        if (btcutxo.value > config_1.SEND_UTXO_FEE_LIMIT) {
            poolTotalBtcAmount += btcutxo.value;
            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
            });
            poolInputArray.push(cnt++);
        }
    }
    // Check if enough BTC balance is available
    if (poolTotalBtcAmount < Math.floor(userBuyBtcAmount * Math.pow(10, 8))) {
        const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
        return {
            success: false,
            message: "Insufficient BTC balance in Pool",
            payload: undefined,
        };
    }
    const fee = (0, service_1.calculateTxFee)(psbt, feeRate);
    for (const btcutxo of userBtcUtxos) {
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
            userSendBrc20Amount,
            status: "TRANSFER",
        },
    };
});
exports.generateUserBuyBtcSellBrc20Psbt = generateUserBuyBtcSellBrc20Psbt;
const pushBrc20SwapPsbt = (psbt, userSignedHexedPsbt, userAddress, poolAddress, brc20Amount, btcAmount, poolInputArray, userInputArray, swapType) => __awaiter(void 0, void 0, void 0, function* () {
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
    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        const privateKey = isPoolAddressExisted.privatekey;
        const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);
        userInputArray.forEach((input) => userSignedPsbt.finalizeInput(input));
        const keyPair = ECPair.fromWIF(privateKey, network);
        const poolWallet = new localWallet_1.LocalWallet(privateKey, config_1.testVersion ? 1 : 0);
        const poolSignedPsbt = yield poolWallet.signPsbt(userSignedPsbt, poolInputArray);
        // broadcast tx
        const txId = yield (0, service_1.combinePsbt)(psbt, poolSignedPsbt.toHex(), userSignedPsbt.toHex());
        // db features
        if (txId) {
            let updatedPoolInfo;
            let newBrc20Transaction;
            switch (swapType) {
                case 1:
                    updatedPoolInfo = yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
                        $set: {
                            safeTokenAmount: isPoolAddressExisted.safeTokenAmount - brc20Amount,
                            btcAmount: isPoolAddressExisted.btcAmount + btcAmount,
                            volume: isPoolAddressExisted.volume + btcAmount,
                            isLocked: false,
                        },
                    });
                    newBrc20Transaction = new Brc20TransactionInfo_1.default({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        txId: txId,
                        tokenAmount: brc20Amount,
                        btcAmount: btcAmount,
                        swapType: 1,
                    });
                    yield newBrc20Transaction.save();
                    break;
                case 2:
                    updatedPoolInfo = yield Brc20PoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
                        $set: {
                            safeTokenAmount: isPoolAddressExisted.unsafeTokenAmount + brc20Amount,
                            btcAmount: isPoolAddressExisted.btcAmount - btcAmount,
                            volume: isPoolAddressExisted.volume + btcAmount,
                            isLocked: false,
                        },
                    });
                    newBrc20Transaction = new Brc20TransactionInfo_1.default({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        txId: txId,
                        tokenAmount: brc20Amount,
                        btcAmount: btcAmount,
                        swapType: 2,
                    });
                    yield newBrc20Transaction.save();
                default:
                    break;
            }
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
            server_1.io.emit("set-pool-list");
            return {
                success: true,
                message: `Push swap psbt successfully`,
                payload: txId,
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
        return {
            success: false,
            message: `This user keep signing over ${config_1.lockTime} sec`,
            payload: undefined,
        };
    }
});
exports.pushBrc20SwapPsbt = pushBrc20SwapPsbt;
const pushRuneSwapPsbt = (psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, btcAmount, userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType, usingTxInfo, scriptpubkey) => __awaiter(void 0, void 0, void 0, function* () {
    const isPoolAddressExisted = yield RunePoolInfo_1.default.findOne({
        address: poolAddress,
    });
    if (!isPoolAddressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        const privateKey = isPoolAddressExisted.privatekey;
        const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);
        userInputArray.forEach((input) => userSignedPsbt.finalizeInput(input));
        const keyPair = ECPair.fromWIF(privateKey, network);
        const poolWallet = new localWallet_1.LocalWallet(privateKey, config_1.testVersion ? 1 : 0);
        const poolSignedPsbt = yield poolWallet.signPsbt(userSignedPsbt, poolInputArray);
        // broadcast tx
        const txId = yield (0, service_1.combinePsbt)(psbt, poolSignedPsbt.toHex(), userSignedPsbt.toHex());
        // db features
        if (txId) {
            let updatedPoolInfo;
            let newTxInfo;
            usingTxInfo.map((item) => __awaiter(void 0, void 0, void 0, function* () {
                const newUsedTxInfo = new UsedTxInfo_1.default({
                    txid: item,
                    confirmedTx: txId,
                });
                yield newUsedTxInfo.save();
            }));
            switch (swapType) {
                // user buy btc and sell rune
                case 1:
                    updatedPoolInfo = yield RunePoolInfo_1.default.findOneAndUpdate({
                        address: poolAddress,
                    }, {
                        $set: {
                            tokenAmount: isPoolAddressExisted.tokenAmount - userRuneAmount,
                            btcAmount: isPoolAddressExisted.btcAmount + btcAmount,
                            volume: isPoolAddressExisted.volume + btcAmount,
                            isLocked: false,
                        },
                    });
                    if (!updatedPoolInfo) {
                        yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
                        return {
                            success: false,
                            message: `No pool found at address ${poolAddress}`,
                            payload: undefined,
                        };
                    }
                    newTxInfo = new RuneTransactionInfo_1.default({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        swapType: 1,
                        vout: 1,
                        txId: txId,
                        btcAmount: btcAmount,
                        poolRuneAmount: poolRuneAmount,
                        userRuneAmount: userRuneAmount,
                        scriptpubkey: scriptpubkey,
                    });
                    yield newTxInfo.save();
                    break;
                // user buy rune and receive btc
                case 2:
                    updatedPoolInfo = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, {
                        $set: {
                            tokenAmount: isPoolAddressExisted.tokenAmount + userRuneAmount,
                            btcAmount: isPoolAddressExisted.btcAmount - btcAmount,
                            volume: isPoolAddressExisted.volume + btcAmount,
                            isLocked: false,
                        },
                    });
                    if (!updatedPoolInfo) {
                        yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
                        return {
                            success: false,
                            message: `No pool found at address ${poolAddress}`,
                            payload: undefined,
                        };
                    }
                    newTxInfo = new RuneTransactionInfo_1.default({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        swapType: 2,
                        txId: txId,
                        vout: 1,
                        btcAmount: btcAmount,
                        poolRuneAmount: poolRuneAmount,
                        userRuneAmount: userRuneAmount,
                        scriptpubkey: scriptpubkey,
                    });
                    yield newTxInfo.save();
                    break;
            }
            if (usedTransactionList.length > 0) {
                const transactionInfoResult = yield RuneTransactionInfo_1.default.updateMany({
                    poolAddress: poolAddress,
                    txId: { $in: usedTransactionList },
                }, {
                    $set: {
                        isUsed: true,
                    },
                });
            }
            // socket connection with Front end of price, volume, runeAmount, btcAmount
            server_1.io.emit("rune-pool-socket", (0, poolController_1.getRunePullInfo)());
            server_1.io.emit("set-pool-list");
            return {
                success: true,
                message: `Push swap psbt successfully`,
                payload: txId,
            };
        }
        else {
            const poolLockedResult = yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
            return {
                success: false,
                message: `No pool found at address ${poolAddress}`,
                payload: undefined,
            };
        }
    }
    else {
        return {
            success: false,
            message: `This user keep signing over ${config_1.lockTime} sec`,
            payload: undefined,
        };
    }
});
exports.pushRuneSwapPsbt = pushRuneSwapPsbt;
const getMempoolBtcPrice = () => __awaiter(void 0, void 0, void 0, function* () {
    const price = yield (0, service_1.getPrice)();
    return {
        success: true,
        message: `Mempool price is ${price}`,
        payload: price,
    };
});
exports.getMempoolBtcPrice = getMempoolBtcPrice;
const removeSwapTransaction = (poolAddress, userAddress, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    let isPoolAddressExisted;
    if (tokenType == "BRC20") {
        isPoolAddressExisted = yield Brc20PoolInfo_1.default.findOne({
            address: poolAddress,
        });
    }
    else {
        isPoolAddressExisted = yield RunePoolInfo_1.default.findOne({
            address: poolAddress,
        });
    }
    if (!isPoolAddressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }
    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        yield RunePoolInfo_1.default.findOneAndUpdate({ address: poolAddress }, { $set: { isLocked: false } });
    }
    return {
        success: true,
        message: `Unlock ${tokenType} pool - ${poolAddress} successfully`,
        payload: undefined,
    };
});
exports.removeSwapTransaction = removeSwapTransaction;
