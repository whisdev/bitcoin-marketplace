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
exports.generateUserInscribeBrc20Psbt = exports.pushBTCpmt = exports.combinePsbt = exports.getRuneBalanceListByAddress = exports.getRuneUtxoByAddress = exports.calculateTxFee = exports.finalizePsbtInput = exports.pushRawTx = exports.getBtcBalanceByAddress = exports.getPrice = exports.getFeeRate = exports.getBtcUtxoByAddress = exports.getBrc20SummaryByAddress = exports.getBrc20TickerInfoByAddress = exports.getBrc20TransferableInscriptionUtxoByAddress = exports.createOrderBrc20Transfer = exports.getInscriptionData = exports.delay = void 0;
exports.toPsbtNetwork = toPsbtNetwork;
exports.publicKeyToPayment = publicKeyToPayment;
exports.publicKeyToAddress = publicKeyToAddress;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const config_1 = require("../config/config");
const axios_1 = __importDefault(require("axios"));
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);
const network = config_1.testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.delay = delay;
// export const toXOnly = (pubKey: string) => pubKey.length == 32 ? pubKey : pubKey.slice(1, 33);
function toPsbtNetwork(networkType) {
    if (networkType == 0) {
        return bitcoin.networks.bitcoin;
    }
    else {
        return bitcoin.networks.testnet;
    }
}
function publicKeyToPayment(publicKey, type, networkType) {
    const network = toPsbtNetwork(networkType);
    if (!publicKey)
        return null;
    const pubkey = Buffer.from(publicKey, "hex");
    if (type == 0) {
        return bitcoin.payments.p2pkh({
            pubkey,
            network,
        });
    }
    else if (type == 1 || type == 4) {
        return bitcoin.payments.p2wpkh({
            pubkey,
            network,
        });
    }
    else if (type == 2 || type == 5) {
        return bitcoin.payments.p2tr({
            internalPubkey: pubkey.slice(1, 33),
            network,
        });
    }
    else if (type == 3) {
        const data = bitcoin.payments.p2wpkh({
            pubkey,
            network,
        });
        return bitcoin.payments.p2sh({
            pubkey,
            network,
            redeem: data,
        });
    }
}
function publicKeyToAddress(publicKey, type, networkType) {
    const payment = publicKeyToPayment(publicKey, type, networkType);
    if (payment && payment.address) {
        return payment.address;
    }
    else {
        return "";
    }
}
const getInscriptionData = (address, inscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/inscription-data`;
        const config = {
            headers: {
                Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
            },
        };
        const res = yield axios_1.default.get(url, Object.assign({}, config));
        const filterInscription = res.data.data.inscription.find((inscription) => inscription.inscriptionId === inscriptionId);
        if (!filterInscription) {
            console.log("First Attempt get failed, Try second attempt. ==> ", filterInscription);
            yield (0, exports.delay)(30000);
            const res2 = yield axios_1.default.get(url, Object.assign({}, config));
            const filterInscription2 = res2.data.data.inscription.find((inscription) => inscription.inscriptionId === inscriptionId);
            if (!filterInscription2) {
                console.log("Second Attempt get failed, Try third attempt. ==>", filterInscription2);
                yield (0, exports.delay)(30000);
                const res3 = yield axios_1.default.get(url, Object.assign({}, config));
                const filterInscriptio3 = res3.data.data.inscription.find((inscription) => inscription.inscriptionId === inscriptionId);
                if (!filterInscriptio3) {
                    console.log("Third Attempt get failed, Try fourth attempt. ==>", filterInscriptio3);
                    yield (0, exports.delay)(40000);
                    const res4 = yield axios_1.default.get(url, Object.assign({}, config));
                    const filterInscriptio4 = res4.data.data.inscription.find((inscription) => inscription.inscriptionId === inscriptionId);
                    return filterInscriptio4.utxo;
                }
                return filterInscriptio3.utxo;
            }
            return filterInscription2.utxo;
        }
        return filterInscription.utxo;
    }
    catch (error) {
        console.log(error.data);
        throw new Error("Can not fetch Inscriptions!!");
    }
});
exports.getInscriptionData = getInscriptionData;
const createOrderBrc20Transfer = (address, feeRate, ticker, amount) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v2/inscribe/order/create/brc20-transfer`;
    const res = yield axios_1.default.post(url, {
        receiveAddress: address,
        feeRate,
        outputValue: 546,
        devAddress: address,
        brc20Ticker: ticker,
        brc20Amount: amount.toString(),
    }, {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    });
    return res.data.data;
});
exports.createOrderBrc20Transfer = createOrderBrc20Transfer;
const getBrc20TransferableInscriptionUtxoByAddress = (address, ticker) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/${ticker}/transferable-inscriptions`;
    const config = {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    };
    const inscriptionList = (yield axios_1.default.get(url, config)).data.data.detail;
    return inscriptionList;
});
exports.getBrc20TransferableInscriptionUtxoByAddress = getBrc20TransferableInscriptionUtxoByAddress;
const getBrc20TickerInfoByAddress = (address, ticker) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/${ticker}/info`;
    const config = {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    };
    const tickerInfo = (yield axios_1.default.get(url, config)).data.data;
    return tickerInfo;
});
exports.getBrc20TickerInfoByAddress = getBrc20TickerInfoByAddress;
const getBrc20SummaryByAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/summary`;
    const config = {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    };
    const tickerInfo = (yield axios_1.default.get(url, config)).data.data.detail;
    return tickerInfo;
});
exports.getBrc20SummaryByAddress = getBrc20SummaryByAddress;
const getBtcUtxoByAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/utxo-data`;
    const config = {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    };
    let cursor = 0;
    const size = 5000;
    const utxos = [];
    const res = yield axios_1.default.get(url, Object.assign(Object.assign({}, config), { params: { cursor, size } }));
    if (res.data.code === -1)
        throw "Invalid Address";
    utxos.push(...res.data.data.utxo.map((utxo) => {
        return {
            scriptpubkey: utxo.scriptPk,
            txid: utxo.txid,
            value: utxo.satoshi,
            vout: utxo.vout,
        };
    }));
    return utxos;
});
exports.getBtcUtxoByAddress = getBtcUtxoByAddress;
const getFeeRate = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `https://mempool.space/${config_1.testVersion ? "testnet/" : ""}api/v1/fees/recommended`;
        const res = yield axios_1.default.get(url);
        return res.data.fastestFee;
    }
    catch (error) {
        console.log("Ordinal api is not working now. Try again later");
        return 40 * 2;
    }
});
exports.getFeeRate = getFeeRate;
const getPrice = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `https://mempool.space/api/v1/prices`;
        const res = yield axios_1.default.get(url);
        return res.data.USD;
    }
    catch (error) {
        console.log("Mempool api is not working now. Try again later");
        return 90000;
    }
});
exports.getPrice = getPrice;
const getBtcBalanceByAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield fetch(`${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/balance`, {
            method: "GET",
            headers: { Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}` },
        });
        const data = yield response.json();
        return data.data.satoshi;
    }
    catch (error) {
        console.log("Mempool api is not working now. Try again later");
        return 90000;
    }
});
exports.getBtcBalanceByAddress = getBtcBalanceByAddress;
const pushRawTx = (rawTx) => __awaiter(void 0, void 0, void 0, function* () {
    const txid = yield postData(`https://mempool.space/${config_1.testVersion ? "testnet/" : ""}api/tx`, rawTx);
    console.log("pushed txid", txid);
    return txid;
});
exports.pushRawTx = pushRawTx;
const postData = (url_1, json_1, ...args_1) => __awaiter(void 0, [url_1, json_1, ...args_1], void 0, function* (url, json, content_type = "text/plain", apikey = "") {
    var _a, _b;
    while (1) {
        try {
            const headers = {};
            if (content_type)
                headers["Content-Type"] = content_type;
            if (apikey)
                headers["X-Api-Key"] = apikey;
            const res = yield axios_1.default.post(url, json, {
                headers,
            });
            return res.data;
        }
        catch (err) {
            const axiosErr = err;
            console.log("push tx error", (_a = axiosErr.response) === null || _a === void 0 ? void 0 : _a.data);
            if (!((_b = axiosErr.response) === null || _b === void 0 ? void 0 : _b.data).includes('sendrawtransaction RPC error: {"code":-26,"message":"too-long-mempool-chain,'))
                throw new Error("Got an err when push tx");
        }
    }
});
const finalizePsbtInput = (hexedPsbt, inputs) => {
    const psbt = bitcoin.Psbt.fromHex(hexedPsbt);
    inputs.forEach((input) => psbt.finalizeInput(input));
    return psbt.toHex();
};
exports.finalizePsbtInput = finalizePsbtInput;
// Calc Tx Fee
const calculateTxFee = (psbt, feeRate) => {
    const tx = new bitcoin.Transaction();
    for (let i = 0; i < psbt.txInputs.length; i++) {
        const txInput = psbt.txInputs[i];
        tx.addInput(txInput.hash, txInput.index, txInput.sequence);
        tx.setWitness(i, [Buffer.alloc(config_1.SIGNATURE_SIZE)]);
    }
    for (let txOutput of psbt.txOutputs) {
        tx.addOutput(txOutput.script, txOutput.value);
    }
    return Math.floor(tx.virtualSize() * feeRate);
};
exports.calculateTxFee = calculateTxFee;
const getRuneUtxoByAddress = (address, runeId) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/runes/${runeId}/utxo`;
    const config = {
        headers: {
            Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
        },
    };
    let cursor = 0;
    let tokenSum = 0;
    const size = 5000;
    const utxos = [];
    const res = yield axios_1.default.get(url, Object.assign(Object.assign({}, config), { params: { cursor, size } }));
    if (res.data.code === -1)
        throw "Invalid Address";
    utxos.push(...res.data.data.utxo.map((utxo) => {
        tokenSum += Number(utxo.runes[0].amount);
        return {
            scriptpubkey: utxo.scriptPk,
            txid: utxo.txid,
            value: utxo.satoshi,
            vout: utxo.vout,
            amount: Number(utxo.runes[0].amount),
            divisibility: utxo.runes[0].divisibility,
        };
    }));
    cursor += res.data.data.utxo.length;
    return { runeUtxos: utxos, tokenSum };
});
exports.getRuneUtxoByAddress = getRuneUtxoByAddress;
// Get rune balance using unisat api
const getRuneBalanceListByAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `${config_1.OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/runes/balance-list`;
        const config = {
            headers: {
                Authorization: `Bearer ${config_1.OPENAPI_UNISAT_TOKEN}`,
            },
        };
        let utxos = [];
        const res = yield axios_1.default.get(url, config);
        if (res.data.code === -1)
            throw "Invalid Address";
        if (res.data.data) {
            utxos.push(...res.data.data.detail.map((utxo) => {
                return {
                    rune: utxo.rune,
                    runeid: utxo.runeid,
                    spacedRune: utxo.spacedRune,
                    amount: utxo.amount,
                    symbol: utxo.symbol,
                    divisibility: utxo.divisibility,
                };
            }));
        }
        return utxos;
    }
    catch (err) {
        console.log(err);
    }
});
exports.getRuneBalanceListByAddress = getRuneBalanceListByAddress;
const combinePsbt = (hexedPsbt, signedHexedPsbt1, signedHexedPsbt2) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
        const txId = yield (0, exports.pushRawTx)(txHex);
        return txId;
    }
    catch (error) {
        console.log(error);
        throw error;
    }
});
exports.combinePsbt = combinePsbt;
const pushBTCpmt = (rawtx) => __awaiter(void 0, void 0, void 0, function* () {
    // delay 250 ms to prevent transaction push limit
    (0, exports.delay)(250);
    const txid = yield postData(`https://mempool.space/${config_1.testVersion ? "testnet/" : ""}api/tx`, rawtx);
    return txid;
});
exports.pushBTCpmt = pushBTCpmt;
const generateUserInscribeBrc20Psbt = (address, publickey, inscribeAmount, ticker, utxos) => __awaiter(void 0, void 0, void 0, function* () {
    const psbt = new bitcoin.Psbt({ network });
    const feeRate = config_1.testVersion ? config_1.testFeeRate : yield (0, exports.getFeeRate)();
    const brc20TickerInfo = yield (0, exports.getBrc20TickerInfoByAddress)(address, ticker);
    console.log("address, ticker :>> ", address, ticker);
    console.log("brc20TickerInfo :>> ", brc20TickerInfo);
    if (brc20TickerInfo.availableBalance < inscribeAmount)
        throw `No sufficient available BRC20 amount`;
    const orderInscriptionInfo = yield (0, exports.createOrderBrc20Transfer)(address, feeRate, ticker, inscribeAmount);
    const payAddress = orderInscriptionInfo.payAddress;
    const inscriptionPayAmount = orderInscriptionInfo.amount;
    psbt.addOutput({
        address: payAddress,
        value: inscriptionPayAmount,
    });
    // add btc utxo input
    let totalBtcAmount = 0;
    for (const btcutxo of utxos) {
        const fee = (0, exports.calculateTxFee)(psbt, feeRate) + inscriptionPayAmount;
        if (totalBtcAmount < fee && btcutxo.value > 10000) {
            totalBtcAmount += btcutxo.value;
            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    value: btcutxo.value,
                    script: Buffer.from(btcutxo.scriptpubkey, "hex"),
                },
                tapInternalKey: Buffer.from(publickey, "hex").slice(1, 33),
            });
        }
    }
    const fee = (0, exports.calculateTxFee)(psbt, feeRate) + inscriptionPayAmount;
    if (totalBtcAmount < fee)
        throw `BTC balance in User of ${address} is not enough`;
    psbt.addOutput({
        address: address,
        value: totalBtcAmount - fee,
    });
    return psbt.toHex();
});
exports.generateUserInscribeBrc20Psbt = generateUserInscribeBrc20Psbt;
