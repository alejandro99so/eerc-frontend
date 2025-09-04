'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage, useChainId } from 'wagmi';
import { REGISTRAR_CONTRACT } from '../lib/contracts';
import { avalancheFuji } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { i0 } from '../lib/crypto-utils';
import { Base8, subOrder, mulPointEscalar } from "@zk-kit/baby-jubjub";
import { formatPrivKeyForBabyJub } from "maci-crypto";
import { poseidon3 } from "poseidon-lite";
import * as snarkjs from 'snarkjs';

export function useRegistration() {
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { address } = useAccount();
  const { signMessage, data: signature, isPending: isSigning, error: signError } = useSignMessage();
  const chainId = useChainId();
  const [isPreparingProof, setIsPreparingProof] = useState(false);
  const [proofError, setProofError] = useState<Error | null>(null);
  
  // Store the generated proof to use later when user clicks register
  const [generatedProof, setGeneratedProof] = useState<any>(null);
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Log signature and generate private key when signature becomes available
  useEffect(() => {
    if (signature && address) {
      console.log('🔐 Signature:', signature);
      
      const handleProofGeneration = async () => {
        try {
          const privateKey = i0(signature);
          console.log('🗝️  Private Key:', privateKey.toString());

          // Format private key for BabyJubJub
          const formattedPrivateKey = formatPrivKeyForBabyJub(privateKey) % subOrder;
          console.log('🔧 Private key (formatted):', formattedPrivateKey.toString());

          const publicKey = mulPointEscalar(Base8, formattedPrivateKey).map((x) => BigInt(x)) as [bigint, bigint];
          console.log("Public key X:", publicKey[0].toString());
          console.log("Public key Y:", publicKey[1].toString());

          const _chainId = chainId.toString();
          console.log("Chain ID:", chainId.toString());
          console.log("Address:", address);
          
          const registrationHash = poseidon3([
              BigInt(_chainId),
              formattedPrivateKey,
              BigInt(address),
          ]);
          
          console.log("Registration Hash:", registrationHash.toString());

          // Generate zero-knowledge proof
          console.log('🔐 Generating zero-knowledge proof...');
          
          try {
            const inputs = {
              SenderPrivateKey: formattedPrivateKey,
              SenderPublicKey: publicKey,
              SenderAddress: BigInt(address),
              ChainID: BigInt(chainId),
              RegistrationHash: registrationHash,
            };

            console.log('📋 Circuit inputs:', inputs);
            console.log('📁 Loading circuit files...');

            // Generate proof using snarkjs
            const wasmPath = '/circuits/RegistrationCircuit.wasm';
            const zkeyPath = '/circuits/RegistrationCircuit.groth16.zkey';
            
            console.log('📁 WASM path:', wasmPath);
            console.log('🔑 ZKey path:', zkeyPath);

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
              inputs,
              wasmPath,
              zkeyPath
            );

            console.log('✅ Proof generated successfully!');
            console.log('🔐 Proof:', proof);
            console.log('📊 Public signals:', publicSignals);

            // Format proof for contract
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
                if (signals.length !== 5) {
                  throw new Error(`Expected 5 public signals, got ${signals.length}`);
                }
                return [signals[0], signals[1], signals[2], signals[3], signals[4]] as const;
              })()
            };

            console.log('🎯 Formatted proof for contract:', formattedProof);

            // Store the proof for later use when user clicks register
            setGeneratedProof(formattedProof);
            console.log('✅ Proof ready! User can now click "Register" to submit to blockchain.');


          } catch (proofError) {
            console.error('❌ Error generating proof:', proofError);
            console.log('💡 Make sure circuit files are available:');
            console.log('   - public/circuits/RegistrationCircuit.wasm');
            console.log('   - public/circuits/RegistrationCircuit.zkey');
            console.log('   Copy them from your Hardhat project zkit/artifacts/ directory');
          }

        } catch (error) {
          console.error('❌ Error in proof generation flow:', error);
        }
      };

      handleProofGeneration();
    }
  }, [signature, address, chainId]);

  const register = async () => {
    if (!address) {
      console.error('❌ No wallet connected');
      return;
    }

    // If we already have a proof, submit it to the blockchain
    if (generatedProof) {
      console.log('🚀 SUBMITTING REGISTRATION TO BLOCKCHAIN');
      console.log('📍 Contract Address:', REGISTRAR_CONTRACT.address);
      console.log('🌐 Target Network:', avalancheFuji.name, '(Chain ID:', avalancheFuji.id, ')');
      console.log('👤 User Address:', address);
      
      // Network validation
      if (chainId !== avalancheFuji.id) {
        console.error('❌ Wrong network! Please switch to Avalanche Fuji');
        setProofError(new Error('Please switch to Avalanche Fuji network'));
        return;
      }
      
      try {
        console.log('📤 Submitting proof to contract...');
        await writeContract({
          address: REGISTRAR_CONTRACT.address,
          abi: REGISTRAR_CONTRACT.abi,
          functionName: 'register',
          args: [generatedProof],
          chainId: avalancheFuji.id,
        });
        
        console.log('✅ Registration submitted to blockchain!');
        
      } catch (err) {
        console.error('❌ Registration submission error:', err);
        setProofError(err as Error);
      }
      
      return;
    }

    // If no proof yet, start the signature process
    console.log('🔥 STARTING REGISTRATION PROCESS');
    console.log('📍 Contract Address:', REGISTRAR_CONTRACT.address);
    console.log('🌐 Target Network:', avalancheFuji.name, '(Chain ID:', avalancheFuji.id, ')');
    console.log('👤 User Address:', address);
    
    try {
      setIsPreparingProof(true);
      setProofError(null);
      
      // Create the message to sign
      const message = `eERC\nRegistering user with\n Address:${address.toLowerCase()}`;
      
      console.log('📝 Requesting signature for message:', message);
      console.log('⚠️  This will prompt you to sign a message');
      
      // Sign the message (this will trigger proof generation in useEffect)
      await signMessage({ message });
      
      console.log('✅ Message signed successfully - generating proof...');
      
    } catch (err) {
      console.error('❌ Registration error:', err);
      setProofError(err as Error);
    } finally {
      setIsPreparingProof(false);
    }
  };

  // Combined loading state for UI
  const isPending = isPreparingProof || isWritePending || isSigning;
  
  // Combined error state
  const error = proofError || writeError || signError;

  return {
    register,
    isPending,
    isPreparingProof: isSigning,
    isConfirming,
    isConfirmed,
    error,
    hash,
    signature,
    generatedProof,
    hasProofReady: !!generatedProof
  };
}
