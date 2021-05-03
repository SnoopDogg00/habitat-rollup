import TYPED_DATA from './typedData.js';

export { TYPED_DATA }

export const BRICK_ABI = [
  'event BlockBeacon()',
  'event ClaimUsername(address indexed account, bytes32 indexed shortString)',
  'event CommunityCreated(address indexed governanceToken, bytes32 indexed communityId, string metadata)',
  'event Deposit(address token, address owner, uint256 value)',
  'event ModuleActivated(bytes32 communityId, address condition)',
  'event ModuleSubmitted(address contractAddress, string metadata)',
  'event NewSolution(bytes32 solutionHash, uint256 blockNumber)',
  'event ProposalCreated(address indexed vault, bytes32 indexed proposalId, uint256 startDate, string metadata)',
  'event ProposalProcessed(bytes32 indexed proposalId, uint256 indexed votingStatus)',
  'event RollupUpgrade(address target)',
  'event TokenTransfer(address indexed token, address indexed from, address indexed to, uint256 value)',
  'event VaultCreated(bytes32 indexed communityId, address indexed condition, address indexed vaultAddress, string metadata)',
  'event VotedOnProposal(address indexed account, bytes32 indexed proposalId, uint8 signalStrength, uint256 shares)',
  'event Withdraw(address token, address owner, uint256 value)',
  'function INSPECTION_PERIOD() view returns (uint16)',
  'function INSPECTION_PERIOD_MULTIPLIER() view returns (uint256)',
  'function MAX_BLOCK_SIZE() view returns (uint24)',
  'function MAX_SOLUTION_SIZE() view returns (uint24)',
  'function PROPOSAL_DELAY() view returns (uint256)',
  'function ROLLUP_MANAGER() view returns (address)',
  'function accountDelegate(address a) view returns (address ret)',
  'function batchDeposit()',
  'function batchWithdraw()',
  'function blockMeta(uint256 height) view returns (uint256 ret)',
  'function canFinalizeBlock(uint256 blockNumber) view returns (bool)',
  'function challenge()',
  'function challengeOffset() view returns (uint256 ret)',
  'function communityOfVault(address vault) view returns (bytes32 ret)',
  'function createdAtBlock() view returns (uint256 ret)',
  'function deposit(address token, uint256 amountOrId, address receiver)',
  'function dispute(uint256 blockNumber, uint256 bitmask)',
  'function executionPermit(address vault, bytes32 proposalId) view returns (bytes32 ret)',
  'function finalizeSolution(uint256 blockNumber)',
  'function finalizedHeight() view returns (uint256 ret)',
  'function getActiveVotingStake(address token, address account) view returns (uint256 ret)',
  'function getERC20Exit(address target, address owner) view returns (uint256)',
  'function getERC721Exit(address target, uint256 tokenId) view returns (address)',
  'function getErc20Balance(address tkn, address account) view returns (uint256 ret)',
  'function getErc721Owner(address tkn, uint256 b) view returns (address ret)',
  'function getIsMemberOfCommunity(bytes32 communityId, address account) view returns (bool ret)',
  'function getProposalStatus(bytes32 a) view returns (uint256 ret)',
  'function getTotalMemberCount(bytes32 communityId) view returns (uint256 ret)',
  'function getTotalValueLocked(address token) view returns (uint256 value)',
  'function getTotalVotingShares(bytes32 proposalId) view returns (uint256 ret)',
  'function getTotalVotingSignal(bytes32 proposalId) view returns (uint256 ret)',
  'function getVote(bytes32 proposalId, address account) view returns (uint256 ret)',
  'function getVoteCount(bytes32 proposalId) view returns (uint256 ret)',
  'function getVoteSignal(bytes32 proposalId, address account) view returns (uint256 ret)',
  'function moduleHash(address a) view returns (bytes32 ret)',
  'function nameToAddress(bytes32 shortString) view returns (address ret)',
  'function onActivateModule(address msgSender, uint256 nonce, bytes32 communityId, address condition)',
  'function onChallenge() returns (uint256)',
  'function onClaimUsername(address msgSender, uint256 nonce, bytes32 shortString)',
  'function onCreateCommunity(address msgSender, uint256 nonce, address governanceToken, string metadata)',
  'function onCreateProposal(address msgSender, uint256 nonce, uint256 startDate, address vault, bytes internalActions, bytes externalActions, string metadata)',
  'function onCreateVault(address msgSender, uint256 nonce, bytes32 communityId, address condition, string metadata)',
  'function onDeposit(address token, address owner, uint256 value)',
  'function onFinalizeSolution(uint256 blockNumber, bytes32 hash)',
  'function onProcessProposal(address msgSender, uint256 nonce, bytes32 proposalId, bytes internalActions, bytes externalActions) returns (uint256 votingStatus)',
  'function onSetDelegate(address msgSender, uint256 nonce, address delegatee)',
  'function onSubmitModule(address msgSender, uint256 nonce, address contractAddress, string metadata)',
  'function onTransferToken(address msgSender, uint256 nonce, address token, address to, uint256 value)',
  'function onVoteOnProposal(address msgSender, uint256 nonce, bytes32 proposalId, uint256 shares, address delegatedFor, uint8 signalStrength)',
  'function proposalStartDate(bytes32 a) view returns (uint256 ret)',
  'function proposalVault(bytes32 a) view returns (address ret)',
  'function stateRoot() view returns (uint256 ret)',
  'function submitBlock() payable',
  'function submitSolution()',
  'function tokenOfCommunity(bytes32 a) view returns (address ret)',
  'function txNonces(address a) view returns (uint256 ret)',
  'function upgradeRollup(address newImplementation)',
  'function vaultCondition(address vault) view returns (address ret)',
  'function withdraw(address token, uint256 tokenId)'
];

export const EXECUTION_PROXY_ABI = [
  'function delegate() view returns (address)',
  'function executed(uint256) view returns (bool)',
  'function execute(uint256 proposalIndex, bytes actions)'
];
