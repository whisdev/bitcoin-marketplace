import * as bitcoin from "bitcoinjs-lib";

import {
	OPENAPI_UNISAT_TOKEN,
	testVersion,
	SIGNATURE_SIZE,
	OPENAPI_UNISAT_URL,
	testFeeRate,
} from "../config/config";
import { IRuneBalance, IRuneUtxo, ITXSTATUS, IUtxo } from "../utils/type";
import axios, { AxiosResponse } from "axios";
import { none, RuneId, Runestone } from "runelib";
import * as bip39 from "bip39";

const ecc = require("@bitcoinerlab/secp256k1");
bitcoin.initEccLib(ecc);

const network = testVersion ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// export const toXOnly = (pubKey: string) => pubKey.length == 32 ? pubKey : pubKey.slice(1, 33);

export function toPsbtNetwork(networkType: number) {
	if (networkType == 0) {
		return bitcoin.networks.bitcoin;
	} else {
		return bitcoin.networks.testnet;
	}
}

export function publicKeyToPayment(publicKey: string, type: number, networkType: any) {
	const network = toPsbtNetwork(networkType);
	if (!publicKey) return null;
	const pubkey = Buffer.from(publicKey, "hex");
	if (type == 0) {
		return bitcoin.payments.p2pkh({
			pubkey,
			network,
		});
	} else if (type == 1 || type == 4) {
		return bitcoin.payments.p2wpkh({
			pubkey,
			network,
		});
	} else if (type == 2 || type == 5) {
		return bitcoin.payments.p2tr({
			internalPubkey: pubkey.slice(1, 33),
			network,
		});
	} else if (type == 3) {
		const data = bitcoin.payments.p2wpkh({
			pubkey,
			network,
		});
		return bitcoin.payments.p2sh({
			pubkey,
			network,
			redeem: data,
		});
	}
}

export function publicKeyToAddress(publicKey: string, type: number, networkType: any) {
	const payment = publicKeyToPayment(publicKey, type, networkType);
	if (payment && payment.address) {
		return payment.address;
	} else {
		return "";
	}
}

export const getInscriptionData = async (address: string, inscriptionId: string) => {
	try {
		const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/inscription-data`;

		const config = {
			headers: {
				Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
			},
		};
		const res = await axios.get(url, { ...config });
		const filterInscription = res.data.data.inscription.find(
			(inscription: any) => inscription.inscriptionId === inscriptionId
		);

		if (!filterInscription) {
			console.log("First Attempt get failed, Try second attempt. ==> ", filterInscription);
			await delay(30000);
			const res2 = await axios.get(url, { ...config });
			const filterInscription2 = res2.data.data.inscription.find(
				(inscription: any) => inscription.inscriptionId === inscriptionId
			);
			if (!filterInscription2) {
				console.log("Second Attempt get failed, Try third attempt. ==>", filterInscription2);
				await delay(30000);
				const res3 = await axios.get(url, { ...config });
				const filterInscriptio3 = res3.data.data.inscription.find(
					(inscription: any) => inscription.inscriptionId === inscriptionId
				);
				if (!filterInscriptio3) {
					console.log("Third Attempt get failed, Try fourth attempt. ==>", filterInscriptio3);
					await delay(40000);
					const res4 = await axios.get(url, { ...config });
					const filterInscriptio4 = res4.data.data.inscription.find(
						(inscription: any) => inscription.inscriptionId === inscriptionId
					);
					return filterInscriptio4.utxo;
				}
				return filterInscriptio3.utxo;
			}
			return filterInscription2.utxo;
		}

		return filterInscription.utxo;
	} catch (error: any) {
		console.log(error.data);
		throw new Error("Can not fetch Inscriptions!!");
	}
};

export const createOrderBrc20Transfer = async (
	address: string,
	feeRate: number,
	ticker: string,
	amount: number
) => {
	const url = `${OPENAPI_UNISAT_URL}/v2/inscribe/order/create/brc20-transfer`;

	const res = await axios.post(
		url,
		{
			receiveAddress: address,
			feeRate,
			outputValue: 546,
			devAddress: address,
			devFee: 0,
			brc20Ticker: ticker,
			brc20Amount: amount,
		},
		{
			headers: {
				Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
			},
		}
	);

	return res.data;
};

export const getBrc20TransferableInscriptionUtxoByAddress = async (
	address: string,
	ticker: string
) => {
	const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/${ticker}/transferable-inscriptions`;
	const config = {
		headers: {
			Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
		},
	};

	const inscriptionList: any[] = (await axios.get(url, config)).data.data.detail;

	return inscriptionList;
};

export const getBrc20TickerInfoByAddress = async (address: string, ticker: string) => {
	const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/${ticker}/info`;
	const config = {
		headers: {
			Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
		},
	};

	const tickerInfo: any = (await axios.get(url, config)).data.data;

	return tickerInfo;
};

export const getBrc20SummaryByAddress = async (address: string) => {
	const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/brc20/summary`;
	const config = {
		headers: {
			Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
		},
	};

	const tickerInfo: any = (await axios.get(url, config)).data.data.detail;

	return tickerInfo;
};

export const getBtcUtxoByAddress = async (address: string) => {
	const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/utxo-data`;
	const config = {
		headers: {
			Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
		},
	};
	let cursor = 0;
	const size = 5000;
	const utxos: IUtxo[] = [];
	const res = await axios.get(url, { ...config, params: { cursor, size } });
	if (res.data.code === -1) throw "Invalid Address";
	utxos.push(
		...(res.data.data.utxo as any[]).map((utxo) => {
			return {
				scriptpubkey: utxo.scriptPk,
				txid: utxo.txid,
				value: utxo.satoshi,
				vout: utxo.vout,
			};
		})
	);
	return utxos;
};

export const getFeeRate = async () => {
	try {
		const url = `https://mempool.space/${testVersion ? "testnet/" : ""}api/v1/fees/recommended`;

		const res = await axios.get(url);

		return res.data.fastestFee;
	} catch (error) {
		console.log("Ordinal api is not working now. Try again later");
		return 40 * 2;
	}
};

export const getPrice = async () => {
	try {
		const url = `https://mempool.space/api/v1/prices`;

		const res = await axios.get(url);

		return res.data.USD;
	} catch (error) {
		console.log("Mempool api is not working now. Try again later");
		return 90000;
	}
};

export const getBtcBalanceByAddress = async (address: string) => {
	try {
		const response = await fetch(`${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/balance`, {
			method: "GET",
			headers: { Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}` },
		});

		const data: any = await response.json();
		return data.data.satoshi;
	} catch (error) {
		console.log("Mempool api is not working now. Try again later");
		return 90000;
	}
};

export const pushRawTx = async (rawTx: string) => {
	const txid = await postData(
		`https://mempool.space/${testVersion ? "testnet/" : ""}api/tx`,
		rawTx
	);
	console.log("pushed txid", txid);
	return txid;
};

const postData = async (url: string, json: any, content_type = "text/plain", apikey = "") => {
	while (1) {
		try {
			const headers: any = {};
			if (content_type) headers["Content-Type"] = content_type;
			if (apikey) headers["X-Api-Key"] = apikey;
			const res = await axios.post(url, json, {
				headers,
			});
			return res.data;
		} catch (err: any) {
			const axiosErr = err;
			console.log("push tx error", axiosErr.response?.data);
			if (
				!(axiosErr.response?.data).includes(
					'sendrawtransaction RPC error: {"code":-26,"message":"too-long-mempool-chain,'
				)
			)
				throw new Error("Got an err when push tx");
		}
	}
};

export const finalizePsbtInput = (hexedPsbt: string, inputs: number[]) => {
	const psbt = bitcoin.Psbt.fromHex(hexedPsbt);

	inputs.forEach((input) => psbt.finalizeInput(input));
	return psbt.toHex();
};

// Calc Tx Fee
export const calculateTxFee = (psbt: bitcoin.Psbt, feeRate: number) => {
	const tx = new bitcoin.Transaction();

	for (let i = 0; i < psbt.txInputs.length; i++) {
		const txInput = psbt.txInputs[i];
		tx.addInput(txInput.hash, txInput.index, txInput.sequence);
		tx.setWitness(i, [Buffer.alloc(SIGNATURE_SIZE)]);
	}

	for (let txOutput of psbt.txOutputs) {
		tx.addOutput(txOutput.script, txOutput.value);
	}

	return Math.floor(tx.virtualSize() * feeRate);
};

export const getRuneUtxoByAddress = async (address: string, runeId: string) => {
	const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/runes/${runeId}/utxo`;

	const config = {
		headers: {
			Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
		},
	};
	let cursor = 0;
	let tokenSum = 0;
	const size = 5000;
	const utxos: IRuneUtxo[] = [];
	const res = await axios.get(url, { ...config, params: { cursor, size } });

	if (res.data.code === -1) throw "Invalid Address";
	utxos.push(
		...(res.data.data.utxo as any[]).map((utxo) => {
			tokenSum += Number(utxo.runes[0].amount);
			return {
				scriptpubkey: utxo.scriptPk,
				txid: utxo.txid,
				value: utxo.satoshi,
				vout: utxo.vout,
				amount: Number(utxo.runes[0].amount),
				divisibility: utxo.runes[0].divisibility,
			};
		})
	);
	cursor += res.data.data.utxo.length;
	return { runeUtxos: utxos, tokenSum };
};

// Get rune balance using unisat api
export const getRuneBalanceListByAddress = async (address: string) => {
	try {
		const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/runes/balance-list`;

		const config = {
			headers: {
				Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
			},
		};

		let utxos: IRuneBalance[] = [];

		const res = await axios.get(url, config);

		if (res.data.code === -1) throw "Invalid Address";

		if (res.data.data) {
			utxos.push(
				...(res.data.data.detail as any[]).map((utxo) => {
					return {
						rune: utxo.rune,
						runeid: utxo.runeid,
						spacedRune: utxo.spacedRune,
						amount: utxo.amount,
						symbol: utxo.symbol,
						divisibility: utxo.divisibility,
					};
				})
			);
		}
		return utxos;
	} catch (err) {
		console.log(err);
	}
};

export const combinePsbt = async (
	hexedPsbt: string,
	signedHexedPsbt1: string,
	signedHexedPsbt2?: string
) => {
	try {
		const psbt = bitcoin.Psbt.fromHex(hexedPsbt);
		const signedPsbt1 = bitcoin.Psbt.fromHex(signedHexedPsbt1);
		if (signedHexedPsbt2) {
			const signedPsbt2 = bitcoin.Psbt.fromHex(signedHexedPsbt2);
			psbt.combine(signedPsbt1, signedPsbt2);
		} else {
			psbt.combine(signedPsbt1);
		}

		const tx = psbt.extractTransaction();
		const txHex = tx.toHex();

		const txId = await pushRawTx(txHex);
		return txId;
	} catch (error) {
		console.log(error);
		throw error;
	}
};

export const pushBTCpmt = async (rawtx: any) => {
	// delay 250 ms to prevent transaction push limit
	delay(250);

	const txid = await postData(
		`https://mempool.space/${testVersion ? "testnet/" : ""}api/tx`,
		rawtx
	);

	return txid;
};

export const generateUserInscribeBrc20Psbt = async (
	address: string,
	publickey: string,
	inscribeAmount: number,
	ticker: string,
	utxos: IUtxo[]
) => {
	const psbt = new bitcoin.Psbt({ network });
	const feeRate = testVersion ? testFeeRate : await getFeeRate();

	const brc20TickerInfo = await getBrc20TickerInfoByAddress(address, ticker);

	if (brc20TickerInfo.availableBalance < inscribeAmount)
		throw `No sufficient available BRC20 amount`;

	const orderInscriptionInfo = await createOrderBrc20Transfer(
		address,
		feeRate,
		ticker,
		inscribeAmount
	);

	const payAddress = orderInscriptionInfo.payAddress;
	const inscriptionPayAmount = orderInscriptionInfo.amount;

	psbt.addOutput({
		address: payAddress,
		value: inscriptionPayAmount,
	});

	// add btc utxo input
	let totalBtcAmount = 0;

	for (const btcutxo of utxos) {
		const fee = calculateTxFee(psbt, feeRate) + inscriptionPayAmount;
		if (totalBtcAmount < fee && btcutxo.value > 10000) {
			totalBtcAmount += btcutxo.value;

			psbt.addInput({
				hash: btcutxo.txid,
				index: btcutxo.vout,
				witnessUtxo: {
					value: btcutxo.value,
					script: Buffer.from(btcutxo.scriptpubkey as string, "hex"),
				},
				tapInternalKey: Buffer.from(publickey, "hex").slice(1, 33),
			});
		}
	}

	const fee = calculateTxFee(psbt, feeRate) + inscriptionPayAmount;

	if (totalBtcAmount < fee) throw `BTC balance in User of ${address} is not enough`;

	psbt.addOutput({
		address: address,
		value: totalBtcAmount - fee,
	});

	return psbt.toHex();
};
