'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useDisconnect, useChainId, useConnect } from 'wagmi';
import { useRegistrationStatus } from '../hooks/use-registration-status';
import { useRegistration } from '../hooks/use-registration';
import NetworkSelector from './network-selector';
import { useState, useEffect } from 'react';
import { injected } from 'wagmi/connectors';

export default function ConnectWalletButton() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { connect: wagmiConnect } = useConnect();
  const chainId = useChainId();
  
  // State for success popup
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  
  // State to track if user explicitly disconnected to prevent auto-reconnect
  const [userExplicitlyDisconnected, setUserExplicitlyDisconnected] = useState(false);
  
  // Import useAccount to get wagmi's active account
  const { address: wagmiAddress } = useAccount();
  
  // Get the first connected wallet address from Privy
  const privyWalletAddress = wallets?.[0]?.address as `0x${string}` | undefined;
  
  // Use wagmi's address as the source of truth (this is what transactions actually use)
  const walletAddress = wagmiAddress;
  
  // Check registration status for the connected wallet
  const { 
    isRegistered, 
    isLoading: isCheckingRegistration, 
    error: registrationError,
    isOnCorrectChain 
  } = useRegistrationStatus(walletAddress);
  
  // Registration functionality
  const { 
    register, 
    isPending: isRegistering, 
    isConfirming, 
    isConfirmed, 
    error: registrationError2,
    hash: txHash,
    hasProofReady,
    signature
  } = useRegistration();

  // Show success popup when registration is confirmed
  useEffect(() => {
    if (isConfirmed && txHash) {
      setShowSuccessPopup(true);
    }
  }, [isConfirmed, txHash]);

  // Clear explicit disconnect flag when user authenticates
  useEffect(() => {
    if (authenticated && user) {
      setUserExplicitlyDisconnected(false);
    }
  }, [authenticated, user]);
  
  // Sync Privy wallet with wagmi when wallet is connected
  // Only sync when user is authenticated AND we have a Privy wallet AND no wagmi connection yet
  // AND user hasn't explicitly disconnected
  useEffect(() => {
    const syncWallet = async () => {
      // Don't auto-sync if:
      // - User is not authenticated 
      // - No user object or wallet address
      // - Wagmi already connected
      // - User explicitly disconnected (prevent unwanted reconnection)
      if (!authenticated || !user || !privyWalletAddress || wagmiAddress || userExplicitlyDisconnected) {
        return;
      }
      
      // Add a small delay to avoid race conditions during login/logout
      const timeoutId = setTimeout(async () => {
        try {
          console.log('🔗 Auto-syncing Privy wallet with wagmi...');
          await wagmiConnect({
            connector: injected(),
          });
        } catch (error) {
          console.log('⚠️ Auto-sync failed:', error);
          // Don't show error to user for auto-sync failures
        }
      }, 1000); // 1 second delay

      return () => clearTimeout(timeoutId);
    };

    syncWallet();
  }, [authenticated, user, privyWalletAddress, wagmiAddress, wagmiConnect, userExplicitlyDisconnected]);

  const handleConnect = async () => {
    if (!authenticated) {
      await login();
    } else if (authenticated && privyWalletAddress && !wagmiAddress) {
      // If logged in but wagmi not connected, try to sync
      try {
        await wagmiConnect({
          connector: injected(),
        });
      } catch (error) {
        console.log('Could not connect wagmi:', error);
      }
    }
  };

  const handleSyncWallet = async () => {
    try {
      console.log('🔗 Manually syncing wallet...');
      await wagmiConnect({
        connector: injected(),
      });
    } catch (error) {
      console.log('⚠️ Manual wallet sync failed:', error);
    }
  };

  const handleDisconnect = async () => {
    // Mark that user explicitly disconnected to prevent auto-reconnect
    setUserExplicitlyDisconnected(true);
    
    // Disconnect from both Privy and wagmi to ensure clean state
    try {
      console.log('🔌 Disconnecting from all wallets...');
      wagmiDisconnect();
      await logout();
      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  };

  // Success Popup Component
  const SuccessPopup = () => {
    if (!showSuccessPopup || !txHash) return null;

    const isAvalancheFuji = chainId === 43113;
    const explorerUrl = isAvalancheFuji 
      ? `https://testnet.snowtrace.io/tx/${txHash}`
      : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
          {/* Close button */}
          <button
            onClick={() => setShowSuccessPopup(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Registration Successful! 🎉
            </h3>
            
            <p className="text-gray-600">
              Your user has been successfully registered on the encrypted network.
            </p>

            {/* Transaction Hash */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 mb-1">Transaction Hash:</div>
              <div className="font-mono text-xs text-gray-700 break-all">
                {txHash}
              </div>
            </div>

            {/* Explorer Link */}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Snowtrace
              </a>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (authenticated && user) {
    return (
      <>
        <SuccessPopup />
        <div className="flex flex-col items-center gap-4 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
        <div className="text-purple-200 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Connected as {user.email?.address || user.phone?.number || 'User'}
        </div>
        
        {wallets.length > 0 && (
          <div className="text-sm text-gray-300 w-full">
            <div className="font-medium mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Active Wallet 
              {wallets.length > 1 && (
                <span className="text-xs text-orange-400 ml-2">
                  ({wallets.length} connected)
                </span>
              )}
            </div>
            
            {/* Show the actual active wallet (wagmi's account) */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-lg">
              <div className="font-mono text-xs mb-2 text-gray-100">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No Active Wallet'}
              </div>
              
              {/* Show wallet sync status */}
              {privyWalletAddress && wagmiAddress ? (
                privyWalletAddress.toLowerCase() !== wagmiAddress.toLowerCase() ? (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2 space-y-2">
                    <div>
                      ⚠️ Wallet mismatch detected:
                      <br />
                      <span className="font-mono">Privy: {privyWalletAddress.slice(0, 10)}...</span>
                      <br />
                      <span className="font-mono">Active: {wagmiAddress.slice(0, 10)}...</span>
                    </div>
                    <div className="text-xs">
                      Transactions will use the "Active" wallet.
                    </div>
                                    <button
                  onClick={handleDisconnect}
                  className="w-full px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs hover:bg-red-500/30 border border-red-500/30 transition-colors"
                >
                  🔄 Disconnect & Reconnect to Fix Sync
                </button>
                  </div>
                ) : (
                  <div className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2">
                    ✅ Wallets synced - using this wallet for transactions
                  </div>
                )
              ) : wagmiAddress ? (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                  🔗 Connected via Wagmi only
                </div>
              ) : privyWalletAddress ? (
                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2 space-y-2">
                  <div>⚠️ Privy connected but no active wallet for transactions</div>
                                  <button
                  onClick={handleSyncWallet}
                  className="w-full px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs hover:bg-orange-500/30 border border-orange-500/30 transition-colors"
                >
                  🔄 Sync Wallet for Transactions
                </button>
                </div>
              ) : null}
              
              {/* Registration Status */}
              {walletAddress && (
                <div className="space-y-2">
                  {!isOnCorrectChain ? (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs font-medium">
                        Switch to Avalanche Fuji to check registration
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isCheckingRegistration ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Checking registration...</span>
                        </div>
                      ) : registrationError ? (
                        <div className="flex items-center gap-2 text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs">Error checking registration</span>
                        </div>
                      ) : isRegistered !== undefined ? (
                        <div className="space-y-2">
                          <div className={`flex items-center gap-2 ${isRegistered ? 'text-green-600' : 'text-orange-600'}`}>
                            {isRegistered ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className="text-xs font-medium">
                              {isRegistered ? 'Registered on Avalanche Fuji' : 'Not Registered on Avalanche Fuji'}
                            </span>
                          </div>
                          
                          {/* Proof Status Indicator */}
                          {!isRegistered && !hasProofReady && signature && !isRegistering && (
                            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded text-xs">
                              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              <span>Generating zero-knowledge proof...</span>
                            </div>
                          )}
                          
                          {/* Proof Ready Indicator */}
                          {!isRegistered && hasProofReady && !isConfirmed && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded text-xs">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>Proof ready! Click to submit to blockchain.</span>
                            </div>
                          )}

                          {/* Registration Button - Only show if not registered */}
                          {!isRegistered && (
                            <button
                              onClick={register}
                              disabled={isRegistering || isConfirming}
                              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                isRegistering || isConfirming
                                  ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                                  : hasProofReady 
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {isRegistering || isConfirming ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                  {isConfirming ? 'Confirming Transaction...' : 
                                   hasProofReady ? 'Submitting to Blockchain...' : 
                                   'Signing Message...'}
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                  </svg>
                                  {hasProofReady ? '🚀 Submit to Blockchain' : 'Start Registration'}
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* Success Message - Brief confirmation (detailed popup will show) */}
                          {isConfirmed && !showSuccessPopup && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium">Registration completed!</span>
                            </div>
                          )}
                          
                          {/* Error Message */}
                          {registrationError2 && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium">Registration failed</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        <NetworkSelector />
        
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg font-medium hover:bg-red-500/30 border border-red-500/30 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Disconnect
        </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SuccessPopup />
      <div className="flex flex-col items-center gap-4 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
      <div className="text-gray-200 text-center">
        <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Connect Your Wallet
        </h3>
        <p className="text-sm text-gray-400">
          Connect to the encrypted network for secure, private transactions
        </p>
      </div>
      
      <button
        onClick={handleConnect}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-purple-500/25"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
          />
        </svg>
        {authenticated && privyWalletAddress && !wagmiAddress 
          ? 'Sync Wallet for Transactions' 
          : 'Connect Wallet'
        }
      </button>
    </div>
    </>
  );
}
