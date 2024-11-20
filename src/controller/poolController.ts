import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import PoolInfoModal from "../model/PoolInfo";

dotenv.config();

export const getPullInfo = async () => {
  const poolInfo = await PoolInfoModal.find();

  if (poolInfo) {
    const poolInfoSet = poolInfo.map(item => {
      return {
        poolAddress: item.address,
        runeId: item.runeId,
        runeAmount: item.runeAmount,
        btcAmount: item.btcAmount,
        ticker: item.ticker,
        tokenType: item.tokenType,
        createdAt: item.createdAt
      }
    }
    );

    console.log('poolInfoSet :>> ', poolInfoSet);

    return {
      success: true,
      message: "Fetch All Info",
      payload: poolInfoSet,
    };
  } else {
    return {
      success: false,
      message: "There is no pool",
      payload: undefined,
    };
  }
}