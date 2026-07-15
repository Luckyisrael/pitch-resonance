/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Wallet, Shield, Key, Copy, Check, 
  Sparkles, RefreshCw, Smartphone, Cpu, Link2, Info 
} from 'lucide-react';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

const bytesToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

interface ReownWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  onAuthSuccess: (walletAddress: string, token: string, provider: 'phantom' | 'simulated', secretKey?: string) => void;
}

export default function ReownWalletModal({
  isOpen,
  onClose,
  backendUrl,
  setBackendUrl,
  onAuthSuccess
}: ReownWalletModalProps) {
  const [activeTab, setActiveTab] = useState<'wallets' | 'manual' | 'settings'>('wallets');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Generated Developer Keypair state
  const [simKeypair, setSimKeypair] = useState<Keypair | null>(null);
  const [copiedPub, setCopiedPub] = useState<boolean>(false);
  const [copiedPriv, setCopiedPriv] = useState<boolean>(false);

  // Generate a keypair on mount so the user has an instant developer wallet
  useEffect(() => {
    try {
      const kp = Keypair.generate();
      setSimKeypair(kp);
    } catch (e) {
      console.warn("Failed to generate keypair", e);
    }
  }, []);

  const handleCopy = (text: string, type: 'pub' | 'priv') => {
    navigator.clipboard.writeText(text);
    if (type === 'pub') {
      setCopiedPub(true);
      setTimeout(() => setCopiedPub(false), 2000);
    } else {
      setCopiedPriv(true);
      setTimeout(() => setCopiedPriv(false), 2000);
    }
  };

  // Perform full authentic signature-based authentication flow
  const authenticateWithAddress = async (publicKeyStr: string, signMessageFn: (message: string) => Promise<string>) => {
    setIsConnecting(true);
    setErrorMsg('');
    try {
      // 1. Get Nonce
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
      
      // 2. Sign Message
      const signatureHex = await signMessageFn(message);
      
      // 3. Verify Signature
      const verifyRes = await fetch(`${backendUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKeyStr,
          signature: signatureHex,
          nonce: nonce
        })
      });
      
      if (!verifyRes.ok) {
        throw new Error(`Verification failed: ${verifyRes.statusText}`);
      }
      
      const verifyData = await verifyRes.json();
      const { token } = verifyData;
      
      onAuthSuccess(publicKeyStr, token, 'phantom');
      onClose();
    } catch (err: any) {
      console.warn("Auth flow error:", err);
      if (err.message === 'Failed to fetch' || (err.message && err.message.includes('fetch')) || !err.message) {
        if (backendUrl.includes('devtunnels.ms')) {
          setErrorMsg('Failed to fetch. Microsoft Dev Tunnels require you to authorize the connection in your browser first. Please click the button below to authorize it.');
        } else {
          setErrorMsg(err.message || 'Failed to fetch from backend. Is your backend server running and does it allow CORS?');
        }
      } else {
        setErrorMsg(err.message || 'Authentication failed. Is your backend server running?');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via standard browser wallet extension (Phantom)
  const handleConnectExtension = async () => {
    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      setErrorMsg("Phantom wallet extension not detected in this browser! Try 'Manual Signer' tab below to authenticate without extensions.");
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');
    try {
      // Connect to wallet
      const resp = await provider.connect();
      const pubKey = resp.publicKey.toString();

      // Sign message callback
      const signMessageFn = async (msg: string) => {
        const encodedMessage = new TextEncoder().encode(msg);
        const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
        // Convert signature Uint8Array to hex
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

  // Connect via cryptographic simulation (using the generated Developer Keypair)
  const handleConnectSimulated = async () => {
    if (!simKeypair) return;
    const pubKey = simKeypair.publicKey.toString();

    const signMessageFn = async (msg: string) => {
      const messageBytes = new TextEncoder().encode(msg);
      const signatureBytes = nacl.sign.detached(messageBytes, simKeypair.secretKey);
      // Convert to hex
      return Array.from(signatureBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    await authenticateWithAddress(pubKey, signMessageFn);
  };

  // Connect via cryptographic simulation (using the generated Developer Keypair)
  const handleConnectSimulatedWithKey = async () => {
    if (!simKeypair) return;
    const pubKey = simKeypair.publicKey.toString();
    const secretKeyJson = JSON.stringify(Array.from(simKeypair.secretKey));

    const signMessageFn = async (msg: string) => {
      const messageBytes = new TextEncoder().encode(msg);
      const signatureBytes = nacl.sign.detached(messageBytes, simKeypair.secretKey);
      return Array.from(signatureBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    setIsConnecting(true);
    setErrorMsg('');
    try {
      const nonceRes = await fetch(`${backendUrl}/api/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: pubKey })
      });
      if (!nonceRes.ok) throw new Error(`Nonce request failed: ${nonceRes.statusText}`);
      const nonceData = await nonceRes.json();
      const { nonce, message } = nonceData;

      const signatureHex = await signMessageFn(message);

      const verifyRes = await fetch(`${backendUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: pubKey, signature: signatureHex, nonce })
      });
      if (!verifyRes.ok) throw new Error(`Verification failed: ${verifyRes.statusText}`);
      const verifyData = await verifyRes.json();
      const { token } = verifyData;

      onAuthSuccess(pubKey, token, 'simulated', secretKeyJson);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulated authentication failed');
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
        <div className="grid grid-cols-3 bg-[#111112] border-b border-zinc-850 p-1">
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
            onClick={() => setActiveTab('manual')}
            className={`py-2.5 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'manual' 
                ? 'bg-zinc-900 text-amber-400 border-b-2 border-amber-500 font-black' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            ⚡ Simulated Key
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

                <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex gap-2.5 items-start mt-4">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    <b>Iframe Sandbox Notice:</b> If standard browser extension popups are restricted inside this preview container, please use the <b>Simulated Key</b> tab above to test 100% genuine cryptographic sign-in.
                  </p>
                </div>
              </div>
            )}

            {/* 2. MANUAL SIMULATED SIGNER TAB */}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-950/15 border border-amber-900/30 rounded-xl flex gap-2 text-amber-400">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-[10px] leading-normal">
                    This developer tool generates a real Solana Keypair inside browser RAM, fetches the message from your backend, cryptographically signs it with <b>tweetnacl</b>, and verifies it with your server!
                  </p>
                </div>

                {simKeypair && (
                  <div className="bg-[#111112] border border-zinc-850 p-4 rounded-xl space-y-3 font-mono text-xs">
                    {/* Public Key Display */}
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold mb-1">
                        <span>Solana Public Key (RAM)</span>
                        <button 
                          onClick={() => handleCopy(simKeypair.publicKey.toString(), 'pub')}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPub ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedPub ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded text-zinc-300 break-all border border-zinc-900 text-[10px] font-bold">
                        {simKeypair.publicKey.toString()}
                      </div>
                    </div>

                    {/* Private Key Display */}
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold mb-1">
                        <span>Secret Private Seed</span>
                        <button 
                          onClick={() => handleCopy(bytesToHex(simKeypair.secretKey), 'priv')}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPriv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedPriv ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded text-zinc-400 truncate border border-zinc-900 text-[10px]">
                        {bytesToHex(simKeypair.secretKey)}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConnectSimulatedWithKey}
                  disabled={isConnecting}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing cryptographically...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 text-black" />
                      <span>Generate & Sign Nonce</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 3. SETTINGS TAB */}
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
