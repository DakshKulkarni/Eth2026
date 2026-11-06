// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUserRegistry {
    function register(
        string calldata label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    function unregister(uint256 anyId) external;
}

contract CertificateRegistrar {
    uint64 public constant MAX_VALIDITY = 365 days;

    IUserRegistry public immutable REGISTRY;
    address public immutable ISSUER;
    address public immutable RESOLVER;

    event CertificateIssued(string label, address indexed holder, uint64 expiry);
    event CertificateRevoked(string label);

    error NotIssuer();
    error InvalidExpiry();

    constructor(IUserRegistry registry, address issuer, address resolver) {
        REGISTRY = registry;
        ISSUER = issuer;
        RESOLVER = resolver;
    }

    function issue(string calldata label, address holder, uint64 expiry) external returns (uint256 tokenId) {
        if (msg.sender != ISSUER) revert NotIssuer();
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_VALIDITY) revert InvalidExpiry();
        tokenId = REGISTRY.register(label, holder, address(0), RESOLVER, 0, expiry);
        emit CertificateIssued(label, holder, expiry);
    }

    function revoke(string calldata label) external {
        if (msg.sender != ISSUER) revert NotIssuer();
        REGISTRY.unregister(uint256(keccak256(bytes(label))));
        emit CertificateRevoked(label);
    }
}
