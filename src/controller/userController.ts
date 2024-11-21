import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import { getBtcUtxoByAddress, getRuneBalanceListByAddress, getRuneUtxoByAddress } from "../service/service";
import PoolInfoModal from "../model/PoolInfo";
import { IRuneUtxo } from "../utils/type";

dotenv.config();

export const getUserRuneInfo = async (userAddress: string) => {
    const poolInfoResult = await PoolInfoModal.find();

    const poolRuneInfoSet = poolInfoResult.map(item => { return item.runeId });

    console.log('poolRuneInfoSet :>> ', poolRuneInfoSet);
    console.log('userAddress :>> ', userAddress);
    const addressRuneBalance = await getRuneBalanceListByAddress(userAddress);
    console.log('addressRuneBalance :>> ', addressRuneBalance);

    const matchedRuneInfo = addressRuneBalance
        ?.map(item => item.runeid)
        .filter(runeId => poolRuneInfoSet.includes(runeId)) || [];

    console.log('matchedRuneInfo :>> ', matchedRuneInfo);

    const tempUserRuneInfo: any = await Promise.all(
        matchedRuneInfo.map(async runeId => {
            const { tokenSum } = await getRuneUtxoByAddress(userAddress, runeId);
            return {
                tokenType: "rune",
                btcAmount: '',
                ticker: '',
                poolAddress: '',
                runeAmont: tokenSum,
                runeId: runeId,
            };
        })
    );

    const userBtcInfo = await getBtcUtxoByAddress(userAddress);

    const userRuneInfo = tempUserRuneInfo;

    return {
        success: true,
        message: "get user rune info successfully",
        payload: userRuneInfo,
    };
}