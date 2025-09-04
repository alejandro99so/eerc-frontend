'use client';

import { useERC20 } from '../hooks/use-erc20';
import { useState, useEffect } from 'react';

export default function ERC20Status() {
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  
  const {
    contractAddress,
    isOnCorrectChain,
    balance,
    balanceLoading,
    canClaim,
    canClaimLoading,
    faucetAmount,
    timeToNextClaim,
    timeToNextClaimFormatted,
    handleClaimFaucet,
    isClaiming,
    claimError,
    isClaimConfirmed,
    claimHash
  } = useERC20();

  const handleClaimClick = async () => {
    try {
      await handleClaimFaucet();
    } catch (error) {
      console.error('Failed to claim from faucet:', error);
    }
  };

  // Show success message when claim is confirmed
  useEffect(() => {
    if (isClaimConfirmed) {
      setShowClaimSuccess(true);
      setTimeout(() => {
        setShowClaimSuccess(false);
      }, 5000); // Hide after 5 seconds
    }
  }, [isClaimConfirmed]);

  if (!isOnCorrectChain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <svg className="w-6 h-6 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-orange-200 font-medium">Network Required</p>
            <p className="text-orange-300/80 text-sm">Please switch to Avalanche Fuji to view ERC20 status</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contract Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            ERC20 Test Token
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm font-medium">Active</span>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="font-mono text-xs text-gray-300 break-all">
            {contractAddress}
          </p>
        </div>
      </div>

      {/* Balance Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Your Balance
          </span>
          {balanceLoading && (
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <div className="text-2xl font-bold text-white mb-1">
            {balanceLoading ? '...' : balance} <span className="text-lg font-normal text-gray-300">TEST</span>
          </div>
          <p className="text-xs text-gray-400">Test tokens for encrypted transactions</p>
        </div>
      </div>

      {/* Faucet Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Token Faucet
          </span>
          <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full">
            {faucetAmount} TEST per claim
          </span>
        </div>

        <div className={`p-4 rounded-xl border ${
          canClaim 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-orange-500/10 border-orange-500/20'
        }`}>
          <div className="flex items-start gap-3">
            {canClaim ? (
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className={`font-medium text-sm ${
                canClaim ? 'text-green-200' : 'text-orange-200'
              }`}>
                {canClaimLoading ? 'Checking faucet status...' : canClaim ? 'Ready to Claim!' : 'Faucet Cooldown Active'}
              </p>
              <p className={`text-xs mt-1 ${
                canClaim ? 'text-green-300/80' : 'text-orange-300/80'
              }`}>
                {canClaimLoading 
                  ? 'Verifying your claim eligibility...'
                  : canClaim 
                    ? `Claim ${faucetAmount} TEST tokens from the faucet. Free tokens for testing encrypted transactions.`
                    : timeToNextClaimFormatted 
                      ? `You can claim again in ${timeToNextClaimFormatted}. Each wallet can claim once every 24 hours.`
                      : 'You have recently claimed from the faucet. Please wait before claiming again.'
                }
              </p>
              
              {/* Claim Button */}
              {canClaim && (
                <div className="mt-3">
                  <button
                    onClick={handleClaimClick}
                    disabled={isClaiming}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isClaiming
                        ? 'bg-green-100/20 text-green-300/60 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isClaiming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-green-300/60 border-t-transparent rounded-full animate-spin"></div>
                        Claiming...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        Claim {faucetAmount} TEST
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Claim Success Message */}
      {showClaimSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-green-200 font-medium text-sm">Faucet Claim Successful! 🎉</p>
              <p className="text-green-300/80 text-xs mt-1">
                {faucetAmount} TEST tokens have been added to your balance. Transaction: {claimHash?.slice(0, 10)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Claim Error */}
      {claimError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-200 font-medium text-sm">Claim Failed</p>
              <p className="text-red-300/80 text-xs mt-1">
                Unable to claim from faucet. Please try again later.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Notice */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-200 text-sm font-medium">Faucet Information</span>
        </div>
        <p className="text-blue-300/80 text-xs">
          The test token faucet provides free tokens for testing the encrypted ERC protocol. 
          Each wallet can claim once every 24 hours. Use these tokens for deposits, transfers, and other encrypted operations.
        </p>
      </div>
    </div>
  );
}
