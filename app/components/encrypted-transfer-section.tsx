'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage } from 'wagmi'
import { EERC_CONTRACT, ERC20_TEST, REGISTRAR_CONTRACT } from '../lib/contracts'
import { avalancheFuji } from 'wagmi/chains'
import { formatUnits, parseUnits } from 'viem'
import { useRegistrationStatus } from '../hooks/use-registration-status'
import { decryptEGCTBalance, i0 } from '../lib/balances'
import { Base8, mulPointEscalar, subOrder } from '@zk-kit/baby-jubjub'
import { formatPrivKeyForBabyJub } from 'maci-crypto'
import { encryptMessage } from '../lib/jub'
import { processPoseidonEncryption } from '../lib/poseidon'
import * as snarkjs from 'snarkjs';

interface EncryptedTransferSectionProps {
  encryptedBalance: bigint | null
  hasEncryptedBalance: boolean
  formattedEncryptedBalance: string
}

export default function EncryptedTransferSection({ 
  encryptedBalance, 
  hasEncryptedBalance, 
  formattedEncryptedBalance 
}: EncryptedTransferSectionProps) {
  const [transferAmount, setTransferAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [showTransferSuccess, setShowTransferSuccess] = useState(false)
  const [isGeneratingProof, setIsGeneratingProof] = useState(false)
  const { signMessageAsync } = useSignMessage()
  
  const { address } = useAccount()

  // Check if user is registered
  const { 
    isRegistered, 
    isLoading: isCheckingRegistration,
    isOnCorrectChain: isRegistrationOnCorrectChain 
  } = useRegistrationStatus(address)

  // Check if recipient is registered
  const { 
    data: isRecipientRegistered,
    isLoading: isCheckingRecipient
  } = useReadContract({
    address: REGISTRAR_CONTRACT.address,
    abi: REGISTRAR_CONTRACT.abi,
    functionName: 'isUserRegistered',
    args: recipientAddress ? [recipientAddress as `0x${string}`] : undefined,
    enabled: Boolean(recipientAddress && recipientAddress.startsWith('0x') && recipientAddress.length === 42),
    chainId: avalancheFuji.id,
  })

  // Get recipient's public key
  const { 
    data: recipientPublicKey,
    isLoading: isLoadingRecipientPublicKey,
    error: recipientPublicKeyError
  } = useReadContract({
    address: REGISTRAR_CONTRACT.address,
    abi: REGISTRAR_CONTRACT.abi,
    functionName: 'getUserPublicKey',
    args: recipientAddress ? [recipientAddress as `0x${string}`] : undefined,
    enabled: Boolean(recipientAddress && isRecipientRegistered),
    chainId: avalancheFuji.id,
  })

  // Get Auditor's public key
  const { 
    data: auditorPublicKey,
    isLoading: isLoadingAuditorPublicKey,
    error: auditorPublicKeyError
  } = useReadContract({
    address: EERC_CONTRACT.address,
    abi: EERC_CONTRACT.abi,
    functionName: 'auditorPublicKey',
    chainId: avalancheFuji.id,
  })

  // Get Token Id
  const { 
    data: tokenId,
    isLoading: isLoadingTokenId,
    error: tokenIdError
  } = useReadContract({
    address: EERC_CONTRACT.address,
    abi: EERC_CONTRACT.abi,
    functionName: 'tokenIds',
    args: [ERC20_TEST.address as `0x${string}`],
    chainId: avalancheFuji.id,
  })

  // Get Balance of user
  const { 
    data: balanceOfSender,
    isLoading: isLoadingBalanceOfSender,
    error: balanceOfSenderError
  } = useReadContract({
    address: EERC_CONTRACT.address,
    abi: EERC_CONTRACT.abi,
    functionName: 'balanceOf',
    args: (address && tokenId) ? [address as `0x${string}`, tokenId as bigint] : undefined,
    chainId: avalancheFuji.id,
  })

  // Transfer transaction
  const { 
    writeContract: executeTransfer, 
    data: transferHash, 
    isPending: isTransferPending, 
    error: transferError 
  } = useWriteContract()

  // Wait for transfer transaction
  const { 
    isLoading: isTransferConfirming, 
    isSuccess: isTransferConfirmed 
  } = useWaitForTransactionReceipt({
    hash: transferHash,
  })

  // Show success message when transfer is confirmed
  useEffect(() => {
    if (isTransferConfirmed) {
      setShowTransferSuccess(true)
      setTransferAmount('')
      setRecipientAddress('')
      setTimeout(() => {
        setShowTransferSuccess(false)
      }, 8000) // Hide after 8 seconds
    }
  }, [isTransferConfirmed])

  const isValidAmount = transferAmount && parseFloat(transferAmount) > 0
  const isValidRecipient = recipientAddress && recipientAddress.startsWith('0x') && recipientAddress.length === 42
  const hasValidRecipient = isValidRecipient && isRecipientRegistered && recipientPublicKey
  const isProcessing = isGeneratingProof || isTransferPending || isTransferConfirming

  const privateTransfer = async (
    senderPublicKey: bigint[],
    senderFormattedPrivateKey: bigint,
    senderBalance: bigint,
    receiverPublicKey: bigint[],
    transferAmount: bigint,
    senderEncryptedBalance: bigint[],
    auditorPublicKey: bigint[],
): Promise<{
    proof: any;
    senderBalancePCT: bigint[];
}> => {
    const senderNewBalance = senderBalance - transferAmount;
    // 1. encrypt the transfer amount with el-gamal for sender
    const { cipher: encryptedAmountSender } = encryptMessage(
        senderPublicKey,
        transferAmount,
    );

    // 2. encrypt the transfer amount with el-gamal for receiver
    const {
        cipher: encryptedAmountReceiver,
        random: encryptedAmountReceiverRandom,
    } = encryptMessage(receiverPublicKey, transferAmount);

    // 3. creates a pct for receiver with the transfer amount
    const {
        ciphertext: receiverCiphertext,
        nonce: receiverNonce,
        authKey: receiverAuthKey,
        encRandom: receiverEncRandom,
    } = processPoseidonEncryption([transferAmount], receiverPublicKey);

    // 4. creates a pct for auditor with the transfer amount
    const {
        ciphertext: auditorCiphertext,
        nonce: auditorNonce,
        authKey: auditorAuthKey,
        encRandom: auditorEncRandom,
    } = processPoseidonEncryption([transferAmount], auditorPublicKey);

    // 5. create pct for the sender with the newly calculated balance
    const {
        ciphertext: senderCiphertext,
        nonce: senderNonce,
        authKey: senderAuthKey,
    } = processPoseidonEncryption([senderNewBalance], senderPublicKey);

    const input = {
        ValueToTransfer: transferAmount,
        SenderPrivateKey: senderFormattedPrivateKey,
        SenderPublicKey: senderPublicKey,
        SenderBalance: senderBalance,
        SenderBalanceC1: senderEncryptedBalance.slice(0, 2),
        SenderBalanceC2: senderEncryptedBalance.slice(2, 4),
        SenderVTTC1: encryptedAmountSender[0],
        SenderVTTC2: encryptedAmountSender[1],
        ReceiverPublicKey: receiverPublicKey,
        ReceiverVTTC1: encryptedAmountReceiver[0],
        ReceiverVTTC2: encryptedAmountReceiver[1],
        ReceiverVTTRandom: encryptedAmountReceiverRandom,
        ReceiverPCT: receiverCiphertext,
        ReceiverPCTAuthKey: receiverAuthKey,
        ReceiverPCTNonce: receiverNonce,
        ReceiverPCTRandom: receiverEncRandom,

        AuditorPublicKey: auditorPublicKey,
        AuditorPCT: auditorCiphertext,
        AuditorPCTAuthKey: auditorAuthKey,
        AuditorPCTNonce: auditorNonce,
        AuditorPCTRandom: auditorEncRandom,
    };


    // Generate proof using snarkjs
    const wasmPath = '/circuits/TransferCircuit.wasm';
    const zkeyPath = '/circuits/TransferCircuit.groth16.zkey';
    
    //const proof = await transferCircuit.generateProof(input);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
      );

    const formattedProof = {
    proofPoints: {
        a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as readonly [bigint, bigint],
        b: [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]
        ] as readonly [readonly [bigint, bigint], readonly [bigint, bigint]],
        c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as readonly [bigint, bigint]
    },
    publicSignals: (() => {
        const signals = publicSignals.map((signal: string) => BigInt(signal));
        if (signals.length !== 32) {
        throw new Error(`Expected 32 public signals, got ${signals.length}`);
        }
        return [signals[0], signals[1], signals[2], signals[3], signals[4], signals[5], signals[6], signals[7], signals[8], signals[9], signals[10], signals[11], signals[12], signals[13], signals[14], signals[15], signals[16], signals[17], signals[18], signals[19], signals[20], signals[21], signals[22], signals[23], signals[24], signals[25], signals[26], signals[27], signals[28], signals[29], signals[30], signals[31]] as const;
    })()
    };
    return {
        proof: formattedProof,
        senderBalancePCT: [...senderCiphertext, ...senderAuthKey, senderNonce],
    };
};

  const handleTransferClick = async () => {
    if (!isValidAmount || !hasValidRecipient || !encryptedBalance) {
      console.error('❌ Invalid transfer parameters')
      return
    }

    if (!auditorPublicKey) {
      console.error('❌ Auditor public key not found')
      return
    }

    setIsGeneratingProof(true)

    try {
      console.log('🔐 Starting encrypted transfer...')
      console.log('📤 Transfer amount:', transferAmount)
      console.log('📬 Recipient:', recipientAddress)
      console.log('🔑 Recipient public key:', recipientPublicKey)

      // For now, we'll implement a simplified version without ZK proof generation
      // In a full implementation, you would:
      // 1. Generate ZK proof for the transfer
      // 2. Include encrypted transfer amount
      // 3. Include recipient's encrypted public key

      // Temporary implementation - console log the transfer details
      console.log('🚀 Transfer details:')
      console.log(`  - From: ${address}`)
      console.log(`  - To: ${recipientAddress}`)
      console.log(`  - Amount: ${transferAmount} encrypted units`)
      console.log(`  - Recipient Public Key X: ${recipientPublicKey![0]}`)
      console.log(`  - Recipient Public Key Y: ${recipientPublicKey![1]}`)



      // I need to generate proof 
      const message = `eERC\nRegistering user with\n Address:${address.toLowerCase()}`;
      const signature = await signMessageAsync({ message })
      const senderPrivateKey = i0(signature);
      const senderFormattedPrivateKey = formatPrivKeyForBabyJub(senderPrivateKey) % subOrder;
      const senderPublicKey = mulPointEscalar(Base8, senderFormattedPrivateKey).map((x) => BigInt(x)) as [bigint, bigint];
      console.log('🔑 Sender Public Key:', senderPublicKey)
      console.log('🔑 Signature:', signature)
      console.log('🔑 Auditor Public Key:', auditorPublicKey);
      console.log('🔑 Token Id:', tokenId);
      console.log('🔑 Balance of Sender:', balanceOfSender);
      const [eGCT, , , ,] = balanceOfSender;
      console.log('🔑 eGCT:', eGCT);
        // Decrypt sender's balance using EGCT
        const c1: [bigint, bigint] = [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())];
        const c2: [bigint, bigint] = [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())];
        console.log('🔑 c1:', c1);
        console.log('🔑 c2:', c2);
        const isEGCTEmpty = c1[0] === BigInt(0) && c1[1] === BigInt(0) && c2[0] === BigInt(0) && c2[1] === BigInt(0);
        if (isEGCTEmpty) {
            console.error("❌ Sender has no encrypted balance to transfer");
            return;
        }
        const egctBalance = decryptEGCTBalance(senderPrivateKey, c1, c2);
        console.log("💰 EGCT Balance (raw):", egctBalance.toString());
        
        // Convert transfer amount to encrypted system units
        const transferAmountBigInt = BigInt(Math.floor(transferAmount * (10 ** 2)));
        console.log("🔑 Transfer Amount:", transferAmountBigInt);

        if (egctBalance < transferAmountBigInt) {
            console.error(`❌ Insufficient balance. Have: ${formatUnits(egctBalance, 2)}, Need: ${transferAmount}`);
            return;
        }

        console.log(`✅ Transfer amount: ${formatUnits(egctBalance, 2)} encrypted units`);
        
        // Prepare data for transfer proof generation
        const senderEncryptedBalance = [c1[0], c1[1], c2[0], c2[1]];
        const receiverPublicKeyArray = [BigInt(recipientPublicKey[0].toString()), BigInt(recipientPublicKey[1].toString())];
        const auditorPublicKeyArray = [BigInt(auditorPublicKey[0].toString()), BigInt(auditorPublicKey[1].toString())];
        const { proof, senderBalancePCT } = await privateTransfer(
            senderPublicKey,
            senderFormattedPrivateKey,
            egctBalance,
            receiverPublicKeyArray,
            transferAmountBigInt,
            senderEncryptedBalance,
            auditorPublicKeyArray
        );


        console.log('🔑 Proof:', proof);
        console.log('🔑 Sender Balance PCT:', senderBalancePCT);
        console.log({
            args: [
              recipientAddress as `0x${string}`,
              tokenId as bigint,
              proof,
              senderBalancePCT as [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
            ],
          })
        await executeTransfer({
            address: EERC_CONTRACT.address,
            abi: EERC_CONTRACT.abi,
            functionName: 'transfer',
            args: [
              recipientAddress as `0x${string}`,
              tokenId as bigint,
              proof,
              senderBalancePCT as [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
            ],
            chainId: avalancheFuji.id,
          });
      // TODO: Generate ZK proof here
      // For now, show an alert that this is not yet implemented
      alert('🚧 Transfer proof generation not yet implemented. Check console for transfer details.')
      setIsGeneratingProof(false)

    } catch (error) {
      console.error('❌ Error during transfer:', error)
      setIsGeneratingProof(false)
    }

   
  }

  // Don't show if user doesn't have encrypted balance
  if (!hasEncryptedBalance || !encryptedBalance || encryptedBalance === 0n) {
    return null
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Encrypted Transfer</h2>
          <p className="text-gray-400 text-sm">Send encrypted tokens privately</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 space-y-6">
        {/* Current Balance Display */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-emerald-300 text-sm">Your Encrypted Balance</span>
            <span className="text-emerald-400 font-bold text-lg">
              {formattedEncryptedBalance} <span className="text-xs font-normal">Encrypted Units</span>
            </span>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="space-y-4">
          {/* Recipient Address Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:opacity-50"
            />
            {/* Recipient Validation */}
            {isValidRecipient && (
              <div className="mt-2 space-y-1">
                {isCheckingRecipient ? (
                  <p className="text-xs text-yellow-400">🔍 Checking registration...</p>
                ) : isRecipientRegistered === false ? (
                  <p className="text-xs text-red-400">❌ Recipient is not registered</p>
                ) : isRecipientRegistered === true ? (
                  <div className="space-y-1">
                    <p className="text-xs text-green-400">✅ Recipient is registered</p>
                    {isLoadingRecipientPublicKey ? (
                      <p className="text-xs text-yellow-400">🔍 Loading public key...</p>
                    ) : recipientPublicKeyError ? (
                      <p className="text-xs text-red-400">❌ Cannot load recipient's public key</p>
                    ) : recipientPublicKey ? (
                      <p className="text-xs text-green-400">✅ Recipient's public key loaded</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Transfer Amount (Encrypted Units)
            </label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              max={formattedEncryptedBalance}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:opacity-50"
            />
            {isValidAmount && parseFloat(transferAmount) > parseFloat(formattedEncryptedBalance) && (
              <p className="text-xs text-red-400 mt-1">❌ Amount exceeds your encrypted balance</p>
            )}
          </div>

          {/* Transfer Button */}
          <button
            onClick={handleTransferClick}
            disabled={
              isProcessing || 
              !isValidAmount || 
              !hasValidRecipient || 
              parseFloat(transferAmount) > parseFloat(formattedEncryptedBalance) ||
              !isRegistered ||
              !isRegistrationOnCorrectChain
            }
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isGeneratingProof ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Generating Proof...</span>
              </>
            ) : isTransferPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Submitting Transfer...</span>
              </>
            ) : isTransferConfirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Confirming Transaction...</span>
              </>
            ) : !isRegistered ? (
              <span>👤 Register First</span>
            ) : !isValidAmount ? (
              <span>Enter Amount</span>
            ) : !isValidRecipient ? (
              <span>Enter Valid Recipient</span>
            ) : !isRecipientRegistered ? (
              <span>Recipient Not Registered</span>
            ) : !hasValidRecipient ? (
              <span>Loading Recipient...</span>
            ) : parseFloat(transferAmount) > parseFloat(formattedEncryptedBalance) ? (
              <span>Insufficient Balance</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l4-4" />
                </svg>
                <span>🔐 Transfer {transferAmount} Encrypted</span>
              </>
            )}
          </button>

          {/* Error Messages */}
          {transferError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">❌ Transfer failed: {transferError.message}</p>
            </div>
          )}

          {/* Success Message */}
          {showTransferSuccess && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-green-400 font-medium">Transfer Successful! ✅</p>
                  <p className="text-green-300 text-sm mt-1">
                    Your encrypted transfer has been confirmed on the blockchain.
                  </p>
                  {transferHash && (
                    <a
                      href={`https://testnet.snowtrace.io/tx/${transferHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-300 text-sm underline hover:text-green-200 mt-1 inline-block"
                    >
                      View on Snowtrace ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-blue-400 font-medium text-sm">Private Transfer Process</h4>
              <ul className="text-blue-300 text-xs mt-1 space-y-1">
                <li>• Recipient must be registered in the system</li>
                <li>• Transfer amounts are encrypted using zero-knowledge proofs</li>
                <li>• Only you and the recipient can see the transfer amount</li>
                <li>• 🚧 ZK proof generation is coming soon</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
