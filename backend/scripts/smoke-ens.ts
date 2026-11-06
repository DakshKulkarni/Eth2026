import { loadDeployment } from '../src/ens/deployment.js';
import { issueCertificate, revokeCertificate } from '../src/ens/issuer.js';
import { checkCredential, getPassport } from '../src/ens/read.js';

const deployment = loadDeployment();
const label = `cert-smoke${Date.now().toString(36)}`;
const show = (title: string, value: unknown): void => console.log(`${title}\n${JSON.stringify(value, null, 2)}\n`);

show('1. machine passport, read live from ENS:', await getPassport('cnc-01'));
show('   before issuing (should be revoked_or_unknown):', await checkCredential(label));

console.log(`2. issuing ${label}.smartician.eth ...`);
const issued = await issueCertificate({
  label,
  holder: deployment.issuer,
  validityDays: 30,
  evidenceRoot: deployment.procedureRoot,
  outcome: 'test_pass',
});
if (!issued.ok) {
  console.error(`issue failed: ${issued.reason}`);
  process.exit(1);
}
show('   issued:', issued);
show('3. credential check (should be valid, with records):', await checkCredential(label));

console.log('4. revoking ...');
const revoked = await revokeCertificate(label);
if (!revoked.ok) {
  console.error(`revoke failed: ${revoked.reason}`);
  process.exit(1);
}
show('   revoked:', revoked);
const after = await checkCredential(label);
show('5. credential check after revoke (should be invalid):', after);
process.exit(after.valid ? 1 : 0);
