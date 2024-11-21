import { Router } from 'express';

import { getUserRuneInfo } from '../controller/userController';
import { getHistorySocket } from '../utils/util';

const userRouter = Router();

userRouter.use(async (req, res, next) => {
    console.log('');
    console.log(`Request received for ${req.method} ${req.url}`);
    next();
})

// get all pool info
userRouter.post('/getUserRuneInfo', async (req, res, next) => {
    try {
        const { userAddress } = req.body;
        const payload = await getUserRuneInfo(userAddress);

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
})

// get all history info
userRouter.get('/getAllHistoryInfo', async (req, res, next) => {
    try {
        const payload = await getHistorySocket();

        return res.status(200).send(payload);
    } catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
})

export default userRouter;
