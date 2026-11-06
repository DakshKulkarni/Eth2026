export const PARENT_LABEL = 'smartician';
export const PARENT_NAME = `${PARENT_LABEL}.eth`;
export const MACHINE_LABEL = 'cnc-01';
export const GUIDE_LABEL = 'guide-cnc';

export const SEPOLIA = {
  ethRegistry: '0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4',
  verifiableFactory: '0xda70306c98e97ece36f997a21368e53298572991',
  userRegistryImpl: '0x9bd8a88719068d09ecee662f36c0e3856708366a',
  permissionedResolverImpl: '0x115eb53f0c60696633855f90b138178fb40b2b2c',
} as const;

export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
export const ROLE_REGISTRAR = 1n << 0n;
export const ROLE_UNREGISTER = 1n << 12n;
export const ROLE_SET_TEXT = 1n << 4n;

export const ISSUER_TEXT_KEYS = ['mrt.evidence', 'mrt.verdict', 'mrt.issuedAt'] as const;
// Profile records on the certificate: ENSIP-18 alias and description, ENSIP-27 class.
export const PROFILE_TEXT_KEYS = ['alias', 'description', 'class'] as const;
export const APPROVER_TEXT_KEYS = ['mrt.approval'] as const;

export const ABI = {
  factory: [
    'function deployProxy(address implementation, uint256 salt, bytes data) returns (address)',
    'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
  ],
  userRegistry: [
    'function initialize((address account, uint256 roleBitmap)[] grants)',
    'function grantRootRoles(uint256 roleBitmap, address account) returns (bool)',
    'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)',
    'function getState(uint256 anyId) view returns (tuple(uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))',
  ],
  ethRegistry: ['function setSubregistry(uint256 anyId, address subregistry)', 'function getSubregistry(string label) view returns (address)'],
  resolver: [
    'function initialize((address account, uint256 roleBitmap)[] grants, bytes[] calls)',
    'function setText(bytes name, string key, string value)',
    'function grantSetterRoles(bytes setter, address account)',
  ],
  registrar: [
    'function issue(string label, address holder, uint64 expiry) returns (uint256)',
    'function revoke(string label)',
  ],
} as const;
