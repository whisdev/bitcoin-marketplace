import { Router } from "express";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from "bitcoinjs-lib";

import {
	generateUserBuyRuneSellBtcPsbt,
	generateUserBuyBtcSellRunePsbt,
	generateUserBuyBrc20SellBtcPsbt,
	generateUserBuyBtcSellBrc20Psbt,
	generateUserBuyBtcSendBrc20Psbt,
	pushRuneSwapPsbt,
	removeSwapTransaction,
	poolTransferBrc20,
	pushBrc20SwapPsbt,
	// generateUserInscribeBrc20Psbt,
} from "../controller/marketplaceController";

import { getBrc20TransferableInscriptionUtxoByAddress } from "../service/service";

import { getPrice } from "../service/service";

const marketplaceRouter = Router();

marketplaceRouter.use(async (req, res, next) => {
	next();
});

// generate psbt that User buy Rune && send BTC
marketplaceRouter.post("/generateUserBuyRuneSellBtcPsbt", async (req, res, next) => {
	try {
		const { userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress } = req.body;

		console.log("req.body :>> ", req.body);
		const payload = await generateUserBuyRuneSellBtcPsbt(
			userPubkey,
			userAddress,
			userBuyRuneAmount,
			userSendBtcAmount,
			poolAddress
		);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// generate psbt that User buy BTC && send Rune
marketplaceRouter.post("/generateUserBuyBtcSellRunePsbt", async (req, res, next) => {
	try {
		const { userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress } = req.body;

		const payload = await generateUserBuyBtcSellRunePsbt(
			userPubkey,
			userAddress,
			userBuyBtcAmount,
			userSendRuneAmount,
			poolAddress
		);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// Pool sign psbt user buy btc and sell rune and update pool database
marketplaceRouter.post("/poolTransferBrc20", async (req, res, next) => {
	try {
		const {
			userSignedPsbt,
			userPubkey,
			userAddress,
			userBuyBrc20Amount,
			userSendBtcAmount,
			poolAddress,
		} = req.body;

		console.log('poolTransferBrc20 req.body :>> ', req.body);

		const payload = await poolTransferBrc20(
			userSignedPsbt,
			userPubkey,
			userAddress,
			userBuyBrc20Amount,
			userSendBtcAmount,
			poolAddress
		);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBrc20SellBtcPsbt", async (req, res, next) => {
	try {
		const { userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress } =
			req.body;

		const payload = await generateUserBuyBrc20SellBtcPsbt(
			userPubkey,
			userAddress,
			userBuyBrc20Amount,
			userSendBtcAmount,
			poolAddress
		);

		console.log("payload :>> ", payload);
		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// Pool sign psbt user buy rune and sell btc and update pool database
marketplaceRouter.post("/pushBrc20SwapPsbt", async (req, res, next) => {
	try {
		const {
			psbt,
			userSignedHexedPsbt,
			userAddress,
			poolAddress,
			brc20Amount,
			btcAmount,
			poolInputArray,
			userInputArray,
			swapType,
		} = req.body;

		console.log('pushBrc20SwapPsbt req.body :>> ', req.body);

		const payload = await pushBrc20SwapPsbt(
			psbt,
			userSignedHexedPsbt,
			userAddress,
			poolAddress,
			brc20Amount,
			btcAmount,
			poolInputArray,
			userInputArray,
			swapType
		);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBtcSellBrc20Psbt", async (req, res, next) => {
	try {
		const { userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress } =
			req.body;

		const payload = await generateUserBuyBtcSellBrc20Psbt(
			userAddress,
			userPubkey,
			userSendBrc20Amount,
			userBuyBtcAmount,
			poolAddress
		);

		console.log("payload :>> ", payload);
		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post("/generateUserBuyBtcSendBrc20Psbt", async (req, res, next) => {
	try {
		const {
			userSignedHexedPsbt,
			userPubkey,
			userAddress,
			userSendBrc20Amount,
			userBuyBtcAmount,
			poolAddress,
		} = req.body;

		const payload = await generateUserBuyBtcSendBrc20Psbt(
			userSignedHexedPsbt,
			userAddress,
			userPubkey,
			userSendBrc20Amount,
			userBuyBtcAmount,
			poolAddress
		);

		console.log("payload :>> ", payload);
		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// sign and broadcast tx on Server side
marketplaceRouter.post("/pushRuneSwapPsbt", async (req, res, next) => {
	try {
		const {
			psbt,
			userSignedHexedPsbt,
			poolRuneAmount,
			userRuneAmount,
			btcAmount,
			userInputArray,
			poolInputArray,
			userAddress,
			poolAddress,
			usedTransactionList,
			swapType,
			usingTxInfo,
			scriptpubkey,
		} = req.body;

		console.log("req.body :>> ", req.body);

		const payload = await pushRuneSwapPsbt(
			psbt,
			userSignedHexedPsbt,
			poolRuneAmount,
			userRuneAmount,
			Number(btcAmount),
			userInputArray,
			poolInputArray,
			userAddress,
			poolAddress,
			usedTransactionList,
			swapType,
			usingTxInfo,
			scriptpubkey
		);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// remove swap transaction
marketplaceRouter.post("/removeSwapTx", async (req, res, next) => {
	try {
		const { poolAddress, userAddress, tokenType } = req.body;

		const payload = await removeSwapTransaction(poolAddress, userAddress, tokenType);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// remove swap transaction
marketplaceRouter.get("/getMempoolBtcPrice", async (req, res, next) => {
	try {
		const payload = await getPrice();

		return res.json(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

export default marketplaceRouter;
