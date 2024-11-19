import { Router } from 'express';
import * as bitcoin from 'bitcoinjs-lib'
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341';

import { pushRawTx, finalizePsbtInput, combinePsbt, getDummyFee, pushBTCpmt, generateSeed } from '../service/service';
import { networkType, redeemAddress, SPLIT_ADDRESS_SIZE, testVersion, userRuneId } from "../config/config";
import { LocalWallet } from "../service/localWallet";
import { generateUserBuyRunePsbt, pushSwapPsbt } from '../controller/testController';
import { ITreeItem } from '../utils/type';

const privateKey1: string = process.env.WIF_KEY1 as string;
const privateKey2: string = process.env.WIF_KEY2 as string;

export const adminWallet1 = new LocalWallet(privateKey1 as string, testVersion ? 1 : 0);
export const adminWallet2 = new LocalWallet(privateKey2 as string, testVersion ? 1 : 0);

const testRouter = Router();

testRouter.use(async (req, res, next) => {
    console.log('');
    console.log(`Request received for ${req.method} ${req.url}`);
    next();
})

testRouter.get('/test', async (req, res, next) => {
    try {
        res.status(200).send("test successfully");
    } catch (error) {
        res.status(404).send(error);
    }
})

testRouter.post('/getFee', async (req, res, next) => {
    try {
        const { amount } = req.body;

        const fee = await getDummyFee(amount);

        return res.status(200).send({ fee: fee });
    } catch (error) {

    }
})

testRouter.post('/generateSeed', async (req, res, next) => {
    try {
        const newSeed = await generateSeed();

        res.status(200).send(newSeed);
    } catch (error) {

    }
})

testRouter.post('/combinePsbt', async (req, res, next) => {
    try {
        const { hexedPsbt, signedHexedPsbt1, signedHexedPsbt2 } = req.body

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
        return res.status(200).send(txId);
    } catch (error) {
        return res.status(404).send(error);
    }
})

// generate psbt that User buy BTC && send Rune
testRouter.post('/pushSwapPsbt', async (req, res, next) => {
    try {
        // const { userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress } = req.body;
        const psbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000ffffffffeddb1b6c8e779a151b0eb1e9bf9383006afc6e8af9ec69ee60298677bb007e010100000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a62202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7e007b60200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2014ce0200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6011720df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763000000000000"
        // const psbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000fffffffff177002a60438a63ff0a40ea1078a913ee37861e7e81bc5f974530b27290fa510000000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc72202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7c0d4dd0500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b00e1f50500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e000000000000"
        const userSignedHexedPsbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000ffffffffeddb1b6c8e779a151b0eb1e9bf9383006afc6e8af9ec69ee60298677bb007e010100000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a62202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7e007b60200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a6000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2014ce0200000000225120531d53643cd23f71ad7a56fc19415936d9bcc08bdc378a8b193ac9b2e7e921a601134048c4aa847e00a9f8560688831562f15c325c973119866e2585d3c93b942410e3228d730f9eb206398aed6031635d022fc529b1d4cdf954965553ce6bf2ba8279011720df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763000000000000"
        // const userSignedHexedPsbt = "70736274ff0100fd4a0102000000037dc5b3eb38d884c9f07446ec02be2e0a32e783a8cec13cb9f44b1a5b16f4c3170400000000ffffffffc14dcf1a96fb46ce3b30ac1a4648edfb0bcd6a44ca7f8b2faedd0ee14c500b2f0100000000fffffffff177002a60438a63ff0a40ea1078a913ee37861e7e81bc5f974530b27290fa510000000000ffffffff050000000000000000106a5d0d00f5fdae01c0010a01000000022202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc72202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc740420f0000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7c0d4dd0500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7000000000001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b2202000000000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc701030401000000011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e0001012b00e1f50500000000225120779ab028afdda408e811232975422e178b6568ba1256d7e1702347c748d65fc7011340e3e203b37e1798cd7022221ef5e709d4722762c620f4f0ab0d2efd1a6a611a90106ddb722346b66d78065e5e38b680b7297b2cf289619c71da92e844830f3539011720c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e000000000000"
        const userInputArray = [2];
        const poolInputArray = [0, 1];
        const userPubkey = "03df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763";
        const userAddress = "tb1p2vw4xepu6glhrtt62m7pjs2exmvmesytmsmc4zce8tym9elfyxnq6506a5";
        const userBuyRuneAmount = 10;
        const userSendingBtcAmount = 0.01;
        const poolAddress = "tb1pw7dtq290mkjq36q3yv5h2s3wz79k2696zftd0ctsydruwjxktlrs8x8cmh";
        const poolPubkey = "02c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e"

        const payload = await pushSwapPsbt(psbt, userSignedHexedPsbt, userInputArray, poolInputArray);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

// generate psbt that User buy BTC && send Rune
testRouter.post('/generateUserBuyRunePsbt', async (req, res, next) => {
    try {
        // const { userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress } = req.body;

        const userPubkey = "03df2729c89fb4d69592abc692ce8d900df7704b73bfe597a9b5ec89159266c763";
        const userAddress = "tb1p2vw4xepu6glhrtt62m7pjs2exmvmesytmsmc4zce8tym9elfyxnq6506a5";
        const userBuyRuneAmount = 10;
        const userSendingBtcAmount = 0.01;
        const poolAddress = "tb1pw7dtq290mkjq36q3yv5h2s3wz79k2696zftd0ctsydruwjxktlrs8x8cmh";
        const poolPubkey = "02c60809fa6be1eca0feae1c5546dbcc795c46e63d64cc629646e02cead7e5db3e"

        const payload = await generateUserBuyRunePsbt(userPubkey, userAddress, userBuyRuneAmount, userSendingBtcAmount, poolAddress, poolPubkey);

        return res.status(200).send(payload)
    } catch (error) {
        console.log(error);
        return res.status(404).send(error)
    }
});

export default testRouter;
