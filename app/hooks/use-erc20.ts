'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { ERC20_TEST } from '../lib/contracts';
import { avalancheFuji } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { formatEther } from 'viem';

export function useERC20() {
  const { address } = useAccount();
  const chainId = useChainId();
  const isOnCorrectChain = chainId === avalancheFuji.id;
  const [timeToNextClaim, setTimeToNextClaim] = useState<number>(0);

  // Get user's ERC20 balance
  const { 
    data: balance, 
    isLoading: balanceLoading, 
    refetch: refetchBalance 
  } = useReadContract({
    address: ERC20_TEST.address,
    abi: ERC20_TEST.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isOnCorrectChain && !!address
    }
  });

  // Check if user can claim from faucet
  const { 
    data: canClaim, 
    isLoading: canClaimLoading,
    refetch: refetchCanClaim 
  } = useReadContract({
    address: ERC20_TEST.address,
    abi: ERC20_TEST.abi,
    functionName: 'canClaimFromFaucet',
    args: address ? [address] : undefined,
    query: {
      enabled: isOnCorrectChain && !!address
    }
  });

  // Get next claim time
  const { 
    data: nextClaimTime, 
    refetch: refetchNextClaimTime 
  } = useReadContract({
    address: ERC20_TEST.address,
    abi: ERC20_TEST.abi,
    functionName: 'getNextFaucetClaimTime',
    args: address ? [address] : undefined,
    query: {
      enabled: isOnCorrectChain && !!address && !canClaim
    }
  });

  // Get faucet amount
  const { data: faucetAmount } = useReadContract({
    address: ERC20_TEST.address,
    abi: ERC20_TEST.abi,
    functionName: 'FAUCET_AMOUNT',
    query: {
      enabled: isOnCorrectChain
    }
  });

  // Get faucet cooldown
  const { data: faucetCooldown } = useReadContract({
    address: ERC20_TEST.address,
    abi: ERC20_TEST.abi,
    functionName: 'FAUCET_COOLDOWN',
    query: {
      enabled: isOnCorrectChain
    }
  });

  // Claim from faucet
  const { 
    writeContract: claimFaucet, 
    data: claimHash, 
    isPending: isClaimPending, 
    error: claimError 
  } = useWriteContract();

  // Wait for claim transaction
  const { 
    isLoading: isClaimConfirming, 
    isSuccess: isClaimConfirmed 
  } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  const handleClaimFaucet = async () => {
    if (!isOnCorrectChain) {
      throw new Error('Please switch to Avalanche Fuji network');
    }

    if (!address) {
      throw new Error('Please connect your wallet');
    }

    try {
      console.log('💧 Claiming from faucet...');
      
      await claimFaucet({
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'claimFromFaucet',
        chainId: avalancheFuji.id,
      });
      
    } catch (error) {
      console.error('❌ Error claiming from faucet:', error);
      throw error;
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (!nextClaimTime || canClaim) {
      setTimeToNextClaim(0);
      return;
    }

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = Number(nextClaimTime) - now;
      setTimeToNextClaim(Math.max(0, timeLeft));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextClaimTime, canClaim]);

  // Refetch data when transaction is confirmed
  useEffect(() => {
    if (isClaimConfirmed) {
      setTimeout(() => {
        refetchBalance();
        refetchCanClaim();
        refetchNextClaimTime();
      }, 2000); // Wait 2 seconds for blockchain update
    }
  }, [isClaimConfirmed, refetchBalance, refetchCanClaim, refetchNextClaimTime]);

  // Format balance
  const formattedBalance = balance ? formatEther(balance) : '0';
  const formattedFaucetAmount = faucetAmount ? formatEther(faucetAmount) : '0';

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return {
    // Contract info
    contractAddress: ERC20_TEST.address,
    isOnCorrectChain,
    
    // Balance
    balance: formattedBalance,
    balanceLoading,
    
    // Faucet
    canClaim,
    canClaimLoading,
    faucetAmount: formattedFaucetAmount,
    faucetCooldown,
    timeToNextClaim,
    timeToNextClaimFormatted: formatTimeRemaining(timeToNextClaim),
    
    // Actions
    handleClaimFaucet,
    isClaiming: isClaimPending || isClaimConfirming,
    claimError,
    isClaimConfirmed,
    claimHash
  };
}
