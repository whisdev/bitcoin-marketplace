import { Router } from "express";

<<<<<<< HEAD
import { getUserBrc20Info, getUserRuneInfo, getWalletBalance } from '../controller/userController';
import { getHistorySocket } from '../utils/util';
=======
import { getUserRuneInfo, getWalletBalance } from "../controller/userController";
import { getHistorySocket } from "../utils/util";
>>>>>>> 195a6b62bdc3b87c62cd9d71d866032871e2a09d

const userRouter = Router();

userRouter.use(async (req, res, next) => {
	next();
});

<<<<<<< HEAD
// get all user rune info
userRouter.post('/getUserRuneInfo', async (req, res, next) => {
    try {
        const { userAddress } = req.body;
        const payload = await getUserRuneInfo(userAddress);
=======
// get all pool info
userRouter.post("/getUserRuneInfo", async (req, res, next) => {
	try {
		const { userAddress } = req.body;
		const payload = await getUserRuneInfo(userAddress);
>>>>>>> 195a6b62bdc3b87c62cd9d71d866032871e2a09d

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// get all user rune info
userRouter.post('/getUserBrc20Info', async (req, res, next) => {
    try {
        const { userAddress } = req.body;
        const payload = await getUserBrc20Info(userAddress);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
})

// get user wallet btc ballance
userRouter.post("/getWalletBalance", async (req, res, next) => {
	try {
		const { user_address } = req.body;
		const payload = await getWalletBalance(user_address);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// get all history info
userRouter.get("/getAllHistoryInfo", async (req, res, next) => {
	try {
		const payload = await getHistorySocket();

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

export default userRouter;
