import dotenv from 'dotenv';
dotenv.config();

export const OPENAPI_UNISAT_TOKEN: string = process.env.OPENAPI_UNISAT_TOKEN as string;
export const privateKey: string = process.env.WIF_KEY as string;
export const nusdPrivKey: string = process.env.NUSDWIF_KEY as string;
export const MongoDBUrl: string = process.env.MONGDB_URL as string;

export const testVersion = true;
export const testFeeRate = 1500;
export const STANDARD_RUNE_UTXO_VALUE = 546;
export const ONE_TIME_AIRDROP_SIZE = 8;
export const SEND_UTXO_FEE_LIMIT = 10000;
export const networkType = testVersion ? "testnet" : "mainnet";

// Api info
export const OPENAPI_UNISAT_URL = testVersion ? "https://open-api-testnet.unisat.io" : "https://open-api.unisat.io";