import { Router } from 'express';

import { getPullInfo } from '../controller/poolController';

const poolRouter = Router();

poolRouter.use(async (req, res, next) => {
    console.log('');
    next();
})

// get all pool info
poolRouter.get('/getPoolInfo', async (req, res, next) => {
    try {
        const payload = await getPullInfo();

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
})

export default poolRouter;
