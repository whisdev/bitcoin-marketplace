import * as bitcoin from "bitcoinjs-lib";
import { none, RuneId, Runestone } from "runelib";

import {
	calculateTxFee,
	combinePsbt,
	createOrderBrc20Transfer,
	delay,
	getBrc20TickerInfoByAddress,
	getBrc20TransferableInscriptionUtxoByAddress,
	getBtcUtxoByAddress,
	getFeeRate,
	getInscriptionData,
	getRuneUtxoByAddress,
	pushBTCpmt,
	pushRawTx,
} from "../service/service";
import {
	testVersion,
	testFeeRate,
	STANDARD_RUNE_UTXO_VALUE,
	SEND_UTXO_FEE_LIMIT,
	privateKey,
	lockTime,
	userSendBrc20Fee,
} from "../config/config";
import * as ecc from "tiny-secp256k1";
import ECPairFactory from "ecpair";
import { LocalWallet } from "../service/localWallet";
import Brc20PoolInfoModal from "../model/Brc20PoolInfo";
import { updatePoolLockStatus } from "../utils/util";
import RunePoolInfoModal from "../model/RunePoolInfo";
import { getBrc20PullInfo } from "./poolController";
import Brc20TransactionInfoModal from "../model/Brc20TransactionInfo";
import { io } from "../server";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

const poolWallet = new LocalWallet(privateKey as string, testVersion ? 1 : 0);

export const generateUserBuyRunePsbt = async (
	userPubkey: string,
	userAddress: string,
	userBuyRuneAmount: number,
	userSendBtcAmount: number,
	poolAddress: string,
	poolPubkey: string
) => {
	console.log("poolAddress :>> ", poolAddress);

	const runeBlockNumber = 2866933;
	const runeTxout = 192;
	const divisibility = 0;
	const requiredAmount = userBuyRuneAmount * 10 ** divisibility;

	// Fetch UTXOs
	const userBtcUtxos = await getBtcUtxoByAddress(userAddress);
	const poolRuneUtxos = await getRuneUtxoByAddress(poolAddress, `${runeBlockNumber}:${runeTxout}`);

	// Prepare PSBT and initialize values
	const psbt = new bitcoin.Psbt({ network });
	const edicts: any = [];
	const userInputArray: number[] = [];
	const poolInputArray: number[] = [];
	let cnt = 0;
	let tokenSum = 0;
	const txList = [];
	const usedTxList = [];

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
			// sighashType: bitcoin.Transaction.SIGHASH_ALL
		});

		poolInputArray.push(cnt++);
		tokenSum += runeutxo.amount;
		txList.push(runeutxo.txid);
	}

	// Add any missing rune UTXOs from transaction history
	// const filterTxInfo = await filterTransactionInfo(poolAddress, txList);
	// for (const runeutxo of filterTxInfo) {
	//     if (tokenSum >= requiredAmount) break;

	//     psbt.addInput({
	//         hash: runeutxo.txId,
	//         index: runeutxo.vout,
	//         witnessUtxo: {
	//             value: runeutxo.runeAmount,
	//             script: pubkeyBuffer,
	//         },
	//         tapInternalKey: pubkeyBuffer.slice(1, 33),
	//         sighashType: bitcoin.Transaction.SIGHASH_ALL
	//     });

	//     poolInputArray.push(cnt++);
	//     tokenSum += runeutxo.runeAmount;
	//     usedTxList.push(runeutxo.txId);
	// }

	// Check if enough rune is gathered
	if (tokenSum < requiredAmount) {
		return {
			success: false,
			message: "Insufficient Rune balance",
			payload: undefined,
		};
	}

	// Add edicts for Rune outputs
	const runeId = new RuneId(runeBlockNumber, runeTxout);

	edicts.push({
		id: runeId,
		amount: requiredAmount,
		output: 1,
	});

	edicts.push({
		id: runeId,
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
		value: userSendBtcAmount * 10 ** 8,
	});

	// Calculate transaction fee
	const feeRate = testVersion ? testFeeRate : await getFeeRate();

	// Add BTC UTXOs for covering fees
	let totalBtcAmount = 0;
	for (const btcutxo of userBtcUtxos) {
		const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount * 10 ** 8;
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
				// sighashType: 131
				// sighashType: bitcoin.Transaction.SIGHASH_ALL
			});

			userInputArray.push(cnt++);
		}
	}

	const fee = calculateTxFee(psbt, feeRate) + userSendBtcAmount * 10 ** 8;

	// Check if enough BTC balance is available
	if (totalBtcAmount < fee) {
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
			// usedTxList,
			runeAmount: tokenSum - requiredAmount,
		},
	};
};

export const pushSwapPsbt = async (
	psbt: string,
	userSignedHexedPsbt: string,
	userInputArray: Array<number>,
	poolInputArray: Array<number>
) => {
	const userSignedPsbt = bitcoin.Psbt.fromHex(userSignedHexedPsbt);

	userInputArray.forEach((input: number) => userSignedPsbt.finalizeInput(input));

	console.log("poolInputArray :>> ", poolInputArray);

	const poolSignedPsbt = await poolWallet.signPsbt(userSignedPsbt, poolInputArray);

	// poolInputArray.forEach((input: number) => poolSignedPsbt.finalizeInput(input));

	console.log("dfdfd1");

	const txId = await combinePsbt(psbt, userSignedPsbt.toHex(), poolSignedPsbt.toHex());

	return txId;
};

// export const setTime = async () => {
//     const flag = true;
//     setTimeout(() => {
//         if (flag) {
//             flag = false
//         }
//     }, 15000);
// }

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
	const requiredAmount = Math.floor(userSendBtcAmount * 10 ** 8);

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

		console.log(
			"poolAddress, feeRate, ticker, userBuyBrc20Amount :>> ",
			poolAddress,
			feeRate,
			ticker,
			userBuyBrc20Amount
		);

		const orderInscriptionInfo = await createOrderBrc20Transfer(
			poolAddress,
			feeRate,
			ticker,
			userBuyBrc20Amount
		);

		console.log("orderInscriptionInfo :>> ", orderInscriptionInfo);

		const payAddress = orderInscriptionInfo.payAddress;
		const inscriptionPayAmount = orderInscriptionInfo.amount;

		console.log("inscriptionPayAmount :>> ", inscriptionPayAmount);
		psbt.addOutput({
			address: payAddress,
			value: inscriptionPayAmount,
		});

		psbt.addOutput({
			address: poolAddress,
			value: requiredAmount,
		});

		psbt.addOutput({
			address: poolAddress,
			value: userSendBrc20Fee,
		});

		// add btc utxo input
		let totalBtcAmount = 0;

		for (const btcutxo of userBtcUtxos) {
			const fee =
				calculateTxFee(psbt, feeRate) + inscriptionPayAmount + requiredAmount + userSendBrc20Fee;
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
			calculateTxFee(psbt, feeRate) + inscriptionPayAmount + requiredAmount + userSendBrc20Fee;

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
		value: requiredAmount,
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
	userSignedHexedPsbt: string,
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

	const userTxId = "await pushRawTx(userTxHex)";

	if (userTxId) {
		console.log("userTxId :>> ", userTxId);
		await delay(10000);

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

		console.log("inscriptionData :>> ", inscriptionData);

		psbt.addInput({
			hash: inscriptionData.txid,
			index: inscriptionData.vout,
			witnessUtxo: {
				value: inscriptionData.satoshi,
				script: Buffer.from(inscriptionData.scriptPk, "hex"),
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

		console.log("psbt :>> ", psbt);

		const poolSignedPsbt = await poolWallet.signPsbt(psbt);
		const poolTx = poolSignedPsbt.extractTransaction();
		const poolTxHex = poolTx.toHex();
		const poolTxId = await pushRawTx(poolTxHex);

		// db features
		if (poolTxId) {
			let updatedPoolInfo: any;

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
				txId: poolTxId,
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
				payload: poolTxId,
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
		await Brc20PoolInfoModal.findOneAndUpdate(
			{ address: poolAddress },
			{ $set: { isLocked: false } }
		);

		return {
			success: false,
			message: `User ${userAddress} not paid for Brc20 transfer`,
			payload: undefined,
		};
	}
};
