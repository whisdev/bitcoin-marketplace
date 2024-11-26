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

    const addressRuneBalance = await getRuneBalanceListByAddress(userAddress);

    // runeAmount, runeId, ticker, runebalance, btcbalance
    // const tempUserRuneInfo: any = await Promise.all(
    //     addressRuneBalance?.map(async item => {
    //         const { tokenSum } = await getRuneUtxoByAddress(userAddress, item.runeId);
    //         return {
    //             tokenType: "rune",
    //             btcAmount: '',
    //             ticker: '',
    //             poolAddress: '',
    //             runeAmont: tokenSum,
    //             runeId: runeId,
    //         };
    //     })
    // );

    // const { tokenSum } = await 
    // const userBtcInfo = await getBtcUtxoByAddress(userAddress);

    const userRuneInfo = "tempUserRuneInfo";

    return {
        success: true,
        message: "get user rune info successfully",
        payload: userRuneInfo,
    };
}