import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from 'dotenv';
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import { getRuneBalanceListByAddress, getRuneUtxoByAddress } from "../service/service";
import PoolInfoModal from "../model/PoolInfo";
import { IRuneUtxo } from "../utils/type";

dotenv.config();

export const getUserRuneInfo = async (userAddress: string) => {
    const poolInfoResult = await PoolInfoModal.find();

    const poolRuneInfoSet = new Set(
        poolInfoResult.map(item => `${item.runeBlockNumber}:${item.runeTxout}`)
    );

    const addressRuneBalance = await getRuneBalanceListByAddress(userAddress);
    console.log('addressRuneBalance :>> ', addressRuneBalance);

    const matchedRuneInfo = addressRuneBalance
        ?.map(item => item.runeid)
        .filter(runeId => poolRuneInfoSet.has(runeId)) || [];

    console.log('matchedRuneInfo :>> ', matchedRuneInfo);

    const userRuneUtxoInfo: IRuneUtxo[] = await Promise.all(
        matchedRuneInfo.map(async runeId => {
            const { runeUtxos } = await getRuneUtxoByAddress(runeId, userAddress);
            return runeUtxos;
        })
    ).then(results => results.flat());

    return userRuneUtxoInfo;

}