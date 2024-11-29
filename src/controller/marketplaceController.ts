import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import { none, Runestone, RuneId } from "runelib";
import dotenv from "dotenv";

import {
	calculateTxFee,
	combinePsbt,
	createOrderBrc20Transfer,
	delay,
	generateUserInscribeBrc20Psbt,
	getBrc20TickerInfoByAddress,
	getBrc20TransferableInscriptionUtxoByAddress,
	getBtcUtxoByAddress,
	getFeeRate,
	getInscriptionData,
	getPrice,
	getRuneUtxoByAddress,
	pushRawTx,
} from "../service/service";
import {
	testVersion,
	testFeeRate,
	STANDARD_RUNE_UTXO_VALUE,
	SEND_UTXO_FEE_LIMIT,
	// runeLockTime,
	// brc20LockTime,
	userSendBrc20Fee,
	lockTime,
} from "../config/config";
import { filterTransactionInfo, updatePoolLockStatus } from "../utils/util";
import { getBrc20PullInfo, getRunePullInfo } from "./poolController";

import RuneTransactionInfoModal from "../model/RuneTransactionInfo";

import { io } from "../server";
import { LocalWallet } from "../service/localWallet";
import { buffer } from "stream/consumers";
import RunePoolInfoModal from "../model/RunePoolInfo";
import Brc20PoolInfoModal from "../model/Brc20PoolInfo";
import Brc20TransactionInfoModal from "../model/Brc20TransactionInfo";

const ecc = require("@bitcoinerlab/secp256k1");
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);
dotenv.config();

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

export const generateUserBuyRuneSellBtcPsbt = async (
	userPubkey: string,
	userAddress: string,
	userBuyRuneAmount: number,
	userSendBtcAmount: number,
	poolAddress: string
) => {
	const poolInfo = await RunePoolInfoModal.findOne({ address: poolAddress });
	if (!poolInfo) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (poolInfo.isLocked) {
		return {
			success: false,
			message: `Pool is locked. you can access ${lockTime}sec later`,
			payload: undefined,
		};
	}

	await RunePoolInfoModal.findOneAndUpdate(
		{ address: poolAddress },
		{
			$set: {
				isLocked: true,
				lockedByAddress: userAddress,
			},
		}
	);

	await updatePoolLockStatus(poolAddress, "RUNE", userAddress);

	const { divisibility, publickey: poolPubkey, runeId } = poolInfo;
	const requiredAmount = userBuyRuneAmount * 10 ** divisibility;

	// Fetch UTXOs
	const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
	const poolRuneUtxos = await getRuneUtxoByAddress(poolAddress, runeId as string);

	// Prepare PSBT and initialize values
	const psbt = new bitcoin.Psbt({ network });
	const edicts: any = [];
	const userInputArray: number[] = [];
	const poolInputArray: number[] = [];
	let cnt = 0;
	let tokenSum = 0;
	const txList = [];
	const usedTxList = [];
	const runeBlock = Number((runeId as string).split(":")[0]);
	const runeIdx = Number((runeId as string).split(":")[1]);

	// Add pool rune UTXO inputs to PSBT
	for (const runeutxo of poolRuneUtxos.runeUtxos) {
		if (tokenSum >= requiredAmount) break;

		psbt.addInput({
			hash: runeutxo.txid,
			index: runeutxo.vout,
			witnessUtxo: {
				value: runeutxo.value,
				script: Buffer.from(runeutxo.scriptpubkey, "hex"),
			},
			tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
		});

		poolInputArray.push(cnt++);
		tokenSum += runeutxo.amount;
		txList.push(runeutxo.txid);
	}

	// Add any missing rune UTXOs from transaction history
	const filterTxInfo = await filterTransactionInfo(poolAddress, txList);
	for (const runeutxo of filterTxInfo) {
		if (tokenSum >= requiredAmount) break;

		psbt.addInput({
			hash: runeutxo.txId,
			index: runeutxo.vout,
			witnessUtxo: {
				value: runeutxo.poolRuneAmount,
				script: Buffer.from(poolPubkey, "hex"),
			},
			tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
		});

		poolInputArray.push(cnt++);
		tokenSum += runeutxo.poolRuneAmount;
		usedTxList.push(runeutxo.txId);
	}

	// Check if enough rune is gathered
	if (tokenSum < requiredAmount) {
		const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient Rune balance",
			payload: undefined,
		};
	}

	// Add edicts for Rune outputs

	edicts.push({
		id: new RuneId(runeBlock, runeIdx),
		amount: requiredAmount,
		output: 1,
	});

	edicts.push({
		id: new RuneId(runeBlock, runeIdx),
		amount: tokenSum - requiredAmount,
		output: 2,
	});

	// Add Rune outputs to PSBT
	const mintstone = new Runestone(edicts, none(), none(), none());

	psbt.addOutput({
		script: mintstone.encipher(),
		value: 0,
	});

	psbt.addOutput({
		address: userAddress,
		value: STANDARD_RUNE_UTXO_VALUE,
	});

	psbt.addOutput({
		address: poolAddress,
		value: STANDARD_RUNE_UTXO_VALUE,
	});

	psbt.addOutput({
		address: poolAddress,
		value: Math.floor(userSendBtcAmount * 10 ** 8),
	});

	// Calculate transaction fee
	const feeRate = testVersion ? testFeeRate : await getFeeRate();
	const fee = calculateTxFee(psbt, feeRate) + Math.floor(userSendBtcAmount * 10 ** 8);

	// Add BTC UTXOs for covering fees
	let totalBtcAmount = 0;
	for (const btcutxo of userBtcUtxos) {
		if (totalBtcAmount >= fee) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			totalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
			});

			userInputArray.push(cnt++);
		}
	}

	// Check if enough BTC balance is available
	if (totalBtcAmount < fee) {
		const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance",
			payload: undefined,
		};
	}

	// Add change output
	psbt.addOutput({
		address: userAddress,
		value: totalBtcAmount - fee,
	});

	return {
		success: true,
		message: "PSBT generated successfully",
		payload: {
			psbt: psbt.toHex(),
			poolInputArray,
			userInputArray,
			usedTxList,
			userRuneAmount: requiredAmount,
			poolRuneAmount: tokenSum - requiredAmount,
		},
	};
};

export const generateUserBuyBtcSellRunePsbt = async (
	userPubkey: string,
	userAddress: string,
	userBuyBtcAmount: number,
	userSendRuneAmount: number,
	poolAddress: string
) => {
	const poolInfo = await RunePoolInfoModal.findOne({ address: poolAddress });
	if (!poolInfo) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (poolInfo.isLocked) {
		return {
			success: false,
			message: `Pool is locked. you can access ${lockTime}s later`,
			payload: undefined,
		};
	}

	await RunePoolInfoModal.findOneAndUpdate(
		{ address: poolAddress },
		{
			$set: {
				isLocked: true,
				lockedByAddress: userAddress,
			},
		}
	);

	await updatePoolLockStatus(poolAddress, "RUNE", userAddress);

	const { runeId, divisibility, publickey: poolPubkey } = poolInfo;
	const requiredAmount = userSendRuneAmount * 10 ** divisibility;

	// Fetch UTXOs
	const poolBtcUtxos = await getBtcUtxoByAddress(poolAddress);
	const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
	const userRuneUtxos = await getRuneUtxoByAddress(userAddress, runeId as string);

	// Prepare PSBT and initialize values
	const psbt = new bitcoin.Psbt({ network });
	const edicts: any = [];
	const userInputArray: number[] = [];
	const poolInputArray: number[] = [];
	let cnt = 0;
	let tokenSum = 0;
	const txList = [];
	const runeBlock = Number((runeId as string).split(":")[0]);
	const runeIdx = Number((runeId as string).split(":")[1]);

	// Add pool rune UTXO inputs to PSBT
	for (const runeutxo of userRuneUtxos.runeUtxos) {
		if (tokenSum >= requiredAmount) break;

		psbt.addInput({
			hash: runeutxo.txid,
			index: runeutxo.vout,
			witnessUtxo: {
				value: runeutxo.value,
				script: Buffer.from(runeutxo.scriptpubkey, "hex"),
			},
			tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
		});

		userInputArray.push(cnt++);
		tokenSum += runeutxo.amount;
		txList.push(runeutxo.txid);
	}

	// Check if enough rune is gathered
	if (tokenSum < requiredAmount) {
		const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient Rune balance",
			payload: undefined,
		};
	}

	// Add edicts for Rune outputs
	edicts.push({
		id: new RuneId(runeBlock, runeIdx),
		amount: requiredAmount,
		output: 1,
	});
	edicts.push({
		id: new RuneId(runeBlock, runeIdx),
		amount: tokenSum - requiredAmount,
		output: 2,
	});

	// Add Rune outputs to PSBT
	const mintstone = new Runestone(edicts, none(), none(), none());

	psbt.addOutput({
		script: mintstone.encipher(),
		value: 0,
	});

	psbt.addOutput({
		address: poolAddress,
		value: STANDARD_RUNE_UTXO_VALUE,
	});

	psbt.addOutput({
		address: userAddress,
		value: STANDARD_RUNE_UTXO_VALUE,
	});

	// Add BTC UTXOs for user buy btc amount
	let totalBtcAmount = 0;
	for (const btcutxo of poolBtcUtxos) {
		if (totalBtcAmount >= Math.floor(userBuyBtcAmount * 10 ** 8)) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			totalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
			});

			poolInputArray.push(cnt++);
		}
	}

	// Check if enough BTC balance is available
	if (totalBtcAmount < Math.floor(userBuyBtcAmount * 10 ** 8)) {
		const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance in Pool",
			payload: undefined,
		};
	}

	// Add change output
	psbt.addOutput({
		address: userAddress,
		value: Math.floor(userBuyBtcAmount * 10 ** 8),
	});

	psbt.addOutput({
		address: poolAddress,
		value: totalBtcAmount - Math.floor(userBuyBtcAmount * 10 ** 8),
	});

	// Calculate transaction fee
	const feeRate = testVersion ? testFeeRate : await getFeeRate();
	const fee = calculateTxFee(psbt, feeRate);

	console.log("fee :>> ", fee);
	// Add BTC UTXOs for covering fees
	let userTotalBtcAmount = 0;
	for (const btcutxo of userBtcUtxos) {
		if (userTotalBtcAmount >= fee) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			userTotalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
			});

			userInputArray.push(cnt++);
		}
	}

	// Check if enough BTC balance is available
	if (userTotalBtcAmount < fee) {
		await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance in User wallet",
			payload: undefined,
		};
	}

	psbt.addOutput({
		address: userAddress,
		value: userTotalBtcAmount - fee,
	});

	const usedTxList: [] = [];

	console.log("psbt :>> ", psbt);

	return {
		success: true,
		message: "PSBT generated successfully",
		payload: {
			psbt: psbt.toHex(),
			poolInputArray,
			userInputArray,
			usedTxList,
			poolRuneAmount: requiredAmount,
			userRuneAmount: requiredAmount,
		},
	};
};

export const generateUserBuyBrc20SellBtcPsbt = async (
	userPubkey: string,
	userAddress: string,
	userBuyBrc20Amount: number,
	userSendBtcAmount: number,
	poolAddress: string
) => {
	await delay(10000);

	const psbt = new bitcoin.Psbt({ network });
	const feeRate = testVersion ? testFeeRate : await getFeeRate();
	const userBtcUtxos = await getBtcUtxoByAddress(userAddress);

	const poolInfoResult = await Brc20PoolInfoModal.findOne({
		address: poolAddress,
	});

	if (!poolInfoResult) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (poolInfoResult.isLocked) {
		return {
			success: false,
			message: `Pool is locked. you can access ${lockTime}s later`,
			payload: undefined,
		};
	}

	await Brc20PoolInfoModal.findOneAndUpdate(
		{ address: poolAddress },
		{
			$set: {
				isLocked: true,
				lockedByAddress: userAddress,
			},
		}
	);

	await updatePoolLockStatus(poolAddress, "BRC20", userAddress);

	const ticker = poolInfoResult.ticker;
	const poolPubkey = poolInfoResult.publickey;

	const transferableBrc20TickerInfo = await getBrc20TransferableInscriptionUtxoByAddress(
		poolAddress,
		ticker
	);
	const matchedTickerInfo = transferableBrc20TickerInfo.find(
		(item) => item.data.amt == userBuyBrc20Amount
	);

	if (!matchedTickerInfo) {
		const psbt = new bitcoin.Psbt({ network });
		const feeRate = testVersion ? testFeeRate : await getFeeRate();

		const brc20TickerInfo = await getBrc20TickerInfoByAddress(poolAddress, ticker);

		if (brc20TickerInfo.availableBalance < userBuyBrc20Amount)
			throw `No sufficient available BRC20 amount`;

		const orderInscriptionInfo = await createOrderBrc20Transfer(
			poolAddress,
			feeRate,
			ticker,
			userBuyBrc20Amount
		);

		const payAddress = orderInscriptionInfo.payAddress;
		const inscriptionPayAmount = orderInscriptionInfo.amount;

		psbt.addOutput({
			address: payAddress,
			value: inscriptionPayAmount,
		});

		psbt.addOutput({
			address: poolAddress,
			value: userSendBtcAmount,
		});

		psbt.addOutput({
			address: poolAddress,
			value: userSendBrc20Fee,
		});

		// add btc utxo input
		let totalBtcAmount = 0;

		for (const btcutxo of userBtcUtxos) {
			const fee =
				calculateTxFee(psbt, feeRate) + inscriptionPayAmount + userSendBtcAmount + userSendBrc20Fee;
			if (totalBtcAmount < fee && btcutxo.value > 10000) {
				totalBtcAmount += btcutxo.value;

				psbt.addInput({
					hash: btcutxo.txid,
					index: btcutxo.vout,
					witnessUtxo: {
						value: btcutxo.value,
						script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					},
					tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
				});
			}
		}

		const fee =
			calculateTxFee(psbt, feeRate) + inscriptionPayAmount + userSendBtcAmount + userSendBrc20Fee;

		if (totalBtcAmount < fee) throw `BTC balance in User of ${userAddress} is not enough`;

		psbt.addOutput({
			address: userAddress,
			value: totalBtcAmount - fee,
		});

		return {
			success: true,
			message: `You need to pay for the pool inscription`,
			payload: {
				psbt: psbt.toHex(),
				status: "INSCRIBE",
			},
		};
	}

	psbt.addOutput({
		address: userAddress,
		value: matchedTickerInfo.satoshi,
	});

	psbt.addOutput({
		address: poolAddress,
		value: Math.floor(userSendBtcAmount * 10 ** 8),
	});

	const poolInputArray: number[] = [];
	const userInputArray: number[] = [];

	let userTotalBtcAmount = 0;
	let cnt = 0;

	psbt.addInput({
		hash: matchedTickerInfo.txid,
		index: matchedTickerInfo.vout,
		witnessUtxo: {
			value: matchedTickerInfo.satoshi,
			script: Buffer.from(poolPubkey, "hex"),
		},
		tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
	});

	poolInputArray.push(cnt++);

	for (const btcutxo of userBtcUtxos) {
		const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount;
		if (userTotalBtcAmount >= fee) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			userTotalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
			});

			userInputArray.push(cnt++);
		}
	}

	const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount;

	// Check if enough BTC balance is available
	if (userTotalBtcAmount < fee) {
		await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance in User wallet",
			payload: undefined,
		};
	}

	psbt.addOutput({
		address: userAddress,
		value: userTotalBtcAmount - fee,
	});

	return {
		success: true,
		message: `PSBT generated successfully`,
		payload: {
			psbt: psbt.toHex(),
			poolInputArray,
			userInputArray,
			userBuyBrc20Amount,
			status: "TRANSFER",
		},
	};
};

export const poolTransferBrc20 = async (
	userPubkey: string,
	userAddress: string,
	poolSendBrc20Amount: number,
	poolReceiveBtcAmount: number,
	poolAddress: string
) => {
	const isPoolAddressExisted = await Brc20PoolInfoModal.findOne({
		address: poolAddress,
	});

	if (!isPoolAddressExisted) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
		delay(15000);

		const feeRate = testVersion ? testFeeRate : await getFeeRate();
		const poolInfoResult = await Brc20PoolInfoModal.findOne({
			address: poolAddress,
		});

		if (!poolInfoResult) {
			return {
				success: false,
				message: `No pool found at address ${poolAddress}`,
				payload: undefined,
			};
		}

		const ticker = poolInfoResult.ticker;
		const poolPubkey = poolInfoResult.publickey;
		const poolPrivkey = poolInfoResult.privatekey;
		const poolWallet = new LocalWallet(poolPrivkey, testVersion ? 1 : 0);

		const psbt = new bitcoin.Psbt({ network });

		const inscriptionList = await getBrc20TransferableInscriptionUtxoByAddress(poolAddress, ticker);
		const btcUtxos = await getBtcUtxoByAddress(poolAddress);

		const existedInscription = inscriptionList.find(
			(inscription) =>
				inscription.data.tick.toUpperCase() == ticker.toUpperCase() &&
				inscription.data.amt == poolSendBrc20Amount
		);

		if (!existedInscription) {
			return {
				success: false,
				message: `No inscription of ${ticker} - ${poolSendBrc20Amount} at address ${userAddress}`,
				payload: undefined,
			};
		}

		const inscriptionData = await getInscriptionData(poolAddress, existedInscription.inscriptionId);

		psbt.addInput({
			hash: inscriptionData.txid,
			index: inscriptionData.vout,
			witnessUtxo: {
				value: inscriptionData.satoshi,
				script: Buffer.from(poolPubkey, "hex"),
			},
			tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
		});

		psbt.addOutput({
			address: userAddress,
			value: inscriptionData.satoshi,
		});

		// add btc utxo input
		let totalBtcAmount = 0;

		for (const btcutxo of btcUtxos) {
			const fee = calculateTxFee(psbt, feeRate);
			if (totalBtcAmount < fee && btcutxo.value > 10000) {
				totalBtcAmount += btcutxo.value;

				psbt.addInput({
					hash: btcutxo.txid,
					index: btcutxo.vout,
					witnessUtxo: {
						value: btcutxo.value,
						script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					},
					tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
				});
			}
		}

		const fee = calculateTxFee(psbt, feeRate);

		if (totalBtcAmount < fee) throw "BTC balance is not enough";

		psbt.addOutput({
			address: poolAddress,
			value: totalBtcAmount - fee,
		});

		const poolSignedPsbt = await poolWallet.signPsbt(psbt);
		const tx = poolSignedPsbt.extractTransaction();
		const txHex = tx.toHex();

		const txId = await pushRawTx(txHex);

		// db features
		if (txId) {
			let updatedPoolInfo: any;
			let newTxInfo: any;

			updatedPoolInfo = await Brc20PoolInfoModal.findOneAndUpdate(
				{ address: poolAddress },
				{
					$set: {
						safeTokenAmount: isPoolAddressExisted.safeTokenAmount - poolSendBrc20Amount,
						btcAmount: isPoolAddressExisted.btcAmount + poolReceiveBtcAmount,
						volume: isPoolAddressExisted.volume + poolReceiveBtcAmount,
						isLocked: false,
					},
				}
			);

			const newBrc20Transaction = new Brc20TransactionInfoModal({
				poolAddress: poolAddress,
				userAddress: userAddress,
				txId: txId,
				tokenAmount: poolSendBrc20Amount,
				btcAmount: poolReceiveBtcAmount,
				swapType: 1,
			});

			await newBrc20Transaction.save();

			if (!updatedPoolInfo) {
				await Brc20PoolInfoModal.findOneAndUpdate(
					{ address: poolAddress },
					{ $set: { isLocked: false } }
				);

				return {
					success: false,
					message: `No pool found at address ${poolAddress}`,
					payload: undefined,
				};
			}

			// socket connection with Front end of price, volume, runeAmount, btcAmount
			io.emit("brc20-pool-socket", getBrc20PullInfo());

			return {
				success: true,
				message: `Push swap psbt successfully`,
				payload: txId,
			};
		} else {
			await Brc20PoolInfoModal.findOneAndUpdate(
				{ address: poolAddress },
				{ $set: { isLocked: false } }
			);

			return {
				success: false,
				message: `No pool found at address ${poolAddress}`,
				payload: undefined,
			};
		}
	} else {
		return {
			success: false,
			message: `This user keep signing over ${lockTime} sec`,
			payload: undefined,
		};
	}
};

export const generateUserBuyBtcSellBrc20Psbt = async (
	userAddress: string,
	userPubkey: string,
	userSendBrc20Amount: number,
	userBuyBtcAmount: number,
	poolAddress: string
) => {
	await delay(10000);

	const psbt = new bitcoin.Psbt({ network });
	const feeRate = testVersion ? testFeeRate : await getFeeRate();
	const poolInfoResult = await Brc20PoolInfoModal.findOne({
		address: poolAddress,
	});

	if (!poolInfoResult) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (poolInfoResult.isLocked) {
		return {
			success: false,
			message: `Pool is locked. you can access ${lockTime}s later`,
			payload: undefined,
		};
	}

	await Brc20PoolInfoModal.findOneAndUpdate(
		{ address: poolAddress },
		{
			$set: {
				isLocked: true,
				lockedByAddress: userAddress,
			},
		}
	);

	await updatePoolLockStatus(poolAddress, "BRC20", userAddress);

	const ticker = poolInfoResult.ticker;
	const poolPubkey = poolInfoResult.publickey;

	const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
	const transferableBrc20TickerInfo = await getBrc20TransferableInscriptionUtxoByAddress(
		userAddress,
		ticker
	);
	const matchedTickerInfo = transferableBrc20TickerInfo.find(
		(item) => item.data.amt == userSendBrc20Amount
	);

	if (!matchedTickerInfo) {
		const psbt = await generateUserInscribeBrc20Psbt(
			userAddress,
			userPubkey,
			userSendBrc20Amount,
			ticker,
			userBtcUtxos
		);

		return {
			success: true,
			message: "User need to inscribe Brc20 token first",
			payload: {
				psbt: psbt,
				status: "INSCRIBE",
			},
		};
	}

	const poolBtcUtxos = await getBtcUtxoByAddress(poolAddress);

	psbt.addOutput({
		address: poolAddress,
		value: matchedTickerInfo.satoshi,
	});

	psbt.addOutput({
		address: userAddress,
		value: Math.floor(userBuyBtcAmount * 10 ** 8),
	});

	const poolInputArray: number[] = [];
	const userInputArray: number[] = [];

	let userTotalBtcAmount = 0;
	let poolTotalBtcAmount = 0;
	let cnt = 0;

	psbt.addInput({
		hash: matchedTickerInfo.txid,
		index: matchedTickerInfo.vout,
		witnessUtxo: {
			value: matchedTickerInfo.satoshi,
			script: Buffer.from(poolPubkey, "hex"),
		},
		tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
	});

	for (const btcutxo of poolBtcUtxos) {
		if (poolTotalBtcAmount >= Math.floor(userBuyBtcAmount * 10 ** 8)) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			poolTotalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(poolPubkey, "hex").slice(1, 33),
			});

			poolInputArray.push(cnt++);
		}
	}

	// Check if enough BTC balance is available
	if (poolTotalBtcAmount < Math.floor(userBuyBtcAmount * 10 ** 8)) {
		const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance in Pool",
			payload: undefined,
		};
	}

	const fee = calculateTxFee(psbt, feeRate);

	for (const btcutxo of userBtcUtxos) {
		if (userTotalBtcAmount >= fee) break;

		if (btcutxo.value > SEND_UTXO_FEE_LIMIT) {
			userTotalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
					value: btcutxo.value,
				},
				tapInternalKey: Buffer.from(userPubkey, "hex").slice(1, 33),
			});

			userInputArray.push(cnt++);
		}
	}

	// Check if enough BTC balance is available
	if (userTotalBtcAmount < fee) {
		await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: "Insufficient BTC balance in User wallet",
			payload: undefined,
		};
	}

	psbt.addOutput({
		address: userAddress,
		value: userTotalBtcAmount - fee,
	});

	return {
		success: true,
		message: `PSBT generated successfully`,
		payload: {
			psbt: psbt.toHex(),
			poolInputArray,
			userInputArray,
			userSendBrc20Amount,
			status: "TRANSFER",
		},
	};
};

export const pushBrc20SwapPsbt = async (
	psbt: string,
	userSignedHexedPsbt: string,
	userAddress: string,
	poolAddress: string,
	brc20Amount: number,
	btcAmount: number,
	poolInputArray: number[],
	userInputArray: number[],
	swapType: number
) => {
	const isPoolAddressExisted = await Brc20PoolInfoModal.findOne({
		address: poolAddress,
	});

	if (!isPoolAddressExisted) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
		const privateKey = isPoolAddressExisted.privatekey;

		const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

		userInputArray.forEach((input: number) => userSignedPsbt.finalizeInput(input));

		const keyPair = ECPair.fromWIF(privateKey, network);

		const poolWallet = new LocalWallet(privateKey as string, testVersion ? 1 : 0);

		const poolSignedPsbt = await poolWallet.signPsbt(userSignedPsbt, poolInputArray);

		// broadcast tx
		const txId = await combinePsbt(psbt, poolSignedPsbt.toHex(), userSignedPsbt.toHex());

		// db features
		if (txId) {
			let updatedPoolInfo: any;
			let newBrc20Transaction: any;

			switch (swapType) {
				case 1:
					updatedPoolInfo = await Brc20PoolInfoModal.findOneAndUpdate(
						{ address: poolAddress },
						{
							$set: {
								safeTokenAmount: isPoolAddressExisted.unsafeTokenAmount - brc20Amount,
								btcAmount: isPoolAddressExisted.btcAmount + btcAmount,
								volume: isPoolAddressExisted.volume + btcAmount,
								isLocked: false,
							},
						}
					);

					newBrc20Transaction = new Brc20TransactionInfoModal({
						poolAddress: poolAddress,
						userAddress: userAddress,
						txId: txId,
						tokenAmount: brc20Amount,
						btcAmount: btcAmount,
						swapType: 1,
					});

					await newBrc20Transaction.save();

					break;

				case 2:
					updatedPoolInfo = await Brc20PoolInfoModal.findOneAndUpdate(
						{ address: poolAddress },
						{
							$set: {
								safeTokenAmount: isPoolAddressExisted.unsafeTokenAmount + brc20Amount,
								btcAmount: isPoolAddressExisted.btcAmount - btcAmount,
								volume: isPoolAddressExisted.volume + btcAmount,
								isLocked: false,
							},
						}
					);

					newBrc20Transaction = new Brc20TransactionInfoModal({
						poolAddress: poolAddress,
						userAddress: userAddress,
						txId: txId,
						tokenAmount: brc20Amount,
						btcAmount: btcAmount,
						swapType: 2,
					});

					await newBrc20Transaction.save();

				default:
					break;
			}

			if (!updatedPoolInfo) {
				await Brc20PoolInfoModal.findOneAndUpdate(
					{ address: poolAddress },
					{ $set: { isLocked: false } }
				);

				return {
					success: false,
					message: `No pool found at address ${poolAddress}`,
					payload: undefined,
				};
			}

			// socket connection with Front end of price, volume, runeAmount, btcAmount
			io.emit("brc20-pool-socket", getBrc20PullInfo());

			return {
				success: true,
				message: `Push swap psbt successfully`,
				payload: txId,
			};
		} else {
			await Brc20PoolInfoModal.findOneAndUpdate(
				{ address: poolAddress },
				{ $set: { isLocked: false } }
			);

			return {
				success: false,
				message: `No pool found at address ${poolAddress}`,
				payload: undefined,
			};
		}
	} else {
		return {
			success: false,
			message: `This user keep signing over ${lockTime} sec`,
			payload: undefined,
		};
	}
};

export const pushRuneSwapPsbt = async (
	psbt: string,
	userSignedHexedPsbt: string,
	poolRuneAmount: number,
	userRuneAmount: number,
	btcAmount: number,
	userInputArray: Array<number>,
	poolInputArray: Array<number>,
	userAddress: string,
	poolAddress: string,
	usedTransactionList: string[],
	swapType: number
) => {
	const isPoolAddressExisted = await RunePoolInfoModal.findOne({
		address: poolAddress,
	});

	if (!isPoolAddressExisted) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
		const privateKey = isPoolAddressExisted.privatekey;

		const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

		userInputArray.forEach((input: number) => userSignedPsbt.finalizeInput(input));

		const keyPair = ECPair.fromWIF(privateKey, network);

		const poolWallet = new LocalWallet(privateKey as string, testVersion ? 1 : 0);

		const poolSignedPsbt = await poolWallet.signPsbt(userSignedPsbt, poolInputArray);

		// broadcast tx
		const txId = await combinePsbt(psbt, poolSignedPsbt.toHex(), userSignedPsbt.toHex());

		// db features
		if (txId) {
			let updatedPoolInfo: any;
			let newTxInfo: any;

			switch (swapType) {
				// user buy btc and sell rune
				case 1:
					updatedPoolInfo = await RunePoolInfoModal.findOneAndUpdate(
						{
							address: poolAddress,
						},
						{
							$set: {
								runeAmount: isPoolAddressExisted.tokenAmount - userRuneAmount,
								btcAmount: isPoolAddressExisted.btcAmount + btcAmount,
								volume: isPoolAddressExisted.volume + btcAmount,
								isLocked: false,
							},
						}
					);

					if (!updatedPoolInfo) {
						await RunePoolInfoModal.findOneAndUpdate(
							{ address: poolAddress },
							{ $set: { isLocked: false } }
						);

						return {
							success: false,
							message: `No pool found at address ${poolAddress}`,
							payload: undefined,
						};
					}

					newTxInfo = new RuneTransactionInfoModal({
						poolAddress: poolAddress,
						userAddress: userAddress,
						swapType: 1,
						vout: 1,
						txId: txId,
						btcAmount: btcAmount,
						poolRuneAmount: poolRuneAmount,
						userRuneAmount: userRuneAmount,
					});

					await newTxInfo.save();
					break;

				// user buy rune and receive btc
				case 2:
					updatedPoolInfo = await RunePoolInfoModal.findOneAndUpdate(
						{ address: poolAddress },
						{
							$set: {
								runeAmount: isPoolAddressExisted.tokenAmount + userRuneAmount,
								btcAmount: isPoolAddressExisted.btcAmount - btcAmount,
								volume: isPoolAddressExisted.volume + btcAmount,
								isLocked: false,
							},
						}
					);

					if (!updatedPoolInfo) {
						await RunePoolInfoModal.findOneAndUpdate(
							{ address: poolAddress },
							{ $set: { isLocked: false } }
						);

						return {
							success: false,
							message: `No pool found at address ${poolAddress}`,
							payload: undefined,
						};
					}

					newTxInfo = new RuneTransactionInfoModal({
						poolAddress: poolAddress,
						userAddress: userAddress,
						swapType: 2,
						txId: txId,
						vout: 1,
						btcAmount: btcAmount,
						poolRuneAmount: poolRuneAmount,
						userRuneAmount: userRuneAmount,
					});

					await newTxInfo.save();
					break;
			}

			if (usedTransactionList.length > 0) {
				const transactionInfoResult = await RuneTransactionInfoModal.updateMany(
					{
						poolAddress: poolAddress,
						txId: { $in: usedTransactionList },
					},
					{
						$set: {
							isUsed: true,
						},
					}
				);
			}

			// socket connection with Front end of price, volume, runeAmount, btcAmount
			io.emit("rune-pool-socket", getRunePullInfo());

			return {
				success: true,
				message: `Push swap psbt successfully`,
				payload: txId,
			};
		} else {
			const poolLockedResult = await RunePoolInfoModal.findOneAndUpdate(
				{ address: poolAddress },
				{ $set: { isLocked: false } }
			);

			return {
				success: false,
				message: `No pool found at address ${poolAddress}`,
				payload: undefined,
			};
		}
	} else {
		return {
			success: false,
			message: `This user keep signing over ${lockTime} sec`,
			payload: undefined,
		};
	}
};

export const getMempoolBtcPrice = async () => {
	const price = await getPrice();

	return {
		success: true,
		message: `Mempool price is ${price}`,
		payload: price,
	};
};

export const removeSwapTransaction = async (
	poolAddress: string,
	userAddress: string,
	tokenType: string
) => {
	let isPoolAddressExisted;
	if (tokenType == "BRC20") {
		isPoolAddressExisted = await Brc20PoolInfoModal.findOne({
			address: poolAddress,
		});
	} else {
		isPoolAddressExisted = await RunePoolInfoModal.findOne({
			address: poolAddress,
		});
	}

	if (!isPoolAddressExisted) {
		return {
			success: false,
			message: `No pool found at address ${poolAddress}`,
			payload: undefined,
		};
	}

	if (isPoolAddressExisted.isLocked && isPoolAddressExisted.lockedByAddress == userAddress) {
		await RunePoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);
	}

	return {
		success: true,
		message: `Unlock ${tokenType} pool - ${poolAddress} successfully`,
		payload: undefined,
	};
};
