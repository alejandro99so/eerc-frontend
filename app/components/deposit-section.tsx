'use client';

import { useERC20 } from '../hooks/use-erc20';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRegistrationStatus } from '../hooks/use-registration-status';
import { REGISTRAR_CONTRACT, EERC_CONTRACT, ERC20_TEST } from '../lib/contracts';
import { avalancheFuji } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { processPoseidonEncryption } from '../lib/poseidon';
import { parseUnits } from 'viem';
import { useEncryptedBalance } from '../hooks/use-encrypted-balance';
import EncryptedTransferSection from './encrypted-transfer-section';

export default function DepositSection() {
  const [depositAmount, setDepositAmount] = useState('');
  const [showApproveSuccess, setShowApproveSuccess] = useState(false);
  const [showDepositSuccess, setShowDepositSuccess] = useState(false);
  const { address } = useAccount();

  // Encrypted balance hook
  const {
    encryptedBalance,
    formattedBalance: encryptedFormattedBalance,
    isLoadingBalance: isLoadingEncryptedBalance,
    balanceError: encryptedBalanceError,
    refreshBalance: refreshEncryptedBalance,
    hasBalance: hasEncryptedBalance
  } = useEncryptedBalance();
  
  const {
    balance,
    balanceLoading,
    isOnCorrectChain,
    faucetAmount,
    allowance,
    decimals,
    checkAllowanceSufficient,
    handleApproveTokens,
    isApproving,
    approveError,
    isApproveConfirmed,
    approveHash
  } = useERC20();

  // Check if user is registered
  const { 
    isRegistered, 
    isLoading: isCheckingRegistration,
    isOnCorrectChain: isRegistrationOnCorrectChain 
  } = useRegistrationStatus(address);

  // Get user's public key from registrar contract
  const { 
    data: userPublicKey,
    isLoading: isLoadingPublicKey,
    error: publicKeyError
  } = useReadContract({
    address: REGISTRAR_CONTRACT.address,
    abi: REGISTRAR_CONTRACT.abi,
    functionName: 'getUserPublicKey',
    args: address ? [address] : undefined,
    query: {
      enabled: isRegistered && isRegistrationOnCorrectChain && !!address
    }
  });

  // Deposit to EERC contract
  const { 
    writeContract: depositTokens, 
    data: depositHash, 
    isPending: isDepositPending, 
    error: depositError 
  } = useWriteContract();

  // Wait for deposit transaction
  const { 
    isLoading: isDepositConfirming, 
    isSuccess: isDepositConfirmed 
  } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const hasTokens = parseFloat(balance) > 0;
  const hasAllowance = depositAmount ? checkAllowanceSufficient(depositAmount) : false;
  const hasPublicKey = userPublicKey && userPublicKey.length === 2;
  const isProcessing = isApproving || isDepositPending || isDepositConfirming;

  const handleDepositClick = async () => {
    if (!hasAllowance) {
      // First approve the tokens
      try {
        await handleApproveTokens(depositAmount);
      } catch (error) {
        console.error('Failed to approve tokens:', error);
      }
    } else {
      // User has allowance and public key, proceed with deposit
      if (!userPublicKey || userPublicKey.length !== 2) {
        console.error('❌ Public key not available for deposit');
        return;
      }
      const depositAmountBigInt = BigInt(depositAmount.toString());
      // I need below to get public key from the user from the registration contract
      const publicKeyBigInt = [
        BigInt(userPublicKey[0]!.toString()), 
        BigInt(userPublicKey[1]!.toString())
      ];
      console.log("Public key BigInt: ", publicKeyBigInt)
      const {
        ciphertext: amountCiphertext,
        nonce: amountNonce,
        authKey: amountAuthKey,
      } = processPoseidonEncryption([depositAmountBigInt], publicKeyBigInt);
      // Format amountPCT as [ciphertext (5 elements), authKey (2 elements), nonce (1 element)] = 7 elements total
      const amountPCT: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
        ...amountCiphertext,
        ...amountAuthKey,
        amountNonce
    ] as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    
        console.log('🔐 Ready to deposit with public key:', {
          amount: depositAmount,
          balance: balance,
          allowance: allowance,
          decimals: decimals,
          hasAllowance: hasAllowance,
          userPublicKey: publicKeyBigInt.map(k => k.toString()),
          amountPCT: amountPCT.map(x => x.toString()),
          timestamp: new Date().toISOString()
        });

        // Call EERC contract deposit function
        try {
          console.log('💾 Calling EERC contract deposit...');
          
          // Convert deposit amount to wei with token decimals
          const depositAmountWei = parseUnits(depositAmount, decimals || 18);
          
          await depositTokens({
            address: EERC_CONTRACT.address,
            abi: EERC_CONTRACT.abi,
            functionName: 'deposit',
            args: [
              depositAmountWei, // amount in wei
              ERC20_TEST.address, // testERC20Address  
              amountPCT // encrypted amount array
            ],
            chainId: avalancheFuji.id,
          });
          
          console.log('✅ Deposit transaction submitted!');
        } catch (error) {
          console.error('❌ Error calling deposit:', error);
        }
    }
  };

  // Show success message when approval is confirmed
  useEffect(() => {
    if (isApproveConfirmed) {
      setShowApproveSuccess(true);
      setTimeout(() => {
        setShowApproveSuccess(false);
      }, 5000); // Hide after 5 seconds
    }
  }, [isApproveConfirmed]);

  // Show success message when deposit is confirmed
  useEffect(() => {
    if (isDepositConfirmed) {
      setShowDepositSuccess(true);
      // Clear the deposit amount after successful deposit
      setDepositAmount('');
      setTimeout(() => {
        setShowDepositSuccess(false);
      }, 8000); // Hide after 8 seconds
      
      // Refresh encrypted balance after successful deposit
      setTimeout(() => {
        refreshEncryptedBalance();
      }, 2000); // Wait 2 seconds for blockchain to update
    }
  }, [isDepositConfirmed, refreshEncryptedBalance]);

  if (!isOnCorrectChain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <svg className="w-6 h-6 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-orange-200 font-medium">Network Required</p>
            <p className="text-orange-300/80 text-sm">Please switch to Avalanche Fuji to access deposits</p>
          </div>
        </div>
      </div>
    );
  }

  if (balanceLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <div>
            <p className="text-blue-200 font-medium">Checking Balance</p>
            <p className="text-blue-300/80 text-sm">Loading your token balance...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasTokens) {
    return (
      <div className="space-y-6">
        {/* No Tokens Warning */}
        <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-200 mb-2">
                No TEST Tokens Found
              </h3>
              <p className="text-yellow-300/80 text-sm mb-4 leading-relaxed">
                You need TEST tokens to make encrypted deposits. These tokens are required for interacting with the eERC protocol and testing encrypted transactions.
              </p>
              
              <div className="bg-yellow-500/5 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-yellow-200 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  How to get TEST tokens:
                </h4>
                <ol className="text-xs text-yellow-300/70 space-y-1 ml-6 list-decimal">
                  <li>Go to the "Test Tokens" section above</li>
                  <li>Click "Claim {faucetAmount} TEST" button (if available)</li>
                  <li>Wait for transaction confirmation</li>
                  <li>Return here to start making encrypted deposits</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Preview */}
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-purple-200 text-sm font-medium">What you can do with deposits:</span>
          </div>
          <ul className="text-xs text-purple-300/80 space-y-1 ml-7">
            <li>• Create encrypted balances with zero-knowledge proofs</li>
            <li>• Make private transfers without revealing amounts</li>
            <li>• Withdraw tokens back to your wallet securely</li>
            <li>• Experience cutting-edge blockchain privacy technology</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Balance Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Available Balance
            </span>
          </div>
          <div className="text-xl font-bold text-green-400">
            {balance} <span className="text-sm font-normal text-gray-300">TEST</span>
          </div>
        </div>

        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Approved Allowance
            </span>
          </div>
          <div className="text-xl font-bold text-purple-400">
            {allowance} <span className="text-sm font-normal text-gray-300">TEST</span>
          </div>
        </div>

        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Encrypted Balance
            </span>
            {encryptedBalanceError && (
              <button
                onClick={refreshEncryptedBalance}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                disabled={isLoadingEncryptedBalance}
              >
                Refresh
              </button>
            )}
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {isLoadingEncryptedBalance ? (
              <span className="text-sm text-emerald-300">Decrypting...</span>
            ) : encryptedBalanceError ? (
              <span className="text-sm text-red-400">Error</span>
            ) : (
              <>
                {encryptedFormattedBalance} <span className="text-sm font-normal text-gray-300">Encrypted</span>
              </>
            )}
          </div>
          {encryptedBalanceError && (
            <p className="text-xs text-red-400 mt-1">{encryptedBalanceError}</p>
          )}
        </div>
      </div>

      {/* Deposit Interface */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          <span className="text-gray-200 font-medium">Make Encrypted Deposit</span>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Deposit Amount
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min="0"
              max={balance}
              step="0.001"
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-colors"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <span className="text-xs text-gray-400">TEST</span>
              <button
                onClick={() => setDepositAmount(balance)}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
            <span>Minimum: 0.001 TEST</span>
            <span>Available: {balance} TEST</span>
          </div>
          
          {/* Allowance Status */}
          {depositAmount && (
            <div className={`mt-3 p-2 rounded-lg text-xs ${
              hasAllowance 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {hasAllowance ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
                <span>
                  {hasAllowance 
                    ? `✅ Allowance sufficient (${allowance} TEST approved)`
                    : `⚠️ Insufficient allowance - Need approval for ${depositAmount} TEST`
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Approve/Deposit Button */}
        <button
          onClick={handleDepositClick}
          disabled={
            !depositAmount || 
            parseFloat(depositAmount) <= 0 || 
            parseFloat(depositAmount) > parseFloat(balance) ||
            !hasPublicKey ||
            isProcessing
          }
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            !depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > parseFloat(balance) || !hasPublicKey || isProcessing
              ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
              : !hasAllowance
              ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg hover:shadow-orange-500/25'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-purple-500/25'
          }`}
        >
          {isApproving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Approving tokens...
            </>
          ) : (isDepositPending || isDepositConfirming) ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {isDepositPending ? 'Submitting deposit...' : 'Confirming transaction...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                  !hasPublicKey
                    ? "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z"
                    : !hasAllowance 
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                } />
              </svg>
              {!hasPublicKey
                ? 'Missing Public Key'
                : !depositAmount || parseFloat(depositAmount) <= 0 
                ? 'Enter Amount'
                : parseFloat(depositAmount) > parseFloat(balance)
                ? 'Insufficient Balance'
                : !hasAllowance
                ? `Approve ${depositAmount} TEST`
                : `🔐 Deposit ${depositAmount} TEST`
              }
            </>
          )}
        </button>
      </div>

      {/* Approve Success Message */}
      {showApproveSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-green-200 font-medium text-sm">Approval Successful! ✅</p>
              <p className="text-green-300/80 text-xs mt-1">
                Tokens approved for spending. You can now deposit. Transaction: {approveHash?.slice(0, 10)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Success Message */}
      {showDepositSuccess && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2m0 0l2 2m-2-2l-2-2m2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2m8-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <div>
              <p className="text-purple-200 font-medium text-sm">🔐 Encrypted Deposit Successful! ✅</p>
              <p className="text-purple-300/80 text-xs mt-1">
                Your tokens have been deposited with zero-knowledge encryption. Transaction: {depositHash?.slice(0, 10)}...
              </p>
              {/* Snowtrace link for Avalanche Fuji */}
              {depositHash && (
                <a 
                  href={`https://testnet.snowtrace.io/tx/${depositHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-xs underline mt-1 inline-block"
                >
                  View on Snowtrace →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Error */}
      {approveError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-200 font-medium text-sm">Approval Failed</p>
              <p className="text-red-300/80 text-xs mt-1">
                Unable to approve tokens. Please try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Error */}
      {depositError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-200 font-medium text-sm">Deposit Failed</p>
              <p className="text-red-300/80 text-xs mt-1">
                Unable to process encrypted deposit. Please try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-200 text-sm font-medium">Two-Step Process</span>
        </div>
        <div className="text-xs text-blue-300/80 space-y-1">
          <p>• <strong>Step 1:</strong> Approve tokens for the eERC contract to spend</p>
          <p>• <strong>Step 2:</strong> Deposit tokens to create encrypted balance</p>
          <p>• Your deposit will be encrypted using zero-knowledge proofs</p>
          <p>• Balance amounts are hidden from public view</p>
          <p>• Current allowance: {allowance} TEST approved for spending</p>
        </div>
      </div>

      {/* Encrypted Transfer Section - Only show if user has encrypted balance */}
      <EncryptedTransferSection
        encryptedBalance={encryptedBalance}
        hasEncryptedBalance={hasEncryptedBalance}
        formattedEncryptedBalance={encryptedFormattedBalance}
      />
    </div>
  );
}
