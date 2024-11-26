import { Router } from 'express';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import * as bitcoin from 'bitcoinjs-lib'

import {
    generateUserBuyRuneSellBtcPsbt,
    generateUserBuyBtcSellRunePsbt,
    generateUserBuyBrc20SellBtcPsbt,
    generateuserBuyBtcSellBrc20Psbt,
    pushSwapPsbt,
    removeSwapTransaction,
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

// generate psbt taht User buy Brc20 && send BTC
marketplaceRouter.post('/generateUserBuyBrc20SellBtcPsbt', async (req, res, next) => {
    try {
        const { address, ticker, amount } = req.body;

        const inscriptionList = await getBrc20TransferableInscriptionUtxoByAddress(address, ticker);

        console.log('inscriptionList :>> ', inscriptionList);

        const existedInscription = inscriptionList.find(inscription => inscription.data.tick.toUpperCase() == ticker.toUpperCase() && inscription.data.amt == amount)

        let payload;
        if (!existedInscription) {
            // payload = await generateUserBuyBrc20Psbt(address, ticker, amount, existedInscription);
        }

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

        const payload = await pushSwapPsbt(psbt, userSignedHexedPsbt, poolRuneAmount, userRuneAmount, Number(btcAmount), userInputArray, poolInputArray, userAddress, poolAddress, usedTransactionList, swapType);

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
