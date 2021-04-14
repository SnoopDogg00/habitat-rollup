import ethers from 'ethers';

import TransactionBuilder from '@NutBerry/rollup-bricks/src/bricked/lib/TransactionBuilder.js';
import TYPED_DATA from '../habitatV1.js';
import { encodeProposalActions } from './utils.js';
import { getDeployCode } from '../lib/utils.js';

const builder = new TransactionBuilder(TYPED_DATA);

async function createTransaction (primaryType, message, signer, habitat) {
  if (message.nonce === undefined && builder.fieldNames[primaryType][0].name === 'nonce') {
    message.nonce = (await habitat.txNonces(signer.address)).toHexString();
  }

  const tx = {
    primaryType,
    message,
  };
  const hash = builder.sigHash(tx);
  const { r, s, v } = signer._signingKey().signDigest(hash);

  Object.assign(tx, { r, s, v });

  const txHash = await habitat.provider.send('eth_sendRawTransaction', [tx]);
  const receipt = await habitat.provider.send('eth_getTransactionReceipt', [txHash]);

  return { txHash, receipt };
}

describe('HabitatV1', async function () {
  const {
    HabitatV1Mock,
    ExecutionProxy,
    TestERC20,
    TestERC721,
    ExecutionTest,
    OneShareOneVote,
    UpgradableRollupTestnet,
  } = Artifacts;
  const { rootProvider, alice, bob, charlie } = getDefaultWallets();
  let bridge;
  let upgradableRollup;
  let rollupImplementation;
  let habitat;
  let habitatNode;
  let executionProxy;
  let erc20;
  let erc721;
  let cumulativeDeposits = BigInt(0);
  let proposalIndex;
  let executionTestContract;

  let names = {};
  let round = 0;
  let proposals = [];
  let invalidAction;
  let validAction;
  let conditions = {};
  let nftId = 0;

  before('Prepare contracts', async () => {
    erc20 = await deploy(TestERC20, alice);
    erc721 = await deploy(TestERC721, alice, 'NFT', 'NFT');

    upgradableRollup = await deploy(UpgradableRollupTestnet, alice);
    rollupImplementation = await deploy(HabitatV1Mock, alice);
    bridge = new ethers.Contract(upgradableRollup.address, HabitatV1Mock.abi, alice);

    await (await upgradableRollup.upgradeRollup(rollupImplementation.address)).wait();

    habitatNode = await startNode('../../bricked/lib/index.js', 9999, 0, bridge.address, TYPED_DATA);
    habitat = bridge.connect(habitatNode);

    executionProxy = await deploy(ExecutionProxy, alice, bridge.address);
    executionTestContract = await deploy(ExecutionTest, alice, executionProxy.address);

    for (const condition of [OneShareOneVote]) {
      const bytecode = getDeployCode(condition.deployedBytecode);
      conditions[condition.contractName] = (await deploy({ bytecode, abi: [] }, alice)).address;
    }

    invalidAction = encodeProposalActions(
      [
        executionTestContract.address,
        '0xbadc0ffe',
      ]
    );
    validAction = encodeProposalActions(
      [
        executionTestContract.address,
        executionTestContract.interface.encodeFunctionData('changeSomething', ['0xbadbeef']),
      ]
    );
  });

  function _doRound (abortProposal = false) {
    const depositAmount = '0xffffffff';

    describe('round', async () => {
      async function doDeposit (signer) {
        const user = await signer.getAddress();

        await (await erc20.transfer(user, depositAmount)).wait();
        await (await erc20.connect(signer).approve(bridge.address, depositAmount)).wait();

        const oldBlock = await habitatNode.getBlockNumber();
        const oldBalance = await habitat.getErc20Balance(erc20.address, user);

        const tx = await bridge.connect(signer).deposit(erc20.address, depositAmount, await signer.getAddress());
        const receipt = await tx.wait();

        await waitForValueChange(oldBlock, () => habitatNode.getBlockNumber());

        const newBalance = await habitat.getErc20Balance(erc20.address, user);
        assert.equal(newBalance.toString(), oldBalance.add(depositAmount).toString(), 'token balance should match');
        cumulativeDeposits += BigInt(depositAmount);
      }

      async function doNftDeposit (signer) {
        const value = nftId++;
        const user = await signer.getAddress();

        await (await erc721.mint(user, value)).wait();
        await (await erc721.connect(signer).approve(bridge.address, value)).wait();

        const oldBlock = await habitatNode.getBlockNumber();
        const tx = await bridge.connect(signer).deposit(erc721.address, value, user);
        const receipt = await tx.wait();

        await waitForValueChange(oldBlock, () => habitatNode.getBlockNumber());

        const newOwner = await habitat.getErc721Owner(erc721.address, value);
        assert.equal(newOwner, user, 'nft owner should match');
      }

      it('init', async () => {
        round++;
      });

      it('deposit: alice', async () => {
        await doDeposit(alice);
      });

      it('deposit nft: alice ', async () => {
        await doNftDeposit(alice);
      });

      it('exit nft: bob - should fail', async () => {
        const args = {
          token: erc721.address,
          to: ethers.constants.AddressZero,
          value: nftId - 1,
        };
        await assert.rejects(createTransaction('TransferToken', args, bob, habitat), /evm errno: 7/);
      });

      it('transfer erc721: alice > bob', async () => {
        const args = {
          token: erc721.address,
          to: bob.address,
          value: nftId - 1,
        };

        const { txHash, receipt } = await createTransaction('TransferToken', args, alice, habitat);
        assert.equal(receipt.status, '0x1', 'receipt.status');
        assert.equal(receipt.logs.length, 1, 'should emit');
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.token, args.token);
        assert.equal(evt.from, alice.address);
        assert.equal(evt.to, args.to);
        assert.equal(evt.value.toString(), BigInt(args.value).toString());
      });

      it('exit nft: bob', async () => {
        const args = {
          token: erc721.address,
          to: ethers.constants.AddressZero,
          value: nftId - 1,
        };

        const { txHash, receipt } = await createTransaction('TransferToken', args, bob, habitat);
        assert.equal(receipt.status, '0x1', 'receipt.status');
        assert.equal(receipt.logs.length, 2, 'should emit');
        const evt = habitat.interface.parseLog(receipt.logs[1]).args;
        assert.equal(evt.token, args.token);
        assert.equal(evt.from, bob.address);
        assert.equal(evt.to, args.to);
        assert.equal(evt.value.toString(), BigInt(args.value).toString());
      });

      it('exit erc20: bob - should fail', async () => {
        const args = {
          token: erc20.address,
          to: ethers.constants.AddressZero,
          value: '0x1',
        };
        await assert.rejects(createTransaction('TransferToken', args, bob, habitat), /evm errno: 7/);
      });

      it('transfer erc20: alice > bob', async () => {
        const args = {
          token: erc20.address,
          to: bob.address,
          value: '0x1',
        };

        const { txHash, receipt } = await createTransaction('TransferToken', args, alice, habitat);
        assert.equal(receipt.status, '0x1', 'receipt.status');
        assert.equal(receipt.logs.length, 1, 'should emit');
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.token, args.token);
        assert.equal(evt.from, alice.address);
        assert.equal(evt.to, args.to);
        assert.equal(evt.value.toString(), BigInt(args.value).toString());
      });

      it('exit erc20: bob', async () => {
        const args = {
          token: erc20.address,
          to: ethers.constants.AddressZero,
          value: '0x1',
        };

        const { txHash, receipt } = await createTransaction('TransferToken', args, bob, habitat);
        assert.equal(receipt.status, '0x1', 'receipt.status');
        assert.equal(receipt.logs.length, 2, 'should emit');
        const evt = habitat.interface.parseLog(receipt.logs[1]).args;
        assert.equal(evt.token, args.token);
        assert.equal(evt.from, bob.address);
        assert.equal(evt.to, args.to);
        assert.equal(evt.value.toString(), BigInt(args.value).toString());
      });

      it('deposit: bob', async () => {
        await doDeposit(bob);
      });

      it('exit erc20: bob', async () => {
        const args = {
          token: erc20.address,
          to: ethers.constants.AddressZero,
          value: (await habitat.getErc20Balance(erc20.address, bob.address)).toHexString(),
        };

        const { txHash, receipt } = await createTransaction('TransferToken', args, bob, habitat);
        assert.equal(receipt.status, '0x1', 'receipt.status');
        assert.equal(receipt.logs.length, 2, 'should emit');
        const evt = habitat.interface.parseLog(receipt.logs[1]).args;
        assert.equal(evt.token, args.token);
        assert.equal(evt.from, bob.address);
        assert.equal(evt.to, args.to);
        assert.equal(evt.value.toString(), BigInt(args.value).toString());
      });

      it('alice: claim user name', async () => {
        const alreadyClaimed = !!names[alice.address];
        const args = {
          shortString: Array.from((new TextEncoder()).encode('alice')),
        };
        if (alreadyClaimed) {
          await assert.rejects(createTransaction('ClaimUsername', args, alice, habitat), /evm errno: 7/);
        } else {
          const { txHash, receipt } = await createTransaction('ClaimUsername', args, alice, habitat);
          assert.equal(receipt.status, '0x1', 'success');
          assert.equal(receipt.logs.length, 1, '# events');

          const evt = habitat.interface.parseLog(receipt.logs[0]).args;
          assert.equal(evt.account, alice.address);
          assert.equal(BigInt(evt.shortString), BigInt(ethers.utils.hexlify(args.shortString)));
          assert.equal(await habitat.nameToAddress(evt.shortString), alice.address);
          names[alice.address] = args.shortString;
        }
      });

      it('alice: claim random user name', async () => {
        const args = {
          shortString: Array.from(ethers.utils.randomBytes(32)),
        };
        const { txHash, receipt } = await createTransaction('ClaimUsername', args, alice, habitat);
        assert.equal(receipt.status, '0x1', 'success');
      });

      it('alice: setDelegate', async () => {
        const args = {
          to: bob.address,
        };
        const { txHash, receipt } = await createTransaction('SetDelegate', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
      });

      let communityId;
      it('alice: create a new community', async () => {
        const metadata = '{}';
        const args = {
          nonce: (await habitat.txNonces(alice.address)).toHexString(),
          governanceToken: erc20.address,
          metadata,
        };
        const { txHash, receipt } = await createTransaction('CreateCommunity', args, alice, habitat);

        assert.equal(receipt.logs.length, 1, '#events');
        assert.equal(receipt.status, '0x1', 'status');
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.governanceToken, args.governanceToken, 'governanceToken');
        assert.equal(evt.metadata, args.metadata, 'metadata');
        communityId = ethers.utils.keccak256(
          Buffer.from(
            alice.address.replace('0x', '').padStart(64, '0') +
            args.nonce.replace('0x', '').padStart(64, '0') +
            args.governanceToken.replace('0x', '').padStart(64, '0'),
            'hex'
          )
        );
        assert.equal(evt.communityId, communityId, 'communityId');
      });

      it('alice: create a vault', async () => {
        const vaultCondition = ethers.constants.AddressZero;
        const args = {
          communityId,
          condition: vaultCondition,
          metadata: '{}',
        };
        const { txHash, receipt } = await createTransaction('CreateVault', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.communityId, args.communityId);
        assert.equal(evt.condition, args.condition);
      });

      it('activate condition should fail - not submitted yet', async () => {
        const vaultCondition = ethers.constants.AddressZero;
        const args = {
          communityId,
          condition: vaultCondition,
        };
        await assert.rejects(createTransaction('ActivateModule', args, alice, habitat), /evm errno: 7/);
      });

      let vaultCondition;
      it('submit OneShareOneVote module', async () => {
        vaultCondition = conditions.OneShareOneVote;
        const args = {
          contractAddress: vaultCondition,
          metadata: '{}',
        };
        const { txHash, receipt } = await createTransaction('SubmitModule', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.contractAddress, args.contractAddress);
      });

      it('activate OneShareOneVote', async () => {
        const args = {
          communityId,
          condition: vaultCondition,
        };
        const { txHash, receipt } = await createTransaction('ActivateModule', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.communityId, args.communityId);
        assert.equal(evt.condition, args.condition);
      });

      let vault;
      it('alice: create a vault', async () => {
        const args = {
          communityId,
          condition: vaultCondition,
          metadata: '{}',
        };
        const { txHash, receipt } = await createTransaction('CreateVault', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.communityId, args.communityId);
        assert.equal(evt.condition, args.condition);
        vault = evt.vaultAddress;
      });

      let proposalId;
      it('create proposal for first vault', async () => {
        const args = {
          startDate: ~~(Date.now() / 1000) - 2,
          vault,
          actions: '0x',
          title: 'hello world',
          metadata: '{}',
        };
        const { txHash, receipt } = await createTransaction('CreateProposal', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 2);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        proposalId = evt.proposalId;
      });

      it('process proposal - should remain open', async () => {
        const args = {
          proposalId,
        };
        const { txHash, receipt } = await createTransaction('ProcessProposal', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(Number(evt.votingStatus), 1);
      });

      it('alice: vote on proposal', async () => {
        const args = {
          proposalId,
          signalStrength: 100,
          shares: 0xff,
          timestamp: ~~(Date.now() / 1000),
          delegatedFor: ethers.constants.AddressZero,
        };
        const { txHash, receipt } = await createTransaction('VoteOnProposal', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.account, alice.address);
      });

      it('bob: vote on proposal as a delegate for alice', async () => {
        const args = {
          proposalId,
          signalStrength: 100,
          shares: 0xff,
          timestamp: ~~(Date.now() / 1000),
          delegatedFor: alice.address,
        };
        const { txHash, receipt } = await createTransaction('VoteOnProposal', args, bob, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(evt.account, alice.address);
      });

      it('process proposal - should pass', async () => {
        const args = {
          proposalId,
        };
        const { txHash, receipt } = await createTransaction('ProcessProposal', args, alice, habitat);
        assert.equal(receipt.status, '0x1');
        assert.equal(receipt.logs.length, 1);
        const evt = habitat.interface.parseLog(receipt.logs[0]).args;
        assert.equal(Number(evt.votingStatus), 3);
      });
    });
  }

  function doRound () {
    it('reset proposal array', async () => {
      proposals = [];
    });

    _doRound();
  }

  function doExecutionTest () {
    describe('on-chain execution tests', () => {
      it('check execution permit and execute', async () => {
        for (const { args, proposalIndex, txHash, valid } of proposals) {
          const ok = await bridge.executionPermits(proposalIndex);

          assert.equal(!!Number(ok), valid, 'execution permit only for valid proposals');

          let expected = valid && args.actions === validAction;
          // try to execute
          let result;
          if (expected) {
            const tx = await executionProxy.execute(proposalIndex, args.actions);
            const receipt = await tx.wait();
            result = !!receipt.status;
          } else {
            await assertRevert(executionProxy.execute(proposalIndex, args.actions, { gasLimit: GAS_LIMIT }));
            result = false;
          }

          assert.equal(result, expected, 'expected execution result via proxy');
          console.log({ proposalIndex, expected });

          if (expected) {
            // a second time should fail
            await assertRevert(executionProxy.execute(proposalIndex, args.actions, { gasLimit: GAS_LIMIT }));
          }
        }
      });

      it('non existent permits', async () => {
        await assertRevert(executionProxy.execute(0xff, '0x', { gasLimit: GAS_LIMIT }));
      });
    });
  }

  describe('chain - forward', function () {
    doRound();
    describe('finalize', function () {
      it('submitBlock', () => submitBlock(bridge, rootProvider, habitatNode));
      it('doForward', () => doForward(bridge, rootProvider, habitatNode));
      it('debugStorage', () => debugStorage(bridge, rootProvider, habitatNode));
    });
  });

  describe('chain - challenge', function () {
    doRound();
    describe('finalize', function () {
      it('submitBlock', () => submitBlock(bridge, rootProvider, habitatNode));
      it('doChallenge', () => doChallenge(bridge, rootProvider, habitatNode));
      it('debugStorage', () => debugStorage(bridge, rootProvider, habitatNode));
    });
  });

  describe('kill node', () => {
    it('debug_kill', async () => {
      try {
        await habitatNode.send('debug_kill', []);
      } catch (e) {
      }
    });
  });
});
