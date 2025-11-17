import { Interface } from '@ethersproject/abi';
import { ethers } from 'ethers';
import {
  OperationType,
  SafeTransaction,
  RelayerTransactionResponse,
} from '@polymarket/builder-relayer-client';

import { ensureRelayClient } from '@/lib/relayer/relayClient';

const erc20Interface = new Interface([
  'function approve(address spender, uint256 value) public returns (bool)',
]);

export type ExecuteTxPayload = {
  to: string;
  data: string;
  value?: string;
  operation?: OperationType;
};

export function createApprovalTransaction(
  tokenAddress: string,
  spenderAddress: string,
  amount: string = ethers.constants.MaxUint256.toString(),
): SafeTransaction {
  return {
    to: tokenAddress,
    operation: OperationType.Call,
    data: erc20Interface.encodeFunctionData('approve', [spenderAddress, amount]),
    value: '0',
  };
}

export async function executeTransactions(transactions: SafeTransaction[], metadata?: string) {
  const client = ensureRelayClient('execute Safe transactions');
  const response: RelayerTransactionResponse = await client.execute(transactions, metadata);
  return response.wait();
}

export async function deploySafe() {
  const client = ensureRelayClient('deploy Safe');
  const response = await client.deploy();
  return response.wait();
}

export async function listRelayerTransactions() {
  const client = ensureRelayClient('fetch relayer transactions');
  return client.getTransactions();
}

