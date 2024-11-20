import mempoolJS from "@mempool/mempool.js";
import axios from "axios";

import TransactionInfoModal from "../model/TransactionInfo";
import {
  lockTime,
  testVersion
} from "../config/config";
import SwapHistoryModal from "../model/SwapHistory";
import PoolInfoModal from "../model/PoolInfo";

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
  const txInfoList = await TransactionInfoModal.find({
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

        const unconfirmedTxs = await TransactionInfoModal.aggregate([
          {
            $match: { isConfirmed: false }, // Stage 1: Match documents where confirmed is false
          },
        ]);

        unconfirmedTxs.map(async (unconfirmedTx) => {
          if (txIds.data.includes(unconfirmedTx.txId)) {
            const newSwapHistory = new SwapHistoryModal({
              poolAddress: unconfirmedTx.poolAddress,
              txId: unconfirmedTx.txId,
              vout: unconfirmedTx.vout,
              runeAmount: unconfirmedTx.poolRuneAmount,
              btcAmount: unconfirmedTx.btcAmount,
              swapType: unconfirmedTx.swapType,
              userAddress: unconfirmedTx.userAddress
            })

            await newSwapHistory.save();

            const updatedBid = await TransactionInfoModal.deleteOne({
              txId: unconfirmedTx.txId
            });
          }
        });
      }
    });
  } catch (error) {
    console.log("checkConfirmedTx error ==> ", error);
  }
};

// Update pool lock status as false if pool and lockedbyaddress is matched
export const updatePoolLockStatus = async (
  poolAddress: string,
  userAddress: string
) => {
  const poolInfoResult = await PoolInfoModal.findOne({
    address: poolAddress
  })

  setTimeout(async () => {
    if (poolInfoResult?.isLocked && poolInfoResult.lockedByAddress == userAddress) {
      console.log("updatePoolLockStatus");
      await PoolInfoModal.findOneAndUpdate(
        { address: poolAddress },
        { $set: { isLocked: false } }
      )
    }
    console.log("updatePoolLockStatus");
  }, lockTime * 10 ** 3);
}

// socket about pool info
export const getPoolSocket = async () => {
  const poolInfo = await PoolInfoModal.find();

  const poolInfoSet = poolInfo.map(item => {
    return {
      poolAddress: item.address,
      runeId: item.runeId,
      runeAmount: item.runeAmount,
      btcAmount: item.btcAmount,
      createdAt: item.createdAt
    }
  });

  return poolInfoSet;
}

// socket about tx info
export const getHistorySocket = async () => {
  const historyInfo = await SwapHistoryModal.find();

  const histofyInfoSet = historyInfo.map(item => {
    return {
      poolName: item.poolAddress,
      runeAmount: item.runeAmount,
      btcAmount: item.btcAmount,
      userAddress: item.userAddress,
      swapType: item.swapType
    }
  });

  return histofyInfoSet;
}