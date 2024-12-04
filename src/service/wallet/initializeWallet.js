"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const secp256k1_1 = __importDefault(require("@bitcoinerlab/secp256k1"));
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const SeedWallet_1 = require("./SeedWallet");
(0, bitcoinjs_lib_1.initEccLib)(secp256k1_1.default);
const initializeWallet = (networkType, seed, index) => {
    const wallet = new SeedWallet_1.SeedWallet({
        networkType: networkType,
        seed: seed,
        index: index,
    });
    return wallet;
};
exports.default = initializeWallet;
