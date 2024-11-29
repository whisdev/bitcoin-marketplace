import { Router } from "express";

import { getPullInfo, getBrc20PullInfo, getRunePullInfo } from "../controller/poolController";

const poolRouter = Router();

poolRouter.use(async (req, res, next) => {
	console.log("");
	next();
});

// get all pool info
poolRouter.get("/getPoolInfo", async (req, res, next) => {
	try {
		const payload = await getPullInfo();

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// get rune pool info
poolRouter.get("/getRunePoolInfo", async (req, res, next) => {
	try {
		const payload = await getRunePullInfo();

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

// get brc20 pool info
poolRouter.get("/getBrc20PoolInfo", async (req, res, next) => {
	try {
		const payload = await getBrc20PullInfo();

		return res.status(200).send(payload);
	} catch (error) {
		console.log(error);
		return res.status(404).send(error);
	}
});

export default poolRouter;
