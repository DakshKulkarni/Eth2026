import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
const registrar = new ethers.Contract(
  '0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3',
  ['function isAvailable(string label) view returns (bool)'],
  provider,
);

const labels = process.argv.slice(2);
for (const label of labels.length > 0 ? labels : ['mrtrainer', 'mrmachinetrainer', 'cnctrainer', 'machinetrainer', 'trainmr', 'ethmumbaitrainer']) {
  try {
    const free = (await registrar.getFunction('isAvailable')(label)) as boolean;
    console.log(`${label.padEnd(20)} ${free ? 'AVAILABLE' : 'taken'}`);
  } catch (err) {
    console.log(`${label.padEnd(20)} call failed: ${err instanceof Error ? err.message.slice(0, 90) : 'error'}`);
  }
}
