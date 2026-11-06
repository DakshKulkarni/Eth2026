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

export function compileRegistry(): { abi: unknown[]; bytecode: string } {
  const source = readFileSync(new URL('../../contracts/src/SessionRegistry.sol', import.meta.url), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'SessionRegistry.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
  if (errors.length > 0) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  const compiled = output.contracts?.['SessionRegistry.sol']?.['SessionRegistry'];
  if (!compiled) throw new Error('SessionRegistry was not produced by the compiler');
  return { abi: compiled.abi, bytecode: `0x${compiled.evm.bytecode.object}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { abi, bytecode } = compileRegistry();
  const names = (abi as Array<{ type: string; name?: string }>).filter((x) => x.name).map((x) => `${x.type} ${x.name}`);
  console.log(`compiled OK: ${(bytecode.length - 2) / 2} bytes of bytecode`);
  console.log(names.join('\n'));
}
