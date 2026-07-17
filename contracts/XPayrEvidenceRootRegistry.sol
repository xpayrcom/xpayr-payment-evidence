// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title XPayr Evidence Root Registry
/// @notice Stores immutable Merkle batch commitments. It never holds funds,
///         approves tokens, executes arbitrary calls, or mutates payment state.
contract XPayrEvidenceRootRegistry {
    struct Batch {
        bytes32 merkleRoot;
        uint64 leafCount;
        bytes32 manifestHash;
        address publisher;
        uint64 publishedAt;
    }

    error Unauthorized();
    error ZeroAddress();
    error InvalidBatch();
    error BatchAlreadyPublished(bytes32 batchId);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PublisherUpdated(address indexed publisher, bool allowed);
    event EvidenceRootPublished(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint64 leafCount,
        bytes32 manifestHash,
        address publisher
    );

    address public owner;
    mapping(address => bool) public publishers;
    mapping(bytes32 => Batch) private storedBatches;

    constructor(address initialOwner, address initialPublisher) {
        if (initialOwner == address(0) || initialPublisher == address(0)) revert ZeroAddress();
        owner = initialOwner;
        publishers[initialPublisher] = true;
        emit OwnershipTransferred(address(0), initialOwner);
        emit PublisherUpdated(initialPublisher, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyPublisher() {
        if (!publishers[msg.sender]) revert Unauthorized();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setPublisher(address publisher, bool allowed) external onlyOwner {
        if (publisher == address(0)) revert ZeroAddress();
        publishers[publisher] = allowed;
        emit PublisherUpdated(publisher, allowed);
    }

    function publishRoot(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint64 leafCount,
        bytes32 manifestHash
    ) external onlyPublisher {
        if (batchId == bytes32(0) || merkleRoot == bytes32(0) || manifestHash == bytes32(0) || leafCount == 0) {
            revert InvalidBatch();
        }
        if (storedBatches[batchId].publisher != address(0)) revert BatchAlreadyPublished(batchId);

        storedBatches[batchId] = Batch({
            merkleRoot: merkleRoot,
            leafCount: leafCount,
            manifestHash: manifestHash,
            publisher: msg.sender,
            publishedAt: uint64(block.timestamp)
        });
        emit EvidenceRootPublished(batchId, merkleRoot, leafCount, manifestHash, msg.sender);
    }

    function batches(bytes32 batchId)
        external
        view
        returns (bytes32 merkleRoot, uint64 leafCount, bytes32 manifestHash, address publisher)
    {
        Batch storage batch = storedBatches[batchId];
        return (batch.merkleRoot, batch.leafCount, batch.manifestHash, batch.publisher);
    }

    function publishedAt(bytes32 batchId) external view returns (uint64) {
        return storedBatches[batchId].publishedAt;
    }
}
