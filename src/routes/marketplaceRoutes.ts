import { Router } from 'express';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from 'bitcoinjs-lib'

import {
    generateUserBuyRunePsbt,
    generateUserBuyBtcPsbt,
    pushSwapPsbt,
    removeSwapTransaction,
} from '../controller/marketplaceController';
import { flagList } from '../server';

const marketplaceRouter = Router();

marketplaceRouter.use(async (req, res, next) => {
    console.log('');
    console.log(`Request received for ${req.method} ${req.url}`);
    next();
})

// generate psbt that User buy BTC && send Rune
marketplaceRouter.post('/generateUserBuyRunePsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress } = req.body;

        const payload = await generateUserBuyRunePsbt(userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// generate psbt that User buy Rune && send BTC
marketplaceRouter.post('/generateUserBuyBtcPsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyBtcAmount, userSendingRuneAmount, poolAddress } = req.body;

        const payload = await generateUserBuyBtcPsbt(userPubkey, userAddress, userBuyBtcAmount, userSendingRuneAmount, poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// sign and broadcast tx on Server side
marketplaceRouter.post('/pushPsbt', async (req, res, next) => {
    try {
        const { psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, btcAmount, userInputArray, poolInputArray, poolAddress, usedTransactionList, swapType } = req.body;

        const payload = await pushSwapPsbt(psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, btcAmount, userInputArray, poolInputArray, poolAddress, usedTransactionList, swapType);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

// remove swap transaction
marketplaceRouter.post('/removeSwapTx', async (req, res, next) => {
    try {
        const { poolAddress, userAddress } = req.body;

        const payload = await removeSwapTransaction(poolAddress, userAddress);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

export default marketplaceRouter;
