import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import { none, Runestone, RuneId } from "runelib";
import dotenv from 'dotenv';

import {
    calculateTxFee,
    combinePsbt,
    getBtcUtxoByAddress,
    getFeeRate,
    getRuneUtxoByAddress,
} from '../service/service';
import {
    testVersion,
    testFeeRate,
    STANDARD_RUNE_UTXO_VALUE,
    SEND_UTXO_FEE_LIMIT,
    lockTime,
} from '../config/config';
import {
    filterTransactionInfo,
    getPoolSocket,
    updatePoolLockStatus
} from "../utils/util";
import PoolInfoModal from "../model/PoolInfo";
import TransactionInfoModal from "../model/TransactionInfo";
import { io } from "../server";

const ecc = require("@bitcoinerlab/secp256k1");
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);
dotenv.config();

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

export const generateUserBuyRunePsbt = async (
    userPubkey: string,
    userAddress: string,
    userBuyRuneAmount: number,
    userSendBtcAmount: number,
    poolAddress: string
) => {
    const poolInfo = await PoolInfoModal.findOne({ address: poolAddress });
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
            message: `Pool is locked. you can access ${lockTime}sec later`,
            payload: undefined
        }
    }

    const poolLockedResult = await PoolInfoModal.findOneAndUpdate(
        { address: poolAddress },
        {
            $set: {
                isLocked: true,
                lockedByAddress: userAddress
            }
        }
    )

    await updatePoolLockStatus(poolAddress, userAddress);

    const { divisibility, publickey: poolPubkey, runeId } = poolInfo;
    const pubkeyBuffer = Buffer.from(poolPubkey, "hex").slice(1, 33);
    const requiredAmount = userBuyRuneAmount * 10 ** divisibility;

    // Fetch UTXOs
    const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
    const poolRuneUtxos = await getRuneUtxoByAddress(poolAddress, runeId);

    console.log('poolRuneUtxos :>> ', poolRuneUtxos);
    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts: any = [];
    const userInputArray: number[] = [];
    const poolInputArray: number[] = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];
    const usedTxList = [];
    const runeBlock = Number(runeId.split(":")[0])
    const runeIdx = Number(runeId.split(":")[1])

    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of poolRuneUtxos.runeUtxos) {
        if (tokenSum >= requiredAmount) break;

        psbt.addInput({
            hash: runeutxo.txid,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.value,
                script: Buffer.from(runeutxo.scriptpubkey, "hex").slice(1,33),
            },
            tapInternalKey: pubkeyBuffer,
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
                value: runeutxo.poolRuneAmount,
                script: pubkeyBuffer,
            },
            tapInternalKey: pubkeyBuffer.slice(1, 33),
        });

        poolInputArray.push(cnt++);
        tokenSum += runeutxo.poolRuneAmount;
        usedTxList.push(runeutxo.txId);
    }

    // Check if enough rune is gathered
    if (tokenSum < requiredAmount) {
        const poolLockedResult = await PoolInfoModal.findOneAndUpdate(
            { address: poolAddress },
            { $set: { isLocked: false } }
        )

        return {
            success: false,
            message: "Insufficient Rune balance",
            payload: undefined,
        };
    }

    // Add edicts for Rune outputs

    edicts.push({
        id: new RuneId(runeBlock, runeIdx),
        amount: requiredAmount,
        output: 1
    });

    edicts.push({
        id: new RuneId(runeBlock, runeIdx),
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
    const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount * 10 ** 8;

    console.log('userSendBtcAmount :>> ', userSendBtcAmount);
    console.log('userSendBtcAmount * 10 ** 8 :>> ', userSendBtcAmount * 10 ** 8);
    console.log('fee :>> ', fee);
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
            });

            userInputArray.push(cnt++);
        }
    }

    // Check if enough BTC balance is available
    if (totalBtcAmount < fee) {
        const poolLockedResult = await PoolInfoModal.findOneAndUpdate(
            { address: poolAddress },
            { $set: { isLocked: false } }
        )

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
        },
    };
};

export const generateUserBuyBtcPsbt = async (
    userPubkey: string,
    userAddress: string,
    userBuyBtcAmount: number,
    userSendRuneAmount: number,
    poolAddress: string,
) => {
    const poolInfo = await PoolInfoModal.findOne({ address: poolAddress });
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
            message: `Pool is locked. you can access ${lockTime}s later`,
            payload: undefined
        }
    }

    const poolLockedResult = await PoolInfoModal.findOneAndUpdate(
        { address: poolAddress },
        {
            $set: {
                isLocked: true,
                lockedByAddress: userAddress
            }
        }
    )

    await updatePoolLockStatus(poolAddress, userAddress);

    const { runeId, divisibility, publickey: poolPubkey } = poolInfo;
    const requiredAmount = userSendRuneAmount * 10 ** divisibility;

    // Fetch UTXOs
    const poolBtcUtxos = await getBtcUtxoByAddress(poolAddress);
    const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
    const userRuneUtxos = await getRuneUtxoByAddress(userAddress, runeId);

    // Prepare PSBT and initialize values
    const psbt = new bitcoin.Psbt({ network });
    const edicts: any = [];
    const userInputArray: number[] = [];
    const poolInputArray: number[] = [];
    let cnt = 0;
    let tokenSum = 0;
    const txList = [];
    const runeBlock = Number(runeId.split(":")[0]);
    const runeIdx = Number(runeId.split(":")[1]);

    // Add pool rune UTXO inputs to PSBT
    for (const runeutxo of userRuneUtxos.runeUtxos) {
        if (tokenSum >= requiredAmount) break;

        psbt.addInput({
            hash: runeutxo.txid,
            index: runeutxo.vout,
            witnessUtxo: {
                value: runeutxo.value,
                script: Buffer.from(runeutxo.scriptpubkey, "hex").slice(1, 33),
            },
            tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
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
    edicts.push({
        id: new RuneId(runeBlock, runeIdx),
        amount: requiredAmount,
        output: 1
    });
    edicts.push({
        id: new RuneId(runeBlock, runeIdx),
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

    // Add BTC UTXOs for user buy btc amount
    let totalBtcAmount = 0;
    for (const btcutxo of poolBtcUtxos) {
        if (totalBtcAmount >= userBuyBtcAmount * 10 ** 8) break;

        if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
            totalBtcAmount += btcutxo.value;

            psbt.addInput({
                hash: btcutxo.txid,
                index: btcutxo.vout,
                witnessUtxo: {
                    script: Buffer.from(btcutxo.scriptpubkey as string, "hex").slice(1, 33),
                    value: btcutxo.value,
                },
                tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
            });

            poolInputArray.push(cnt++);
        }
    }

    // Check if enough BTC balance is available
    if (totalBtcAmount < userBuyBtcAmount * 10 ** 8) {
        return {
            success: false,
            message: "Insufficient BTC balance in Pool",
            payload: undefined,
        };
    }

    // Add change output
    psbt.addOutput({
        address: userAddress,
        value: userBuyBtcAmount * 10 ** 8,
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
            poolInputArray,
            userInputArray,
            userRuneAmount: tokenSum - requiredAmount,
            poolRuneAmount: requiredAmount
        },
    };
};

export const pushSwapPsbt = async (
    psbt: string,
    userSignedHexedPsbt: string,
    poolRuneAmount: number,
    userRuneAmount: number,
    btcAmount: number,
    userInputArray: Array<number>,
    poolInputArray: Array<number>,
    userAddress: string,
    poolAddress: string,
    usedTransactionList: string[],
    swapType: number
) => {
    const isPoolAddressExisted = await PoolInfoModal.findOne({
        address: poolAddress
    })

    if (!isPoolAddressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }

    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        const privateKey = isPoolAddressExisted.privatekey

        const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

        userInputArray.forEach((input: number) => userSignedPsbt.finalizeInput(input));

        const tempPsbt = bitcoin.Psbt.fromHex(psbt);

        const keyPair = ECPair.fromWIF(privateKey, network);

        poolInputArray.map((input: number) => {
            tempPsbt.signInput(input, keyPair);
        })

        poolInputArray.forEach((input: number) => tempPsbt.finalizeInput(input));

        // broadcast tx
        const txId = await combinePsbt(psbt, tempPsbt.toHex(), userSignedPsbt.toHex());

        // db features
        if (txId) {
            const poolInfoResult = await PoolInfoModal.findOne({
                address: poolAddress
            })

            if (!poolInfoResult) {
                return {
                    success: false,
                    message: `No pool found at address ${poolAddress}`,
                    payload: undefined
                }
            }

            let updatedPoolInfo: any;
            let newTxInfo: any;

            switch (swapType) {
                // user buy btc and sell rune
                case 1:
                    updatedPoolInfo = await PoolInfoModal.findOneAndUpdate(
                        {
                            address: poolAddress
                        },
                        {
                            runeAmount: poolInfoResult.runeAmount + poolRuneAmount,
                            btcAmount: poolInfoResult.btcAmount - btcAmount,
                            volume: poolInfoResult.volume + btcAmount,
                            isLocked: false
                        }
                    )

                    if (!updatedPoolInfo) {
                        return {
                            success: false,
                            message: `No pool found at address ${poolAddress}`,
                            payload: undefined
                        };
                    }

                    newTxInfo = new TransactionInfoModal({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        swapType: 1,
                        vout: 1,
                        txId: txId,
                        btcAmount: btcAmount,
                        poolRuneAmount: poolRuneAmount,
                        userRuneAmount: userRuneAmount,
                    })

                    await newTxInfo.save()
                    break;

                // user buy rune and receive btc
                case 2:
                    updatedPoolInfo = await PoolInfoModal.findOneAndUpdate(
                        {
                            address: poolAddress
                        },
                        {
                            runeAmount: poolInfoResult.runeAmount - poolRuneAmount,
                            btcAmount: poolInfoResult.btcAmount + btcAmount,
                            volume: poolInfoResult.volume + btcAmount,
                            isLocked: false
                        }
                    )

                    if (!updatedPoolInfo) {
                        return {
                            success: false,
                            message: `No pool found at address ${poolAddress}`,
                            payload: undefined
                        };
                    }

                    newTxInfo = new TransactionInfoModal({
                        poolAddress: poolAddress,
                        userAddress: userAddress,
                        swapType: 2,
                        txId: txId,
                        vout: 1,
                        btcAmount: btcAmount,
                        poolRuneAmount: poolRuneAmount,
                        userRuneAmount: userRuneAmount
                    })

                    await newTxInfo.save()
                    break;
            }

            const transactionInfoResult = await TransactionInfoModal.updateMany(
                {
                    poolAddress: poolAddress,
                    txId: { $in: usedTransactionList }
                },
                {
                    $set: {
                        isUsed: true
                    }
                }
            );

            // socket connection with Front end of price, volume, runeAmount, btcAmount
            io.emit("pool-socket", getPoolSocket())

            return {
                success: true,
                message: `Push swap psbt successfully`,
                payload: txId,
            };
        } else {
            return {
                success: false,
                message: `No pool found at address ${poolAddress}`,
                payload: undefined
            };
        }
    } else {
        return {
            success: false,
            message: `This user keep signing over ${lockTime} sec`,
            payload: undefined,
        };
    }
}

export const removeSwapTransaction = async (poolAddress: string, userAddress: string) => {
    const isPoolAddressExisted = await PoolInfoModal.findOne({
        address: poolAddress
    })

    if (!isPoolAddressExisted) {
        return {
            success: false,
            message: `No pool found at address ${poolAddress}`,
            payload: undefined,
        };
    }

    if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
        await PoolInfoModal.findOneAndUpdate(
            { address: poolAddress },
            { $set: { isLocked: false } }
        )
    }

    return {
        success: true,
        message: `Remove swap transaction successfully`,
        payload: undefined,
    };
}