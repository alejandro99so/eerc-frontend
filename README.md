# eERC Protocol Frontend

A privacy-focused encrypted ERC token protocol built on zero-knowledge proofs. This frontend application provides a user interface for registering with the protocol, depositing tokens, and performing private transfers using cryptographic proofs.

## 🌟 Key Features

- **Zero-Knowledge Registration**: Register your identity without revealing private information
- **Encrypted Balances**: All token balances are encrypted using ElGamal encryption
- **Private Transfers**: Transfer tokens without revealing amounts or recipient details
- **Auditable Privacy**: Supports auditor functionality for compliance while maintaining user privacy
- **Multi-Token Support**: Handle multiple ERC20 tokens within the encrypted system

## 🏗️ Architecture Overview

The system uses **Groth16 zero-knowledge proofs** with the following circuits:
- **RegistrationCircuit**: Proves identity ownership without revealing private keys
- **TransferCircuit**: Proves valid transfers while keeping amounts and balances private
- **MintCircuit**: Handles encrypted deposits into the system
- **WithdrawCircuit**: Handles encrypted withdrawals from the system
- **BurnCircuit**: Handles token burning operations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- MetaMask or compatible Web3 wallet
- Access to Avalanche Fuji testnet

### Installation

1. Clone and install dependencies:
```bash
git clone <repository-url>
cd eerc-frontend
npm install
```

2. Ensure circuit files are in place:
```bash
# Circuit files should be located at:
public/circuits/RegistrationCircuit.wasm
public/circuits/RegistrationCircuit.groth16.zkey
public/circuits/TransferCircuit.wasm  
public/circuits/TransferCircuit.groth16.zkey
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## ⚙️ Configuration

### 📍 Contract Addresses

Contract addresses are defined in `constants.json`. To update them:

```json
{
  "EncryptedERC": {
    "contractName": "EncryptedERC", 
    "address": "0x295257d84Ef96A3208703c550B83EE501F137b54",
    "abi": [...]
  },
  "Registrar": {
    "contractName": "Registrar",
    "address": "0x98F23388B93D5FBB374331AAE493277db94E6177", 
    "abi": [...]
  }
}
```

**To replace addresses:**
1. Update the `address` fields in `constants.json`
2. Ensure the ABIs match your deployed contracts
3. The addresses are automatically imported into `app/lib/contracts.ts`

### 🌐 RPC Configuration

RPC endpoints are configured in `app/lib/wagmi-config.ts`:

```typescript
export const config = createConfig({
  chains: [mainnet, sepolia, avalancheFuji],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),           // Uses default RPC
    [sepolia.id]: http(),           // Uses default RPC  
    [avalancheFuji.id]: http(),     // Uses default RPC
  },
})
```

**To replace RPC endpoints:**
1. Import custom RPC URLs:
```typescript
transports: {
  [avalancheFuji.id]: http('https://api.avax-test.network/ext/bc/C/rpc'),
  // Add custom RPCs for other chains
}
```

2. Add new chains by importing from `wagmi/chains` or defining custom chain configs

### 🎯 Circuit Files Setup

The zero-knowledge proof system requires specific circuit files:

**Required files in `public/circuits/`:**
- `RegistrationCircuit.wasm` - Compiled registration circuit
- `RegistrationCircuit.groth16.zkey` - Proving key for registration
- `TransferCircuit.wasm` - Compiled transfer circuit  
- `TransferCircuit.groth16.zkey` - Proving key for transfers

**To update circuit files:**
1. Generate new circuits using your preferred zk-SNARK toolkit
2. Place the `.wasm` and `.zkey` files in `public/circuits/`
3. Update the file paths in the proof generation code if needed

## 🔐 Zero-Knowledge Proof System

### Registration Process

1. **Message Signing**: User signs a deterministic message with their wallet
2. **Private Key Derivation**: A BabyJubJub private key is derived from the signature
3. **Public Key Generation**: The corresponding public key is computed
4. **Proof Generation**: A zero-knowledge proof is created that proves:
   - Knowledge of the private key
   - The public key corresponds to the private key
   - The user controls the Ethereum address
5. **On-Chain Registration**: The proof is submitted to the Registrar contract

**Registration Circuit Inputs:**
```typescript
{
  SenderPrivateKey: bigint,    // BabyJubJub private key
  SenderPublicKey: [bigint, bigint], // BabyJubJub public key
  SenderAddress: bigint,       // Ethereum address  
  ChainID: bigint,            // Blockchain chain ID
  RegistrationHash: bigint    // Poseidon hash of above values
}
```

### Transfer Process  

1. **Balance Decryption**: Sender decrypts their current encrypted balance
2. **Recipient Key Lookup**: Fetches recipient's public key from Registrar
3. **New Balance Encryption**: Encrypts new balances for sender and recipient
4. **Proof Generation**: Creates a zero-knowledge proof that proves:
   - Sender owns the current balance
   - Transfer amount is valid (not exceeding balance)
   - New encrypted balances are correctly computed
   - No tokens are created or destroyed
5. **On-Chain Transfer**: The proof is submitted to the EncryptedERC contract

**Transfer Circuit Public Signals:**
- Nullifier (prevents double-spending)
- New encrypted balance for sender
- New encrypted balance for recipient  
- Transfer amount commitment
- Auditor's encrypted view of the transaction

## 📖 Usage Guide

### 1. Connect Wallet
- Click "Connect Wallet" and select your Web3 wallet
- Ensure you're connected to Avalanche Fuji testnet

### 2. Register Identity
- Click "Sign & Generate Proof" to start registration
- Sign the deterministic message in your wallet
- Wait for zero-knowledge proof generation (~30-60 seconds)
- Click "Register" to submit the proof on-chain

### 3. Get Test Tokens  
- Use the "Mint Test Tokens" section to get testnet tokens
- These will be used for deposits into the encrypted system

### 4. Deposit Tokens
- Approve the EncryptedERC contract to spend your tokens
- Enter deposit amount and click "Deposit"
- Your tokens will be encrypted and added to your private balance

### 5. Transfer Tokens
- Enter recipient address and transfer amount
- The system will automatically:
  - Verify the recipient is registered
  - Generate a zero-knowledge proof
  - Submit the encrypted transfer on-chain
- Both sender and recipient balances remain private

## 🔧 Development

### Project Structure
```
eerc-frontend/
├── app/
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   │   ├── balances/       # Balance encryption/decryption
│   │   ├── contracts.ts    # Contract ABIs and addresses
│   │   ├── wagmi-config.ts # Wallet and RPC configuration
│   │   └── crypto-utils.ts # Cryptographic utilities
│   └── page.tsx           # Main application page
├── public/circuits/       # Zero-knowledge circuit files
└── constants.json        # Contract addresses and ABIs
```

### Key Dependencies
- **Next.js**: React framework
- **wagmi**: Ethereum React hooks
- **snarkjs**: Zero-knowledge proof generation
- **@zk-kit/baby-jubjub**: Elliptic curve cryptography
- **poseidon-lite**: Poseidon hash function
- **maci-crypto**: Additional cryptographic utilities

## 🔍 Troubleshooting

### Common Issues

**"Circuit files not found" error:**
- Ensure `.wasm` and `.zkey` files are in `public/circuits/`
- Check file names match exactly: `RegistrationCircuit.wasm`, etc.

**"Wrong network" error:**
- Switch to Avalanche Fuji testnet in your wallet
- Check that contract addresses match the target network

**Proof generation taking too long:**
- Circuit files may be large - ensure good internet connection
- Consider hosting circuit files on a CDN for production

**Transaction fails:**
- Ensure you're registered before attempting transfers
- Check that recipient is registered 
- Verify you have sufficient encrypted balance

### Development Tips

- Use browser developer console to see detailed proof generation logs
- All cryptographic operations are logged with 🔐 emojis for easy filtering
- Circuit inputs and outputs are logged during proof generation
- Enable verbose logging by setting `console.log` in crypto utility files

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm run start
```

### Environment Considerations
- Ensure circuit files are properly served in production
- Consider using a CDN for large `.zkey` files
- Set up proper RPC endpoints for your target networks
- Update contract addresses to mainnet versions

## 📄 License

This project is part of the eERC protocol ecosystem. Please refer to the main protocol documentation for licensing information.
