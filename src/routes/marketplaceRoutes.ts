import { Router } from 'express';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from 'bitcoinjs-lib'

import { pushRawTx, finalizePsbtInput, combinePsbt } from '../service/service';
import {
    generateUserBuyRunePsbt,
    generateUserBuyBTCPsbt,
    pushSwapPsbt,
} from '../controller/marketplaceController';
import { testVersion } from "../config/config";
import { LocalWallet } from "../service/localWallet";

const privateKey1: string = process.env.WIF_KEY1 as string;
const privateKey2: string = process.env.WIF_KEY2 as string;

export const adminWallet1 = new LocalWallet(privateKey1 as string, testVersion ? 1 : 0);
export const adminWallet2 = new LocalWallet(privateKey2 as string, testVersion ? 1 : 0);

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
marketplaceRouter.post('/generateUserBuyRunePsbt', async (req, res, next) => {
    try {
        const { userPubkey, userAddress, userBuyBtcAmount, userSendingRuneAmount, poolAddress } = req.body;

        const payload = await generateUserBuyBTCPsbt(userPubkey, userAddress, userBuyBtcAmount, userSendingRuneAmount, poolAddress);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// sign and broadcast tx on Server side
marketplaceRouter.post('/pushPsbt', async (req, res, next) => {
    try {
        const { psbt, userSignedHexedPsbt, amount, userInputArray, poolInputArray, adminAddress, usedTransactionList } = req.body;

        const payload = await pushSwapPsbt(psbt, userSignedHexedPsbt, userInputArray, poolInputArray, adminAddress, amount, usedTransactionList);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

marketplaceRouter.post('/cancelPushPsbt', async (req, res, next) => {
    try {
        const { adminAddress } = req.body;

        // const payload = await updateTxBuildingModal(adminAddress);

        // return res.status(200).send(payload);
        return res.status(200).send("");
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
});

export default marketplaceRouter;
