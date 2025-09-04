'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { EERC_CONTRACT } from '../lib/contracts';
import { avalancheFuji } from 'wagmi/chains';
import { useState, useEffect } from 'react';

export function useAuditor() {
  const chainId = useChainId();
  const isOnCorrectChain = chainId === avalancheFuji.id;
  const [isSettingAuditor, setIsSettingAuditor] = useState(false);

  // Check if contract has a registration verifier (auditor)
  const { 
    data: auditorAddress, 
    isError: auditorError, 
    isLoading: auditorLoading,
    refetch: refetchAuditor
  } = useReadContract({
    address: EERC_CONTRACT.address,
    abi: EERC_CONTRACT.abi,
    functionName: 'auditor',
    query: {
      enabled: isOnCorrectChain
    }
  });

  // Set auditor function
  const { 
    writeContract: setAuditor, 
    data: setAuditorHash, 
    isPending: isSetAuditorPending, 
    error: setAuditorError 
  } = useWriteContract();

  // Wait for set auditor transaction
  const { 
    isLoading: isSetAuditorConfirming, 
    isSuccess: isSetAuditorConfirmed 
  } = useWaitForTransactionReceipt({
    hash: setAuditorHash,
  });

  // Check if auditor exists (address is not zero)
  const hasAuditor = auditorAddress && auditorAddress !== '0x0000000000000000000000000000000000000000';

  const handleSetAuditor = async (auditorWalletAddress: `0x${string}`) => {
    if (!isOnCorrectChain) {
      throw new Error('Please switch to Avalanche Fuji network');
    }

    try {
      setIsSettingAuditor(true);
      
      console.log('🔐 Setting auditor address:', auditorWalletAddress);
      
      await setAuditor({
        address: EERC_CONTRACT.address,
        abi: EERC_CONTRACT.abi,
        functionName: 'setAuditorPublicKey',
        args: [auditorWalletAddress],
        chainId: avalancheFuji.id,
      });
      
    } catch (error) {
      console.error('❌ Error setting auditor:', error);
      throw error;
    } finally {
      setIsSettingAuditor(false);
    }
  };

  // Refetch auditor when transaction is confirmed
  useEffect(() => {
    if (isSetAuditorConfirmed) {
      setTimeout(() => {
        refetchAuditor();
      }, 2000); // Wait 2 seconds for blockchain update
    }
  }, [isSetAuditorConfirmed, refetchAuditor]);

  return {
    auditorAddress,
    hasAuditor,
    auditorLoading,
    auditorError,
    isOnCorrectChain,
    contractAddress: EERC_CONTRACT.address,
    handleSetAuditor,
    isSettingAuditor: isSettingAuditor || isSetAuditorPending || isSetAuditorConfirming,
    setAuditorError,
    isSetAuditorConfirmed,
    setAuditorHash
  };
}
