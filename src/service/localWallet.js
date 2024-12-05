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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIFWallet = exports.LocalWallet = exports.toXOnly = void 0;
exports.tweakSigner = tweakSigner;
exports.toPsbtNetwork = toPsbtNetwork;
exports.publicKeyToPayment = publicKeyToPayment;
exports.publicKeyToAddress = publicKeyToAddress;
exports.publicKeyToScriptPk = publicKeyToScriptPk;
exports.randomWIF = randomWIF;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bip371_js_1 = require("bitcoinjs-lib/src/psbt/bip371.js");
const secp256k1_1 = __importDefault(require("@bitcoinerlab/secp256k1"));
bitcoin.initEccLib(secp256k1_1.default);
const ecpair_1 = require("ecpair");
const ECPair = (0, ecpair_1.ECPairFactory)(secp256k1_1.default);
const toXOnly = (pubKey) => (pubKey.length == 32 ? pubKey : pubKey.slice(1, 33));
exports.toXOnly = toXOnly;
function tapTweakHash(pubKey, h) {
    return bitcoin.crypto.taggedHash("TapTweak", Buffer.concat(h ? [pubKey, h] : [pubKey]));
}
function tweakSigner(signer, opts) {
    if (opts == null)
        opts = {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let privateKey = signer.privateKey;
    if (!privateKey) {
        throw new Error("Private key is required for tweaking signer!");
    }
    if (signer.publicKey[0] == 3) {
        privateKey = secp256k1_1.default.privateNegate(privateKey);
    }
    const tweakedPrivateKey = secp256k1_1.default.privateAdd(privateKey, new Uint8Array(tapTweakHash((0, exports.toXOnly)(signer.publicKey), opts.tweakHash)));
    if (!tweakedPrivateKey) {
        throw new Error("Invalid tweaked private key!");
    }
    return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
        network: opts.network,
    });
}
function toPsbtNetwork(networkType) {
    if (networkType == 0) {
        return bitcoin.networks.bitcoin;
    }
    else {
        return bitcoin.networks.testnet;
    }
}
function publicKeyToPayment(publicKey, type, networkType) {
    const network = toPsbtNetwork(networkType);
    if (!publicKey)
        return null;
    const pubkey = Buffer.from(publicKey, "hex");
    if (type == 0) {
        return bitcoin.payments.p2pkh({
            pubkey,
            network,
        });
    }
    else if (type == 1 || type == 4) {
        return bitcoin.payments.p2wpkh({
            pubkey,
            network,
        });
    }
    else if (type == 2 || type == 5) {
        return bitcoin.payments.p2tr({
            internalPubkey: pubkey.slice(1, 33),
            network,
        });
    }
    else if (type == 3) {
        const data = bitcoin.payments.p2wpkh({
            pubkey,
            network,
        });
        return bitcoin.payments.p2sh({
            pubkey,
            network,
            redeem: data,
        });
    }
}
function publicKeyToAddress(publicKey, type, networkType) {
    const payment = publicKeyToPayment(publicKey, type, networkType);
    if (payment && payment.address) {
        return payment.address;
    }
    else {
        return "";
    }
}
function publicKeyToScriptPk(publicKey, type, networkType) {
    var _a;
    const payment = publicKeyToPayment(publicKey, type, networkType);
    return (_a = payment === null || payment === void 0 ? void 0 : payment.output) === null || _a === void 0 ? void 0 : _a.toString("hex");
}
function randomWIF(networkType = 1) {
    const network = toPsbtNetwork(networkType);
    const keyPair = ECPair.makeRandom({ network });
    return keyPair.toWIF();
}
class LocalWallet {
    constructor(wif, networkType = 1, addressType = 2) {
        if (typeof wif !== "string") {
            throw new Error("WIF must be a string");
        }
        const network = toPsbtNetwork(networkType);
        const keyPair = ECPair.fromWIF(wif, network);
        this.keyPair = keyPair;
        this.pubkey = keyPair.publicKey.toString("hex");
        this.address = publicKeyToAddress(this.pubkey, addressType, networkType);
        this.network = network;
    }
    signPsbt(psbt, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const _opts = opts || {
                autoFinalized: true,
            };
            const psbtNetwork = this.network;
            const toSignInputs = [];
            psbt.data.inputs.forEach((v, index) => {
                let script = null;
                let value = 0;
                if (v.witnessUtxo) {
                    script = v.witnessUtxo.script;
                    value = v.witnessUtxo.value;
                }
                else if (v.nonWitnessUtxo) {
                    const tx = bitcoin.Transaction.fromBuffer(v.nonWitnessUtxo);
                    const output = tx.outs[psbt.txInputs[index].index];
                    script = output.script;
                    value = output.value;
                }
                const isSigned = v.finalScriptSig || v.finalScriptWitness;
                if (script && !isSigned) {
                    const address = bitcoin.address.fromOutputScript(script, psbtNetwork);
                    if (this.address == address) {
                        toSignInputs.push({
                            index,
                            publicKey: this.pubkey,
                            sighashTypes: v.sighashType ? [v.sighashType] : undefined,
                        });
                    }
                }
            });
            const _inputs = _opts.inputs || toSignInputs;
            if (_inputs.length == 0) {
                throw new Error("no input to sign");
            }
            _inputs.forEach((input) => {
                const keyPair = this.keyPair;
                if ((0, bip371_js_1.isTaprootInput)(psbt.data.inputs[input.index])) {
                    const signer = tweakSigner(keyPair, opts);
                    psbt.signInput(input.index, signer, input.sighashTypes);
                }
                else {
                    const signer = keyPair;
                    psbt.signInput(input.index, signer, input.sighashTypes);
                }
                if (_opts.autoFinalized != false) {
                    // psbt.validateSignaturesOfInput(input.index, validator);
                    psbt.finalizeInput(input.index);
                }
            });
            return psbt;
        });
    }
    getPublicKey() {
        return this.keyPair.publicKey.toString("hex");
    }
}
exports.LocalWallet = LocalWallet;
class WIFWallet {
    constructor(walletParam) {
        var _a;
        if (walletParam.networkType == "testnet") {
            this.network = bitcoin.networks.testnet;
        }
        else {
            this.network = bitcoin.networks.bitcoin;
        }
        this.ecPair = ECPair.fromWIF(walletParam.privateKey, this.network);
        this.secret = (_a = this.ecPair.privateKey) === null || _a === void 0 ? void 0 : _a.toString("hex");
        // Extract the private key in hexadecimal format
        this.secret = this.ecPair.toWIF();
        // Extract the public key in hexadecimal format
        this.pubkey = this.ecPair.publicKey.toString("hex");
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
        for (let i = 0; i < psbt.inputCount; i++) {
            psbt.signInput(i, tweakedChildNode);
            psbt.validateSignaturesOfInput(i, () => true);
            psbt.finalizeInput(i);
        }
        return psbt;
    }
}
exports.WIFWallet = WIFWallet;
