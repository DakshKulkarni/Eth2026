// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SessionRegistry {
    struct Anchor {
        bytes32 rootHash;
        uint8 outcome;
        uint64 at;
    }

    address public immutable issuer;
    mapping(bytes32 => Anchor) public anchors;

    event SessionAnchored(bytes32 indexed sessionId, bytes32 rootHash, uint8 outcome, address indexed anchoredBy);

    error NotIssuer();
    error AlreadyAnchored();

    constructor(address issuer_) {
        issuer = issuer_;
    }

    function anchor(bytes32 sessionId, bytes32 rootHash, uint8 outcome) external {
        if (msg.sender != issuer) revert NotIssuer();
        if (anchors[sessionId].at != 0) revert AlreadyAnchored();
        anchors[sessionId] = Anchor(rootHash, outcome, uint64(block.timestamp));
        emit SessionAnchored(sessionId, rootHash, outcome, msg.sender);
    }
}
