import { Router } from "express";

import { getUserRuneInfo, getWalletBalance } from "../controller/userController";
import { getHistorySocket } from "../utils/util";

const userRouter = Router();

userRouter.use(async (req, res, next) => {
	next();
});

// get all pool info
userRouter.post("/getUserRuneInfo", async (req, res, next) => {
	try {
		const { userAddress } = req.body;
		const payload = await getUserRuneInfo(userAddress);

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

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
