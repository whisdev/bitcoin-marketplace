import { Router } from 'express';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from 'bitcoinjs-lib'

import {
    generateUserBuyRuneSellBtcPsbt,
    generateUserBuyBtcSellRunePsbt,
    generateUserBuyBrc20SellBtcPsbt,
    generateuserBuyBtcSellBrc20Psbt,
    pushRuneSwapPsbt,
    removeSwapTransaction,
    poolTransferBrc20,
    poolReceiveBrc20,
} from '../controller/marketplaceController';

import { getBrc20TransferableInscriptionUtxoByAddress } from '../service/service';

import { getPrice } from '../service/service';


const marketplaceRouter = Router();

marketplaceRouter.use(async (req, res, next) => {
    next();
})

// generate psbt that User buy Rune && send BTC
marketplaceRouter.post('/generateUserBuyRuneSellBtcPsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress } = req.body;

        console.log('req.body :>> ', req.body);
        const payload = await generateUserBuyRuneSellBtcPsbt(userPubkey, userAddress, userBuyRuneAmount, userSendBtcAmount, poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// generate psbt that User buy BTC && send Rune
marketplaceRouter.post('/generateUserBuyBtcSellRunePsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress } = req.body;

        const payload = await generateUserBuyBtcSellRunePsbt(userPubkey, userAddress, userBuyBtcAmount, userSendRuneAmount, poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// Pool sign psbt user buy btc and sell rune and update pool database
marketplaceRouter.post('/poolTransferBrc20', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userReceiveBrc20Amount, userSendBtcAmount, poolAddress } = req.body;

        const payload = await poolTransferBrc20(userPubkey, userAddress, userReceiveBrc20Amount, userSendBtcAmount,  poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

// Pool sign psbt user buy rune and sell btc and update pool database
marketplaceRouter.post('/poolReceiveBrc20', async ( req, res, next) => {
    try {
        const { userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress } = req.body;

        const payload = await poolReceiveBrc20(userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress)

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
})

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post('/generateUserBuyBrc20SellBtcPsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress } = req.body;

        const payload = await generateUserBuyBrc20SellBtcPsbt(userPubkey, userAddress, userBuyBrc20Amount, userSendBtcAmount, poolAddress);

        console.log('payload :>> ', payload);
        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
})

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post('/generateUserBuyBtcSellBrc20Psbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress } = req.body;

        const payload = await generateuserBuyBtcSellBrc20Psbt(userPubkey, userAddress, userSendBrc20Amount, userBuyBtcAmount, poolAddress);

        console.log('payload :>> ', payload);
        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
})

// sign and broadcast tx on Server side
marketplaceRouter.post('/pushPsbt', async (req, res, next) => {
    try {
        const { psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, btcAmount, userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType } = req.body;

        const payload = await pushRuneSwapPsbt(psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, Number(btcAmount), userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

// remove swap transaction
marketplaceRouter.post('/removeSwapTx', async (req, res, next) => {
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
marketplaceRouter.get('/getMempoolBtcPrice', async (req, res, next) => {
    try {
        const payload = await getPrice();

        return res.json(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

export default marketplaceRouter;
