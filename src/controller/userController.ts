import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import { getBtcUtxoByAddress, getRuneBalanceListByAddress, getRuneUtxoByAddress, getBtcBalanceByAddress } from "../service/service";
import PoolInfoModal from "../model/PoolInfo";
import { IRuneUtxo } from "../utils/type";
import { OPENAPI_UNISAT_TOKEN } from "../config/config";

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