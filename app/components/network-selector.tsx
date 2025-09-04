'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { mainnet, sepolia, avalancheFuji } from 'wagmi/chains';
import { useState } from 'react';

const SUPPORTED_NETWORKS = [
  { 
    chain: avalancheFuji, 
    name: 'Avalanche Fuji', 
    color: 'bg-red-500',
    emoji: '🔴',
    recommended: true 
  },
  { 
    chain: sepolia, 
    name: 'Sepolia', 
    color: 'bg-blue-500',
    emoji: '🔵',
    recommended: false 
  },
  { 
    chain: mainnet, 
    name: 'Ethereum', 
    color: 'bg-gray-700',
    emoji: '⚫',
    recommended: false 
  },
];

export default function NetworkSelector() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const currentNetwork = SUPPORTED_NETWORKS.find(n => n.chain.id === chainId);
  
  if (!isConnected) {
    return null;
  }

  const handleNetworkSwitch = (targetChainId: number) => {
    if (targetChainId !== chainId) {
      switchChain({ chainId: targetChainId as typeof avalancheFuji.id | typeof sepolia.id | typeof mainnet.id });
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="w-full p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9-9a9 9 0 00-9 9m9 9v-9a9 9 0 00-9-9" />
          </svg>
          Network
        </h4>
        {currentNetwork?.recommended && (
          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
            Recommended
          </span>
        )}
      </div>
      
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isPending}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
            isPending 
              ? 'border-white/10 bg-white/5 cursor-not-allowed opacity-50'
              : 'border-white/20 hover:border-white/30 bg-white/5 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${currentNetwork?.color || 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-200">
              {currentNetwork ? (
                <>
                  {currentNetwork.emoji} {currentNetwork.name}
                  {currentNetwork.recommended && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded border border-green-500/30">
                      Recommended
                    </span>
                  )}
                </>
              ) : (
                'Unknown Network'
              )}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isPending && (
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            )}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg z-10">
            {SUPPORTED_NETWORKS.map((network) => {
              const isActive = network.chain.id === chainId;
              const isDisabled = isPending;
              
              return (
                <button
                  key={network.chain.id}
                  onClick={() => handleNetworkSwitch(network.chain.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center justify-between p-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    isActive 
                      ? 'bg-green-500/20 text-green-200 border-green-500/30'
                      : isDisabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${network.color}`} />
                    <span className="text-sm font-medium">
                      {network.emoji} {network.name}
                    </span>
                    {network.recommended && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded border border-green-500/30">
                        Recommended
                      </span>
                    )}
                  </div>
                  
                  {isActive && (
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
      
      {currentNetwork && (
        <div className="mt-2 text-xs text-gray-400">
          Chain ID: {currentNetwork.chain.id}
        </div>
      )}
    </div>
  );
}
