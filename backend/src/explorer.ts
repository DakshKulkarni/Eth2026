const CHAIN = 'https://chainscan-galileo.0g.ai';
const STORAGE = 'https://storagescan-galileo.0g.ai';

export const explorer = {
  sepoliaTx: (hash: string): string => `https://sepolia.etherscan.io/tx/${hash}`,
  chainTx: (hash: string): string => `${CHAIN}/tx/${hash}`,
  storageSubmission: (txSeq: number): string => `${STORAGE}/submission/${txSeq}`,
};
