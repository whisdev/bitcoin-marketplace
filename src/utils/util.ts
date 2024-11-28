import mempoolJS from "@mempool/mempool.js";
import axios from "axios";

import {
  brc20LockTime,
  runeLockTime,
  testVersion
} from "../config/config";

import RuneTransactionInfoModal from "../model/RuneTransactionInfo";
import Brc20TransactionInfoModal from "../model/Brc20TransactionInfo";
import SwapHistoryModal from "../model/SwapHistory";
import RunePoolInfoModal from "../model/RunePoolInfo";
import Brc20PoolInfoModal from "../model/Brc20PoolInfo";

import { io } from "../server";
import { getPrice } from "../service/service";

export const splitData = (data: Array<any>, bundleSize: number): Array<any> => {
  // initialize new splited Data array
  let newSplitDataArray: Array<any> = [];

  // one element management item
  let item: Array<any> = [];

  // iterator for loop
  let iterator = 0;

  // loop whole data array
  for (let i = 0; i < data.length; i++) {
    if (iterator == bundleSize) {

      newSplitDataArray.push(item);
      item = [];
      iterator = 0;

    } else {
      item.push(data[i]);

      iterator++;
    }
  }
  if (iterator != 0) {
    newSplitDataArray.push(item);
  }
  return newSplitDataArray;
};

export const filterTransactionInfo = async (
  poolAddress: string,
  txList: Array<string>
) => {
  const txInfoList = await RuneTransactionInfoModal.find({
    poolAddress: poolAddress
  })

  return txInfoList.filter(txInfo => !txList.includes(txInfo.txId) && txInfo.isUsed !== true);
}

export const checkConfirmedTx = async () => {
  try {
    const {
      bitcoin: { websocket },
    } = testVersion
        ? mempoolJS({
          hostname: "mempool.space",
          network: "testnet",
        })
        : mempoolJS({
          hostname: "mempool.space",
        });

    const ws = websocket.initServer({
      options: ["blocks"],
    });

    ws.on("message", async function incoming(data: any) {
      const res: any = JSON.parse(data.toString());

      if (res.block) {
        const blockId = res.block.id;

        const txIds: any = await axios.get(
          testVersion
            ? `https://mempool.space/testnet/api/block/${blockId}/txids`
            : `https://mempool.space/api/block/${blockId}/txids`
        );

        const unconfirmedRuneTxs = await RuneTransactionInfoModal.find();
        const unconfirmedBrc20Txs = await Brc20TransactionInfoModal.find();

        console.log("after mempool block txids");

        unconfirmedRuneTxs.map(async (unconfirmedTx) => {
          if (txIds.data.includes(unconfirmedTx.txId)) {
            const newSwapHistory = new SwapHistoryModal({
              poolAddress: unconfirmedTx.poolAddress,
              txId: unconfirmedTx.txId,
              // vout: unconfirmedTx.vout,
              tokenAmount: unconfirmedTx.userRuneAmount,
              btcAmount: unconfirmedTx.btcAmount,
              tokenType: "RUNE",
              swapType: unconfirmedTx.swapType,
              userAddress: unconfirmedTx.userAddress
            })

            await newSwapHistory.save();
            await RuneTransactionInfoModal.deleteOne({
              txId: unconfirmedTx.txId
            });
          }
        });

        unconfirmedBrc20Txs.map(async (unconfirmedTx) => {
          if (txIds.data.includes(unconfirmedTx.txId)) {
            const newSwapHistory = new SwapHistoryModal({
              poolAddress: unconfirmedTx.poolAddress,
              txId: unconfirmedTx.txId,
              tokenAmount: unconfirmedTx.tokenAmount,
              btcAmount: unconfirmedTx.btcAmount,
              tokenType: "BRC20",
              swapType: unconfirmedTx.swapType,
              userAddress: unconfirmedTx.userAddress
            })

            await newSwapHistory.save();
            await Brc20TransactionInfoModal.deleteOne({
              txId: unconfirmedTx.txId
            });
          }
        });

        io.emit("mempool-socket", await getHistorySocket());
        io.emit("mempool-price-socket", await getPrice());
      }
    });
  } catch (error) {
    console.log("checkConfirmedTx error ==> ", error);
  }
};

// Update pool lock status as false if pool and lockedbyaddress is matched
export const updatePoolLockStatus = async (
  poolAddress: string,
  tokenType: string,
  userAddress: string,
) => {
  if (tokenType == "RUNE") {
    const poolInfoResult = await RunePoolInfoModal.findOne({ address: poolAddress });

    setTimeout(async () => {
      if (poolInfoResult?.isLocked && poolInfoResult.lockedByAddress == userAddress) {
        await RunePoolInfoModal.findOneAndUpdate(
          { address: poolAddress },
          { $set: { isLocked: false } }
        )
      }
    }, runeLockTime * 10 ** 3);
  } else {
    const poolInfoResult = await Brc20PoolInfoModal.findOne({ address: poolAddress });

    setTimeout(async () => {
      if (poolInfoResult?.isLocked && poolInfoResult.lockedByAddress == userAddress) {
        await Brc20PoolInfoModal.findOneAndUpdate(
          { address: poolAddress },
          { $set: { isLocked: false } }
        )
      }
    }, brc20LockTime * 10 ** 3);
  }
}

// socket about tx info
export const getHistorySocket = async () => {
  const historyInfo = await SwapHistoryModal.find();
  const runePoolInfo = await RunePoolInfoModal.find();
  const brc20PoolInfo = await Brc20PoolInfoModal.find();

  const historyInfoSet = historyInfo.map(item => {
    const matchedPool = runePoolInfo.find(pool => pool.address == item.poolAddress && item.tokenType == "RUNE") || brc20PoolInfo.find(pool => pool.address == item.poolAddress && item.tokenType == "BRC20")

    return {
      ticker: matchedPool?.ticker,
      poolAddress: item.poolAddress,
      tokenAmount: item.tokenAmount,
      tokenType: item.tokenType,
      btcAmount: item.btcAmount,
      userAddress: item.userAddress,
      swapType: item.swapType,
      txId: item.txId,
      createdAt: item.createdAt.getDate()
    }
  });

  return historyInfoSet;
}