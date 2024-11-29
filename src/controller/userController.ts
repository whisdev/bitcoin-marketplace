import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import dotenv from "dotenv";
const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

import {
	getBtcUtxoByAddress,
	getRuneBalanceListByAddress,
	getRuneUtxoByAddress,
	getBtcBalanceByAddress,
	getBrc20SummaryByAddress,
} from "../service/service";
import PoolInfoModal from "../model/RunePoolInfo";
import { IRuneUtxo } from "../utils/type";
import { OPENAPI_UNISAT_TOKEN } from "../config/config";

dotenv.config();

export const getUserRuneInfo = async (userAddress: string) => {
	const response = await getRuneBalanceListByAddress(userAddress);

	const userRuneInfo = response;

	return {
		success: true,
		message: "get user rune info successfully",
		payload: userRuneInfo,
	};
};

export const getUserBrc20Info = async (userAddress: string) => {
	const response = await getBrc20SummaryByAddress(userAddress);

	const userBrc20Info = response;

	return {
		success: true,
		message: "get user rune info successfully",
		payload: userBrc20Info,
	};
};

export const getWalletBalance = async (userAddress: string) => {
	// const response = await getBtcBalanceByAddress(userAddress);
	const utxos = await getBtcUtxoByAddress(userAddress);

	let balance = 0;
	for (const utxo of utxos) {
		if (utxo.value > 1000) {
			balance += utxo.value as number;
		}
	}

	// const balance = response;

	return {
		success: true,
		message: "get user rune info successfully",
		payload: balance,
	};
};
