import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import RunePoolInfoModal from "../model/RunePoolInfo";
import Brc20PoolInfoModal from "../model/Brc20PoolInfo";

dotenv.config();

export const getPullInfo = async () => {
  const runePoolInfo = await RunePoolInfoModal.find();
  const brc20PoolInfo = await Brc20PoolInfoModal.find();

  let runePoolInfoSet;
  let brc20PoolInfoSet;

  if (runePoolInfo) {
    runePoolInfoSet = runePoolInfo.map(item => {
      return {
        poolAddress: item.address,
        runeId: item.runeId,
        runeAmount: item.tokenAmount,
        btcAmount: item.btcAmount,
        ticker: item.ticker,
        price: (item.btcAmount / item.tokenAmount).toFixed(6),
        createdAt: item.createdAt
      }
    });
  }

  if (brc20PoolInfo) {
    brc20PoolInfoSet = brc20PoolInfo.map(item => {
      return {
        poolAddress: item.address,
        ticker: item.ticker,
        safeTokenAmount: item.safeTokenAmount,
        unsafeTokenAmount: item.unsafeTokenAmount,
        btcAmount: item.btcAmount,
        price: (item.btcAmount / (item.safeTokenAmount + item.unsafeTokenAmount)).toFixed(6),
        createdAt: item.createdAt
      }
    })
  }

  return {
    success: true,
    message: "Fetch All Info",
    payload: {
      runePoolInfo: runePoolInfoSet,
      brc20PoolInfo: brc20PoolInfoSet
    },
  };
}

export const getRunePullInfo = async () => {
  const runePoolInfo = await RunePoolInfoModal.find();

  let runePoolInfoSet;

  if (runePoolInfo) {
    runePoolInfoSet = runePoolInfo.map(item => {
      return {
        poolAddress: item.address,
        runeId: item.runeId,
        runeAmount: item.tokenAmount,
        btcAmount: item.btcAmount,
        ticker: item.ticker,
        price: (item.btcAmount / item.tokenAmount).toFixed(6),
        createdAt: item.createdAt
      }
    });
  }

  return {
    success: true,
    message: "Fetch Rune pull Info",
    payload: runePoolInfoSet
  };
}

export const getBrc20PullInfo = async () => {
  const brc20PoolInfo = await Brc20PoolInfoModal.find();

  let brc20PoolInfoSet;

  if (brc20PoolInfo) {
    brc20PoolInfoSet = brc20PoolInfo.map(item => {
      return {
        poolAddress: item.address,
        ticker: item.ticker,
        safeTokenAmount: item.safeTokenAmount,
        unsafeTokenAmount: item.unsafeTokenAmount,
        btcAmount: item.btcAmount,
        price: (item.btcAmount / (item.safeTokenAmount + item.unsafeTokenAmount)).toFixed(6),
        createdAt: item.createdAt
      }
    })
  }

  return {
    success: true,
    message: "Fetch Brc20 pull Info",
    payload: brc20PoolInfoSet
  };
}