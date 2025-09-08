'use client';

import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { ERC20_TEST, EERC_CONTRACT } from '../lib/contracts';
import { avalancheFuji } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { formatEther, parseUnits } from 'viem';

export function useERC20() {
  const { address } = useAccount();
  const chainId = useChainId();
  const isOnCorrectChain = chainId === avalancheFuji.id;
  const [timeToNextClaim, setTimeToNextClaim] = useState<number>(0);
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));

  // Batch all contract reads into a single request
  const { 
    data: contractData, 
    isLoading: contractsLoading, 
    refetch: refetchContracts 
  } = useReadContracts({
    contracts: [
      // 0: balanceOf
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
      },
      // 1: canClaimFromFaucet
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'canClaimFromFaucet',
        args: address ? [address] : undefined,
      },
      // 2: getNextFaucetClaimTime
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'getNextFaucetClaimTime',
        args: address ? [address] : undefined,
      },
      // 3: FAUCET_AMOUNT
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'FAUCET_AMOUNT',
      },
      // 4: FAUCET_COOLDOWN
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'FAUCET_COOLDOWN',
      },
      // 5: decimals
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'decimals',
      },
      // 6: allowance
      {
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'allowance',
        args: address ? [address, EERC_CONTRACT.address] : undefined,
      },
    ],
    query: {
      enabled: isOnCorrectChain && !!address
    }
  });

  // Extract individual values from batch result
  const balance = contractData?.[0]?.result;
  const canClaim = contractData?.[1]?.result;
  const nextClaimTime = contractData?.[2]?.result;
  const faucetAmount = contractData?.[3]?.result;
  const faucetCooldown = contractData?.[4]?.result;
  const decimals = contractData?.[5]?.result;
  const allowanceData = contractData?.[6]?.result;
  
  // Loading states
  const balanceLoading = contractsLoading;
  const canClaimLoading = contractsLoading;

  // Claim from faucet
  const { 
    writeContract: claimFaucet, 
    data: claimHash, 
    isPending: isClaimPending, 
    error: claimError 
  } = useWriteContract();

  // Approve tokens for spending
  const { 
    writeContract: approveTokens, 
    data: approveHash, 
    isPending: isApprovePending, 
    error: approveError 
  } = useWriteContract();

  // Wait for claim transaction
  const { 
    isLoading: isClaimConfirming, 
    isSuccess: isClaimConfirmed 
  } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Wait for approve transaction
  const { 
    isLoading: isApproveConfirming, 
    isSuccess: isApproveConfirmed 
  } = useWaitForTransactionReceipt({
    hash: approveHash,
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

  const handleApproveTokens = async (amount: string) => {
    if (!isOnCorrectChain) {
      throw new Error('Please switch to Avalanche Fuji network');
    }

    if (!address || !decimals) {
      throw new Error('Please connect your wallet and wait for data to load');
    }

    try {
      console.log('✅ Approving tokens for spending...', { amount, decimals });
      
      // Convert amount to wei using token decimals
      const amountInWei = parseUnits(amount, decimals);
      
      await approveTokens({
        address: ERC20_TEST.address,
        abi: ERC20_TEST.abi,
        functionName: 'approve',
        args: [EERC_CONTRACT.address, amountInWei],
        chainId: avalancheFuji.id,
      });
      
    } catch (error) {
      console.error('❌ Error approving tokens:', error);
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

  // Update allowance state when data changes
  useEffect(() => {
    if (allowanceData) {
      setAllowance(allowanceData);
    }
  }, [allowanceData]);

  // Refetch data when transaction is confirmed
  useEffect(() => {
    if (isClaimConfirmed || isApproveConfirmed) {
      setTimeout(() => {
        refetchContracts();
      }, 2000); // Wait 2 seconds for blockchain update
    }
  }, [isClaimConfirmed, isApproveConfirmed, refetchContracts]);

  // Format balance
  const formattedBalance = balance ? formatEther(balance) : '0';
  const formattedFaucetAmount = faucetAmount ? formatEther(faucetAmount) : '0';
  const formattedAllowance = allowance ? formatEther(allowance) : '0';

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

  // Check if allowance is sufficient for a given deposit amount
  const checkAllowanceSufficient = (depositAmount: string) => {
    if (!depositAmount || !decimals || parseFloat(depositAmount) <= 0) {
      return false;
    }
    
    try {
      // Convert deposit amount to wei using the token's decimals
      const depositAmountInWei = parseUnits(depositAmount, decimals);
      return allowance >= depositAmountInWei;
    } catch {
      return false;
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
    claimHash,
    
    // Approve
    handleApproveTokens,
    isApproving: isApprovePending || isApproveConfirming,
    approveError,
    isApproveConfirmed,
    approveHash,
    
    // Allowance
    allowance: formattedAllowance,
    allowanceRaw: allowance,
    decimals,
    checkAllowanceSufficient
  };
}
