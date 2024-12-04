"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedWallet = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bip39 = __importStar(require("bip39"));
const bip32_1 = __importDefault(require("bip32"));
const ecpair_1 = __importDefault(require("ecpair"));
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const secp256k1_1 = __importDefault(require("@bitcoinerlab/secp256k1"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
(0, bitcoinjs_lib_1.initEccLib)(secp256k1_1.default);
const ECPair = (0, ecpair_1.default)(secp256k1_1.default);
const bip32 = (0, bip32_1.default)(secp256k1_1.default);
class SeedWallet {
    constructor(walletParam) {
        if (walletParam.networkType == "mainnet") {
            this.network = bitcoinjs_lib_1.networks.bitcoin;
        }
        else {
            this.network = bitcoinjs_lib_1.networks.testnet;
        }
        const mnemonic = walletParam.seed;
        let hdPath = `m/86'/0'/0'/0/${walletParam.index}`;
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error("invalid mnemonic");
        }
        this.bip32 = bip32.fromSeed(bip39.mnemonicToSeedSync(mnemonic), this.network);
        this.ecPair = ECPair.fromPrivateKey(this.bip32.derivePath(hdPath).privateKey, {
            network: this.network,
        });
        const { address, output } = bitcoin.payments.p2tr({
            internalPubkey: this.ecPair.publicKey.subarray(1, 33),
            network: this.network,
        });
        this.address = address;
        this.output = output;
        this.publicKey = this.ecPair.publicKey.toString("hex");
    }
    signPsbt(psbt, ecPair) {
        const tweakedChildNode = ecPair.tweak(bitcoin.crypto.taggedHash("TapTweak", ecPair.publicKey.subarray(1, 33)));
        // Set Global Variable for network type
        // app.locals.networkType = SEED;
        for (let i = 0; i < psbt.inputCount; i++) {
            psbt.signInput(i, tweakedChildNode);
            psbt.validateSignaturesOfInput(i, () => true);
            psbt.finalizeInput(i);
        }
        return psbt;
    }
}
exports.SeedWallet = SeedWallet;
