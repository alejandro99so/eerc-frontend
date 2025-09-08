'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useSignMessage } from 'wagmi'
import { EERC_CONTRACT, ERC20_TEST, REGISTRAR_CONTRACT } from '../lib/contracts'
import { avalancheFuji } from 'wagmi/chains'
import { decryptEGCTBalance, decryptPCT, deriveKeysFromUser, getDecryptedBalance, i0 } from '../lib/balances/balances'
import { formatUnits } from 'viem'
import { formatPrivKeyForBabyJub } from "maci-crypto";
import { Base8, subOrder, mulPointEscalar } from "@zk-kit/baby-jubjub";
import { ethers } from 'ethers'

export function useEncryptedBalance() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  
  const [encryptedBalance, setEncryptedBalance] = useState<bigint | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [lastBalanceCheck, setLastBalanceCheck] = useState<number>(0)

  // Read encrypted balance from contract
  const { data: balanceData, isLoading: isContractLoading, error: contractError, refetch: refetchBalance } = useReadContract({
    address: EERC_CONTRACT.address,
    abi: EERC_CONTRACT.abi,
    functionName: 'getBalanceFromTokenAddress',
    args: address ? [address, ERC20_TEST.address] : undefined,
    enabled: Boolean(address && isConnected),
    chainId: avalancheFuji.id,
  })

  const { data: publicKeyData, isLoading: isPublicKeyLoading, error: publicKeyError, refetch: refetchPublicKey } = useReadContract({
    address: REGISTRAR_CONTRACT.address,
    abi: REGISTRAR_CONTRACT.abi,
    functionName: 'getUserPublicKey',
    args: address ? [address] : undefined,
    chainId: avalancheFuji.id,
  })

  useEffect(() => {
    if (publicKeyData && !isPublicKeyLoading && address) {
      console.log('🔓 Public key data:', publicKeyData)
    }
  }, [publicKeyData, isPublicKeyLoading, address])

  // Function to decrypt balance
  const decryptBalance = async () => {
    if (!address || !balanceData || !signMessageAsync) {
      console.log('❌ Missing requirements for balance decryption')
      return
    }

    setIsLoadingBalance(true)
    setBalanceError(null)

    try {
      console.log('🔓 Starting balance decryption...')
      console.log('📊 Raw balance data:', balanceData)

      // Create the message to sign
      const message = `eERC\nRegistering user with\n Address:${address.toLowerCase()}`;
      const signature = await signMessageAsync({ message })
      console.log('🔑 Signature:', signature)

      const privateKey = i0(signature);
      console.log('🗝️  Private Key:', privateKey.toString());
      const formattedPrivateKey = formatPrivKeyForBabyJub(privateKey) % subOrder;
      console.log('🔧 Private key (formatted):', formattedPrivateKey.toString());
      const publicKey = mulPointEscalar(Base8, formattedPrivateKey).map((x) => BigInt(x)) as [bigint, bigint];
      console.log("Public key X:", publicKey[0].toString());
      console.log("Public key Y:", publicKey[1].toString());
      // Extract balance components from contract data
      const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = balanceData as any[]

      // Format encrypted balance structure
      const encryptedBalance = [
        [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())],
        [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())]
      ]

      console.log('🔒 Encrypted balance components:')
      console.log('  - eGCT:', eGCT)
      console.log('  - nonce:', nonce.toString())
      console.log('  - amountPCTs:', amountPCTs)
      console.log('  - balancePCT:', balancePCT.map((x: any) => x.toString()))
      console.log('  - transactionIndex:', transactionIndex.toString())
      const isEGCTEmpty = eGCT.c1.x === BigInt(0) && eGCT.c1.y === BigInt(0) && eGCT.c2.x === BigInt(0) && eGCT.c2.y === BigInt(0);
      if (isEGCTEmpty) {
        console.log("📋 EGCT is empty (all zeros) - no main encrypted balance found");
        
        // Check amount PCTs to see if there are any transactions
        if (amountPCTs.length > 0) {
            console.log("🔍 Found Amount PCTs, checking transaction history...");
            let totalFromPCTs = BigInt(0);
            
            for (let i = 0; i < amountPCTs.length; i++) {
                const amountPCT = amountPCTs[i];
                
                try {
                    if (amountPCT.pct.some((e: bigint) => e !== BigInt(0))) {
                        const decryptedAmount = await decryptPCT(privateKey, amountPCT.pct.map((x: bigint) => BigInt(x.toString())));
                        console.log(`  - Amount PCT ${i}: ${decryptedAmount[0].toString()} (index: ${amountPCT.index})`);
                        totalFromPCTs += BigInt(decryptedAmount[0]);
                    }
                } catch (error) {
                    console.log(`  - Amount PCT ${i}: Failed to decrypt`);
                }
            }
            
            if (totalFromPCTs > BigInt(0)) {
                const encryptedSystemDecimals = 2;
                console.log(`\n🔒 Total from Amount PCTs: ${formatUnits(totalFromPCTs, encryptedSystemDecimals)} encrypted units`);
            } else {
                console.log("📋 No valid amounts found in PCTs");
            }
        } else {
            console.log("📋 No Amount PCTs found - user has no transaction history");
        }
        
        return;
      }

        // Decrypt EGCT using ElGamal decryption
        console.log("🔐 Decrypting EGCT using ElGamal...");
        const c1: [bigint, bigint] = [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())];
        const c2: [bigint, bigint] = [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())];
        
        console.log("  - EGCT C1:", [c1[0].toString(), c1[1].toString()]);
        console.log("  - EGCT C2:", [c2[0].toString(), c2[1].toString()]);
        
        const egctBalance = decryptEGCTBalance(privateKey, c1, c2);
        console.log("💰 EGCT Balance (raw):", egctBalance.toString());
        
        // Convert to display units (encrypted system uses 2 decimals)
        const encryptedSystemDecimals = 2;
        console.log(`🔒 EGCT Balance: ${formatUnits(egctBalance, encryptedSystemDecimals)} encrypted units`);
        
        // Also decrypt PCTs for comparison
        let totalFromPCTs = BigInt(0);
        // Decrypt balance PCT if it exists
        if (balancePCT.some((e: any) => BigInt(e.toString()) !== BigInt(0))) {
            try {
                const balancePCTArray = balancePCT.map((x: any) => BigInt(x.toString()));
                const decryptedBalancePCT = await decryptPCT(privateKey, balancePCTArray);
                console.log("💰 Balance PCT (decrypted):", decryptedBalancePCT[0].toString());
                totalFromPCTs += BigInt(decryptedBalancePCT[0]);
            } catch (error) {
                console.log("⚠️  Failed to decrypt balance PCT:", error);
            }
        }

        // Decrypt all amount PCTs
        if (amountPCTs.length > 0) {
            console.log("🔍 Decrypting Amount PCTs...");
            for (let i = 0; i < amountPCTs.length; i++) {
                const amountPCT = amountPCTs[i];
                try {
                    if (amountPCT.pct.some((e: bigint) => e !== BigInt(0))) {
                        const decryptedAmount = await decryptPCT(privateKey, amountPCT.pct.map((x: bigint) => BigInt(x.toString())));
                        console.log(`  - Amount PCT ${i}: ${decryptedAmount[0].toString()} (index: ${amountPCT.index})`);
                        totalFromPCTs += BigInt(decryptedAmount[0]);
                    }
                } catch (error) {
                    console.log(`  - Amount PCT ${i}: Failed to decrypt`);
                }
            }
        }
        console.log("\n📊 Balance Summary:");
        console.log(`   EGCT Balance (main): ${ethers.formatUnits(egctBalance, encryptedSystemDecimals)} encrypted units`);
        setEncryptedBalance(egctBalance)

    } catch (error) {
      console.error('❌ Error decrypting balance:', error)
      setBalanceError(error instanceof Error ? error.message : 'Failed to decrypt balance')
    } finally {
      setIsLoadingBalance(false)
    }
  }

  // Auto-decrypt when balance data changes
  useEffect(() => {
    if (balanceData && !isContractLoading && address && !encryptedBalance) {
      decryptBalance()
    }
  }, [balanceData, isContractLoading, address])

  // Manual refresh function
  const refreshBalance = async () => {
    setEncryptedBalance(null)
    await refetchBalance()
  }

  // Format balance for display
  const formattedBalance = encryptedBalance ? formatUnits(encryptedBalance, 2) : '0.00'

  return {
    encryptedBalance,
    formattedBalance,
    isLoadingBalance: isLoadingBalance || isContractLoading,
    balanceError: balanceError || (contractError ? 'Failed to fetch balance' : null),
    refreshBalance,
    decryptBalance,
    lastBalanceCheck,
    hasBalance: encryptedBalance !== null && encryptedBalance > 0n
  }
}
