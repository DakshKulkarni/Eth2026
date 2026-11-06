import { compileContract, type Compiled } from './solc-compile.js';

export function compileRegistry(): Compiled {
  return compileContract('SessionRegistry.sol', 'SessionRegistry');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [file, name] of [
    ['SessionRegistry.sol', 'SessionRegistry'],
    ['CertificateRegistrar.sol', 'CertificateRegistrar'],
  ] as const) {
    const { abi, bytecode } = compileContract(file, name);
    const names = (abi as Array<{ type: string; name?: string }>).filter((x) => x.name).map((x) => `${x.type} ${x.name}`);
    console.log(`${name}: compiled OK, ${(bytecode.length - 2) / 2} bytes`);
    console.log(`  ${names.join(', ')}`);
  }
}
