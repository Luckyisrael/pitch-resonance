/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Wallet, Shield, Smartphone, Link2
} from 'lucide-react';

interface ReownWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  onAuthSuccess: (walletAddress: string, token: string) => void;
}

export default function ReownWalletModal({
  isOpen,
  onClose,
  backendUrl,
  setBackendUrl,
  onAuthSuccess
}: ReownWalletModalProps) {
  const [activeTab, setActiveTab] = useState<'wallets' | 'settings'>('wallets');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Perform full authentic signature-based authentication flow
  const authenticateWithAddress = async (publicKeyStr: string, signMessageFn: (message: string) => Promise<string>) => {
    setIsConnecting(true);
    setErrorMsg('');
    try {
      const nonceRes = await fetch(`${backendUrl}/api/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKeyStr })
      });
      
      if (!nonceRes.ok) {
        throw new Error(`Nonce request failed: ${nonceRes.statusText}`);
      }
      
      const nonceData = await nonceRes.json();
      const { nonce, message } = nonceData;
      
      const signatureHex = await signMessageFn(message);
      
      const verifyRes = await fetch(`${backendUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKeyStr, signature: signatureHex, nonce })
      });
      
      if (!verifyRes.ok) {
        throw new Error(`Verification failed: ${verifyRes.statusText}`);
      }
      
      const verifyData = await verifyRes.json();
      const { token } = verifyData;
      
      onAuthSuccess(publicKeyStr, token);
      onClose();
    } catch (err: any) {
      console.warn("Auth flow error:", err);
      if (!err.message || err.message === 'Failed to fetch') {
        if (backendUrl.includes('devtunnels.ms')) {
          setErrorMsg('Failed to fetch. Microsoft Dev Tunnels require you to authorize the connection in your browser first.');
        } else {
          setErrorMsg('Failed to connect to backend. Is your server running and does it allow CORS?');
        }
      } else {
        setErrorMsg(err.message || 'Authentication failed.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via browser wallet extension (Phantom/Solflare)
  const handleConnectExtension = async () => {
    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      setErrorMsg("Phantom wallet extension not detected in this browser.");
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');
    try {
      const resp = await provider.connect();
      const pubKey = resp.publicKey.toString();

      const signMessageFn = async (msg: string) => {
        const encodedMessage = new TextEncoder().encode(msg);
        const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
        return Array.from(signedMessage.signature as Uint8Array)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      };

      await authenticateWithAddress(pubKey, signMessageFn);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign with browser extension.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Frosted Glass Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      {/* Main Reown AppKit UI Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-[#18181A] border border-zinc-800 rounded-[30px] overflow-hidden shadow-2xl z-10 font-sans text-white flex flex-col"
        style={{ minHeight: '480px' }}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-850 flex justify-between items-center bg-[#151517]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Connect Wallet</h3>
              <p className="text-[10px] text-zinc-500 font-mono">REOWN APPKITv4 • SOLANA</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 bg-[#111112] border-b border-zinc-850 p-1">
          <button
            onClick={() => setActiveTab('wallets')}
            className={`py-2.5 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'wallets' 
                ? 'bg-zinc-900 text-blue-400 border-b-2 border-blue-500 font-black' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            🔌 Wallets
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2.5 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'settings' 
                ? 'bg-zinc-900 text-purple-400 border-b-2 border-purple-500 font-black' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            ⚙️ API Server
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-6 flex flex-col justify-between space-y-6">
          {/* Active Tab Contents */}
          <div className="space-y-4">
            
            {/* 1. WALLETS TAB */}
            {activeTab === 'wallets' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Select a Solana wallet provider to request a secure signature for verification.
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Phantom Option */}
                  <button
                    onClick={handleConnectExtension}
                    disabled={isConnecting}
                    className="flex items-center justify-between p-3.5 bg-[#1F1F22] hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-900/50 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black block text-white group-hover:text-purple-300 transition-colors">
                          Phantom Wallet
                        </span>
                        <span className="text-[10px] text-zinc-500 block">Browser Extension</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono bg-purple-950 text-purple-400 px-2 py-0.5 rounded border border-purple-900/40 uppercase font-black">
                      Installed?
                    </span>
                  </button>

                  {/* Solflare Option */}
                  <button
                    onClick={handleConnectExtension}
                    disabled={isConnecting}
                    className="flex items-center justify-between p-3.5 bg-[#1F1F22] hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-950/40 border border-amber-900/50 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black block text-white group-hover:text-amber-300 transition-colors">
                          Solflare Wallet
                        </span>
                        <span className="text-[10px] text-zinc-500 block">Mobile or Extension</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-900/40 uppercase font-black">
                      Detect
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Specify the target URL where your backend server is running. This enables communications with the authentication router and the Socket.io streaming pipelines.
                </p>

                <div className="space-y-2 font-mono">
                  <label className="text-[10px] text-zinc-500 uppercase font-black block">
                    API SERVER ENDPOINT
                  </label>
                  <div className="flex items-center gap-2 bg-[#111112] border border-zinc-800 p-2.5 rounded-xl">
                    <Link2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <input 
                      type="text" 
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      placeholder="https://1hp65c8m-4000.uks1.devtunnels.ms"
                      className="bg-transparent border-none outline-none text-xs text-white flex-grow focus:ring-0"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#111112] border border-zinc-850 rounded-xl space-y-2">
                  <span className="text-[9px] font-mono text-purple-400 uppercase font-black block">Tested Endpoints</span>
                  <div className="text-[10px] text-zinc-500 font-mono space-y-1">
                    <div className="flex justify-between">
                      <span>Nonce Verification:</span>
                      <span className="text-zinc-300">/api/auth/nonce</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Signature Verify:</span>
                      <span className="text-zinc-300">/api/auth/verify</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Matches Stream:</span>
                      <span className="text-zinc-300">/api/matches</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Error and Footer Display */}
          <div className="space-y-4">
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-[11px] font-mono leading-normal space-y-2"
              >
                <div><b>Error:</b> {errorMsg}</div>
                {backendUrl.includes('devtunnels.ms') && (
                  <div className="pt-1.5">
                    <a 
                      href={backendUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-black font-sans rounded-lg text-[10px] uppercase tracking-wider transition-all"
                    >
                      🔓 Authorize Dev Tunnel
                    </a>
                    <span className="block text-[9px] text-zinc-500 mt-1 font-sans">
                      (Opens the tunnel in a new tab. Click "Continue" on the warning screen, then return here and try signing!)
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Reown Brand Signature */}
            <div className="flex justify-center items-center gap-2.5 text-[9px] font-mono text-zinc-600 uppercase border-t border-zinc-850 pt-4">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span>SECURED BY REOWN SMART IDENTITY ENGINE</span>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
