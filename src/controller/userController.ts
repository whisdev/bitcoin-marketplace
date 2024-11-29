import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import { getBtcUtxoByAddress, getRuneBalanceListByAddress, getRuneUtxoByAddress, getBtcBalanceByAddress, getBrc20SummaryByAddress } from "../service/service";

dotenv.config();

export const getUserRuneInfo = async (userAddress: string) => {

    const response = await getRuneBalanceListByAddress(userAddress);
   
    const userRuneInfo = response;
    console.log('userRuneInfo :>> ', userRuneInfo);

    return {
        success: true,
        message: "get user rune info successfully",
        payload: userRuneInfo,
    };
}

export const getUserBrc20Info = async (userAddress: string) => {

    const response = await getBrc20SummaryByAddress(userAddress);
   
    const userBrc20Info = response;
    console.log('userRuneInfo :>> ', userBrc20Info);

    return {
        success: true,
        message: "get user rune info successfully",
        payload: userBrc20Info,
    };
}

export const getWalletBalance = async (userAddress: string) => {
    const response = await getBtcBalanceByAddress(userAddress);
   
    const balance = response;
    console.log('userWalletBalanceInfo :>> ', balance);
    return {
        success: true,
        message: "get user rune info successfully",
        payload: balance,
    };
}