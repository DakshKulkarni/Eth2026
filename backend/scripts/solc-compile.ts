import { readFileSync } from 'node:fs';
import solc from 'solc';

interface SolcMessage {
  severity: string;
  formattedMessage: string;
}

interface SolcOutput {
  errors?: SolcMessage[];
  contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
}

export interface Compiled {
  abi: unknown[];
  bytecode: string;
}

export function compileContract(fileName: string, contractName: string): Compiled {
  const source = readFileSync(new URL(`../../contracts/src/${fileName}`, import.meta.url), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [fileName]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
  if (errors.length > 0) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  const compiled = output.contracts?.[fileName]?.[contractName];
  if (!compiled) throw new Error(`${contractName} was not produced by the compiler`);
  return { abi: compiled.abi, bytecode: `0x${compiled.evm.bytecode.object}` };
}
