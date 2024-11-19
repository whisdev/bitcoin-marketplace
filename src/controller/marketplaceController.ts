import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import { none, RuneId, Runestone } from "runelib";
import { LEAF_VERSION_TAPSCRIPT } from "bitcoinjs-lib/src/payments/bip341";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";

import {
    calculateTxFee,
    combinePsbt,
    delay,
    getBtcUtxoByAddress,
    getFeeRate,
    getRuneUtxoByAddress,
    pushRawTx
} from '../service/service';
import {
    userRuneId,
    testVersion,
    sendingRate,
    // feelimit,
    adminVout1,
    adminVout2,
    // userDivisibility,
    testFeeRate,
    STANDARD_RUNE_UTXO_VALUE,
    SEND_UTXO_FEE_LIMIT,
} from '../config/config';
import dotenv from 'dotenv';
import PoolInfoModal from "../model/PoolInfo";
import { filterTransactionInfo } from "../utils/util";
import TransactionInfoModal from "../model/TransactionInfo";

const ecc = require("@bitcoinerlab/secp256k1");
const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);
dotenv.config();

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

const privateKey1: string = process.env.WIF_KEY1 as string;

export const generateUserBuyRunePsbt = async (
    userPubkey: string,
    userAddress: string,
    userBuyRuneAmount: number,
    userSendBtcAmount: number,
    poolAddress: string
) => {
    console.log('poolAddress :>> ', poolAddress);

    const poolInfo = await PoolInfoModal.findOne({ address: poolAddress });
    if (!poolInfo) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }

    const { runeBlockNumber, runeTxout, divisibility, publickey: poolPubkey } = poolInfo;
    const pubkeyBuffer = Buffer.from(poolPubkey, "hex");
    const requiredAmount = userBuyRuneAmount * 10 ** divisibility;

    // Fetch UTXOs
    const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
    const poolRuneUtxos = await getRuneUtxoByAddress(poolAddress, `${runeBlockNumber}:${runeTxout}`);

    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts: any = [];
    const userInputArray: number[] = [];
    const poolInputArray: number[] = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];
    const usedTxList = [];

    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of poolRuneUtxos.runeUtxos) {
        if (tokenSum >= requiredAmount) break;

        psbt.addInput({
            hash: runeutxo.txid,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.value,
                script: Buffer.from(runeutxo.scriptpubkey, "hex"),
            },
            tapInternalKey: pubkeyBuffer,
            sighashType: bitcoin.Transaction.SIGHASH_ALL
        });

        poolInputArray.push(cnt++);
        tokenSum += runeutxo.amount;
        txList.push(runeutxo.txid);
    }

    // Add any missing rune UTXOs from transaction history
    const filterTxInfo = await filterTransactionInfo(poolAddress, txList);
    for (const runeutxo of filterTxInfo) {
        if (tokenSum >= requiredAmount) break;

        psbt.addInput({
            hash: runeutxo.txId,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.runeAmount,
                script: pubkeyBuffer,
            },
            tapInternalKey: pubkeyBuffer.slice(1, 33),
            sighashType: bitcoin.Transaction.SIGHASH_ALL
        });

        poolInputArray.push(cnt++);
        tokenSum += runeutxo.runeAmount;
        usedTxList.push(runeutxo.txId);
    }

    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }

    // Add edicts for Rune outputs
    const runeId = new RuneId(runeBlockNumber, runeTxout);

    edicts.push({
        id: runeId,
        amount: requiredAmount,
        output: 1
    });

    edicts.push({
        id: runeId,
        amount: tokenSum - requiredAmount,
        output: 2
    });

    // Add Rune outputs to PSBT
    const mintstone = new Runestone(edicts, none(), none(), none());

    psbt.addOutput({
        script: mintstone.encipher(),
        value: 0
    });

    psbt.addOutput({
        address: userAddress,
        value: STANDARD_RUNE_UTXO_VALUE
    });

    psbt.addOutput({
        address: poolAddress,
        value: STANDARD_RUNE_UTXO_VALUE
    });

    // Calculate transaction fee
    const feeRate = testVersion ? testFeeRate : await getFeeRate();
    const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount;

    // Add BTC UTXOs for covering fees
    let totalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
        if (totalBtcAmount >= fee) break;

        if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
            totalBtcAmount += btcutxo.value;

            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
                sighashType: bitcoin.Transaction.SIGHASH_ALL
            });

            userInputArray.push(cnt++);
        }
    }

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
            usedTxList,
            runeAmount: tokenSum - requiredAmount,
        },
    };
};

export const generateUserBuyBTCPsbt = async (
    userPubkey: string,
    userAddress: string,
    userBuyBtcAmount: number,
    userSendRuneAmount: number,
    poolAddress: string,
) => {
    console.log('poolAddress :>> ', poolAddress);

    const poolInfo = await PoolInfoModal.findOne({ address: poolAddress });
    if (!poolInfo) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }

    const { runeBlockNumber, runeTxout, divisibility, publickey: poolPubkey } = poolInfo;
    const pubkeyBuffer = Buffer.from(poolPubkey, "hex");
    const requiredAmount = userSendRuneAmount * 10 ** divisibility;

    // Fetch UTXOs
    const poolBtcUtxos = await getBtcUtxoByAddress(poolAddress);
    const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
    const userRuneUtxos = await getRuneUtxoByAddress(userAddress, `${runeBlockNumber}:${runeTxout}`);

    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts: any = [];
    const userInputArray: number[] = [];
    const poolInputArray: number[] = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];

    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of userRuneUtxos.runeUtxos) {
        if (tokenSum >= requiredAmount) break;

        psbt.addInput({
            hash: runeutxo.txid,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.value,
                script: Buffer.from(runeutxo.scriptpubkey, "hex"),
            },
            tapInternalKey: pubkeyBuffer,
            sighashType: bitcoin.Transaction.SIGHASH_ALL
        });

        userInputArray.push(cnt++);
        tokenSum += runeutxo.amount;
        txList.push(runeutxo.txid);
    }

    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }

    // Add edicts for Rune outputs
    const runeId = new RuneId(runeBlockNumber, runeTxout);
    edicts.push({ id: runeId, amount: requiredAmount, output: 1 });
    edicts.push({ id: runeId, amount: tokenSum - requiredAmount, output: 2 });

    // Add Rune outputs to PSBT
    const mintstone = new Runestone(edicts, none(), none(), none());

    psbt.addOutput({
        script: mintstone.encipher(),
        value: 0
    });

    psbt.addOutput({
        address: userAddress,
        value: STANDARD_RUNE_UTXO_VALUE
    });

    psbt.addOutput({
        address: userAddress,
        value: STANDARD_RUNE_UTXO_VALUE
    });

    // Add BTC UTXOs for user buy btc amount
    let totalBtcAmount = 0;
    for (const btcutxo of poolBtcUtxos) {
        if (totalBtcAmount >= userBuyBtcAmount) break;

        if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
            totalBtcAmount += btcutxo.value;

            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
                sighashType: bitcoin.Transaction.SIGHASH_ALL
            });

            poolInputArray.push(cnt++);
        }
    }

    // Check if enough BTC balance is available
    if (totalBtcAmount < userBuyBtcAmount) {
        return {
            success: false,
            message: "Insufficient BTC balance in Pool",
            payload: undefined,
        };
    }

    // Add change output
    psbt.addOutput({
        address: userAddress,
        value: userBuyBtcAmount,
    });

    // Calculate transaction fee
    const feeRate = testVersion ? testFeeRate : await getFeeRate();
    const fee = calculateTxFee(psbt, feeRate);

    // Add BTC UTXOs for covering fees
    let userTotalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
        if (userTotalBtcAmount >= fee) break;

        if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
            userTotalBtcAmount += btcutxo.value;

            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
                sighashType: bitcoin.Transaction.SIGHASH_ALL
            });

            userInputArray.push(cnt++);
        }
    }

    // Check if enough BTC balance is available
    if (userTotalBtcAmount < fee) {
        return {
            success: false,
            message: "Insufficient BTC balance in User wallet",
            payload: undefined,
        };
    }

    return {
        success: true,
        message: "PSBT generated successfully",
        payload: {
            psbt: psbt.toHex(),
            userInputArray,
        },
    };
};

export const pushSwapPsbt = async (
    psbt: string,
    userSignedHexedPsbt: string,
    userInputArray: Array<number>,
    poolInputArray: Array<number>,
    poolAddress: string,
    amount: number,
    usedTransactionList: string[]
) => {
    const isPoolAdressExisted = await PoolInfoModal.findOne({
        address: poolAddress
    })

    if (!isPoolAdressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }

    const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

    userInputArray.forEach((input: number) => userSignedPsbt.finalizeInput(input));

    console.log("psbt ==> ", psbt);

    const tempPsbt = bitcoin.Psbt.fromHex(psbt);

    const keyPair1 = ECPair.fromWIF(privateKey1, network);

    poolInputArray.map((input: number) => {
        tempPsbt.signInput(input, keyPair1);
    })

    console.log('tempPsbt :>> ', tempPsbt);

    poolInputArray.forEach((input: number) => tempPsbt.finalizeInput(input));

    const txId = await combinePsbt(psbt, tempPsbt.toHex(), userSignedPsbt.toHex());

    if (txId) {
        const result = await TransactionInfoModal.deleteMany({
            poolId: poolAddress,
            txId: { $in: usedTransactionList }
        });

        const newTransaction = new TransactionInfoModal({
            poolId: poolAddress,
            txId: txId,
            vout: 2,
            runeAmount: amount
        })

        await newTransaction.save();

        return {
            success: true,
            message: `Push swap psbt successfully`,
            payload: txId,
        };
    } else {
        return {
            success: false,
            message: `Push swap psbt failed`,
            payload: undefined,
        };
    }

}