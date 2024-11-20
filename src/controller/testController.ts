import * as bitcoin from "bitcoinjs-lib";
import { none, RuneId, Runestone } from "runelib";

import {
    calculateTxFee,
    combinePsbt,
    delay,
    generateSeed,
    getBtcUtxoByAddress,
    getFeeRate,
    getRuneUtxoByAddress,
    pushBTCpmt,
    pushRawTx
} from '../service/service';
import {
    testVersion,
    testFeeRate,
    STANDARD_RUNE_UTXO_VALUE,
    SEND_UTXO_FEE_LIMIT,
    privateKey,
} from '../config/config';
import * as ecc from "tiny-secp256k1";
import ECPairFactory from 'ecpair';
import { LocalWallet } from "../service/localWallet";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

const poolWallet = new LocalWallet(privateKey as string, testVersion ? 1 : 0);

export const generateUserBuyRunePsbt = async (
    userPubkey: string,
    userAddress: string,
    userBuyRuneAmount: number,
    userSendBtcAmount: number,
    poolAddress: string,
    poolPubkey: string
) => {
    console.log('poolAddress :>> ', poolAddress);

    const runeBlockNumber = 2866933;
    const runeTxout = 192;
    const divisibility = 0;
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

    psbt.addOutput({
        address: poolAddress,
        value: userSendBtcAmount * 10 ** 8,
    });

    // Calculate transaction fee
    const feeRate = testVersion ? testFeeRate : await getFeeRate();

    // Add BTC UTXOs for covering fees
    let totalBtcAmount = 0;
    for (const btcutxo of userBtcUtxos) {
        const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount * 10 ** 8;
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
                // sighashType: 131
                // sighashType: bitcoin.Transaction.SIGHASH_ALL
            });

            userInputArray.push(cnt++);
        }
    }

    const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount * 10 ** 8;

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
};

export const pushSwapPsbt = async (
    psbt: string,
    userSignedHexedPsbt: string,
    userInputArray: Array<number>,
    poolInputArray: Array<number>,
) => {
    const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

    userInputArray.forEach((input:number) => userSignedPsbt.finalizeInput(input));

    console.log('poolInputArray :>> ', poolInputArray);

    const poolSignedPsbt = await poolWallet.signPsbt(userSignedPsbt, poolInputArray);

    // poolInputArray.forEach((input: number) => poolSignedPsbt.finalizeInput(input));

    console.log("dfdfd1");

    const txId = await combinePsbt(psbt, userSignedPsbt.toHex(), poolSignedPsbt.toHex());

    return txId
}

// export const setTime = async () => {
//     const flag = true;
//     setTimeout(() => {
//         if (flag) {
//             flag = false
//         }
//     }, 15000);
// }