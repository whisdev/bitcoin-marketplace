"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controller/userController");
const util_1 = require("../utils/util");
const userRouter = (0, express_1.Router)();
userRouter.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    next();
}));
// get all pool info
userRouter.post("/getUserRuneInfo", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userAddress } = req.body;
        const payload = yield (0, userController_1.getUserRuneInfo)(userAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// get all user rune info
userRouter.post("/getUserBrc20Info", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userAddress } = req.body;
        const payload = yield (0, userController_1.getUserBrc20Info)(userAddress);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// get user wallet btc ballance
userRouter.post("/getWalletBalance", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { user_address } = req.body;
        const payload = yield (0, userController_1.getWalletBalance)(user_address);
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
// get all history info
userRouter.get("/getAllHistoryInfo", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = yield (0, util_1.getHistorySocket)();
        return res.status(200).send(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(404).send(error);
    }
}));
exports.default = userRouter;
