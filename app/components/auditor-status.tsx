'use client';

import { useAuditor } from '../hooks/use-auditor';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

export default function AuditorStatus() {
  const { address } = useAccount();
  const [showSetAuditorSuccess, setShowSetAuditorSuccess] = useState(false);
  
  const { 
    auditorAddress, 
    hasAuditor, 
    auditorLoading, 
    auditorError, 
    isOnCorrectChain,
    contractAddress,
    handleSetAuditor,
    isSettingAuditor,
    setAuditorError,
    isSetAuditorConfirmed,
    setAuditorHash
  } = useAuditor();

  const handleSetAuditorClick = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      await handleSetAuditor(address);
    } catch (error) {
      console.error('Failed to set auditor:', error);
    }
  };

  // Show success message when auditor is set
  useEffect(() => {
    if (isSetAuditorConfirmed) {
      setShowSetAuditorSuccess(true);
      setTimeout(() => {
        setShowSetAuditorSuccess(false);
      }, 5000); // Hide after 5 seconds
    }
  }, [isSetAuditorConfirmed]);

  if (!isOnCorrectChain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <svg className="w-6 h-6 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-orange-200 font-medium">Network Required</p>
            <p className="text-orange-300/80 text-sm">Please switch to Avalanche Fuji to check auditor status</p>
          </div>
        </div>
      </div>
    );
  }

  if (auditorLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <div>
            <p className="text-blue-200 font-medium">Checking Auditor</p>
            <p className="text-blue-300/80 text-sm">Verifying contract auditor status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (auditorError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-300/80 text-sm">Failed to check auditor status</p>
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
          <span className="text-gray-300 text-sm">eERC Contract</span>
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

      {/* Auditor Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Registration Verifier</span>
          {hasAuditor ? (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-400 text-sm font-medium">Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-red-400 text-sm font-medium">Not Found</span>
            </div>
          )}
        </div>

        {auditorAddress && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="font-mono text-xs text-gray-300 break-all">
              {auditorAddress}
            </p>
          </div>
        )}
      </div>

      {/* Status Description & Actions */}
      <div className={`p-4 rounded-xl border ${
        hasAuditor 
          ? 'bg-green-500/10 border-green-500/20' 
          : 'bg-orange-500/10 border-orange-500/20'
      }`}>
        <div className="flex items-start gap-3">
          {hasAuditor ? (
            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
          <div className="flex-1">
            <p className={`font-medium text-sm ${
              hasAuditor ? 'text-green-200' : 'text-orange-200'
            }`}>
              {hasAuditor ? 'Auditor Verified' : 'No Auditor Found'}
            </p>
            <p className={`text-xs mt-1 ${
              hasAuditor ? 'text-green-300/80' : 'text-orange-300/80'
            }`}>
              {hasAuditor 
                ? 'The contract has a verified registration verifier that validates zero-knowledge proofs for secure user registration.'
                : 'The contract does not have an auditor set. You can set yourself as the auditor to verify zero-knowledge proofs.'
              }
            </p>
            
            {/* Set Auditor Button */}
            {!hasAuditor && address && (
              <div className="mt-3">
                <button
                  onClick={handleSetAuditorClick}
                  disabled={isSettingAuditor}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isSettingAuditor
                      ? 'bg-orange-100/20 text-orange-300/60 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  {isSettingAuditor ? (
                    <>
                      <div className="w-4 h-4 border-2 border-orange-300/60 border-t-transparent rounded-full animate-spin"></div>
                      Setting Auditor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Set Me as Auditor
                    </>
                  )}
                </button>
                <p className="text-xs text-orange-300/60 mt-1">
                  Your wallet address will be set as the contract auditor
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Set Auditor Success Message */}
      {showSetAuditorSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-green-200 font-medium text-sm">Auditor Set Successfully!</p>
              <p className="text-green-300/80 text-xs mt-1">
                Your wallet has been set as the contract auditor. Transaction hash: {setAuditorHash?.slice(0, 10)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Set Auditor Error */}
      {setAuditorError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-200 font-medium text-sm">Failed to Set Auditor</p>
              <p className="text-red-300/80 text-xs mt-1">
                There was an error setting the auditor. Please try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-200 text-sm font-medium">Security Notice</span>
        </div>
        <p className="text-blue-300/80 text-xs">
          Always verify contract addresses and auditor status before interacting with the protocol. 
          This information is fetched directly from the blockchain for transparency.
        </p>
      </div>
    </div>
  );
}
