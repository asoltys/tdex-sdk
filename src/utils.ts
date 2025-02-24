import JSBI from 'jsbi';
import { confidential, Psbt, Transaction } from 'liquidjs-lib';

const HUNDRED = JSBI.BigInt(100);
const TENTHOUSAND = JSBI.multiply(HUNDRED, HUNDRED);

export function toAssetHash(x: Buffer): string {
  const withoutFirstByte = x.slice(1);
  return withoutFirstByte.reverse().toString('hex');
}

export function toNumber(x: Buffer): number {
  return confidential.confidentialValueToSatoshi(x);
}

function minusFee(amount: JSBI, fee: JSBI): Array<JSBI> {
  const calculatedFee = JSBI.multiply(JSBI.divide(amount, TENTHOUSAND), fee);
  return [JSBI.subtract(amount, calculatedFee), calculatedFee];
}

function plusFee(amount: JSBI, fee: JSBI): Array<JSBI> {
  const calculatedFee = JSBI.multiply(JSBI.divide(amount, TENTHOUSAND), fee);
  return [JSBI.add(amount, calculatedFee), calculatedFee];
}

export function calculateExpectedAmount(
  proposeBalance: number,
  receiveBalance: number,
  proposedAmount: number,
  feeWithDecimals: number
): number {
  const PBALANCE = JSBI.BigInt(proposeBalance);
  const RBALANCE = JSBI.BigInt(receiveBalance);
  const PAMOUNT = JSBI.BigInt(proposedAmount);
  const FEE = JSBI.BigInt(feeWithDecimals * 100);

  const invariant = JSBI.multiply(PBALANCE, RBALANCE);
  const newProposeBalance = JSBI.add(PBALANCE, PAMOUNT);
  const newReceiveBalance = JSBI.divide(invariant, newProposeBalance);
  const expectedAmount = JSBI.subtract(RBALANCE, newReceiveBalance);
  const [expectedAmountMinusFee] = minusFee(expectedAmount, FEE);
  return JSBI.toNumber(expectedAmountMinusFee);
}

export function calculateProposeAmount(
  proposeBalance: number,
  receiveBalance: number,
  expectedAmount: number,
  feeWithDecimals: number
): number {
  const PBALANCE = JSBI.BigInt(proposeBalance);
  const RBALANCE = JSBI.BigInt(receiveBalance);
  const RAMOUNT = JSBI.BigInt(expectedAmount);
  const FEE = JSBI.BigInt(feeWithDecimals * 100);

  const invariant = JSBI.multiply(PBALANCE, RBALANCE);
  const newReceiveBalance = JSBI.subtract(RBALANCE, RAMOUNT);
  const newProposeBalance = JSBI.divide(invariant, newReceiveBalance);
  const proposeAmount = JSBI.subtract(newProposeBalance, PBALANCE);
  const [proposeAmountPlusFee] = plusFee(proposeAmount, FEE);
  return JSBI.toNumber(proposeAmountPlusFee);
}

export function makeid(length: number): string {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function decodePsbt(
  psbtBase64: string
): { psbt: Psbt; transaction: Transaction } {
  let psbt: Psbt;
  try {
    psbt = Psbt.fromBase64(psbtBase64);
  } catch (ignore) {
    throw new Error('Invalid psbt');
  }

  const bufferTx = psbt.data.globalMap.unsignedTx.toBuffer();
  const transaction = Transaction.fromBuffer(bufferTx);
  return {
    psbt,
    transaction,
  };
}

export interface UtxoInterface {
  txid: string;
  vout: number;
  asset: string;
  value: number;
  script?: string;
}

export function coinselect(utxos: Array<UtxoInterface>, amount: number) {
  let unspents = [];
  let availableSat = 0;
  let change = 0;

  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    unspents.push({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      asset: utxo.asset,
    });
    availableSat += utxo.value;

    if (availableSat >= amount) break;
  }

  if (availableSat < amount)
    throw new Error('You do not have enough in your wallet');

  change = availableSat - amount;

  return { unspents, change };
}

export function isValidAmount(amount: number): boolean {
  if (amount <= 0 || !Number.isSafeInteger(amount)) return false;
  return true;
}
