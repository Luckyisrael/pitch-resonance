import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wallet, Smartphone } from 'lucide-react';

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
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

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

  const getProvider = (): any => (window as any).solana;

  const bytesToHex = (bytes: Uint8Array) =>
    Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const createSignMessageFn = (provider: any) => async (msg: string) => {
    const encodedMessage = new TextEncoder().encode(msg);
    const result = await provider.signMessage(encodedMessage, 'utf8');
    const sig: Uint8Array = result.signature ?? result;
    return bytesToHex(sig);
  };

  const handleConnectPhantom = async () => {
    const provider = getProvider();
    if (!provider || !provider.isPhantom) {
      setErrorMsg("Phantom wallet extension not detected in this browser.");
      return;
    }
    setIsConnecting(true);
    setErrorMsg('');
    try {
      const resp = await provider.connect();
      await authenticateWithAddress(resp.publicKey.toString(), createSignMessageFn(provider));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign with Phantom.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSolflare = async () => {
    const provider = (window as any).solflare || getProvider();
    if (!provider || provider.isPhantom) {
      setErrorMsg("Solflare wallet extension not detected in this browser.");
      return;
    }
    setIsConnecting(true);
    setErrorMsg('');
    try {
      const resp = await provider.connect();
      const pubKey = (resp.publicKey || resp).toString();
      await authenticateWithAddress(pubKey, createSignMessageFn(provider));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign with Solflare.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-[#141415] border border-zinc-800 shadow-2xl z-10"
      >
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[9px] font-mono tracking-[0.2em] font-black text-amber-400 uppercase block">Authentication</span>
            <h3 className="text-base font-black text-white uppercase tracking-tight">Connect Wallet</h3>
            <div className="w-6 h-[2px] bg-amber-400" />
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Connect your Solana wallet to sign a verification message and enter the arena.
          </p>

          <div className="space-y-px bg-zinc-800">
            <button onClick={handleConnectPhantom} disabled={isConnecting}
              className="flex items-center justify-between p-3.5 bg-[#111112] hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0C0C0D] border border-zinc-800 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black block text-white group-hover:text-amber-300 transition-colors uppercase tracking-tight">Phantom</span>
                  <span className="text-[9px] font-mono text-zinc-500 block">Browser Extension</span>
                </div>
              </div>
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider font-bold">Solana</span>
            </button>

            <button onClick={handleConnectSolflare} disabled={isConnecting}
              className="flex items-center justify-between p-3.5 bg-[#111112] hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0C0C0D] border border-zinc-800 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black block text-white group-hover:text-amber-300 transition-colors uppercase tracking-tight">Solflare</span>
                  <span className="text-[9px] font-mono text-zinc-500 block">Mobile or Extension</span>
                </div>
              </div>
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider font-bold">Multi-Platform</span>
            </button>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[11px] font-mono leading-normal"
            >
              <div><b>Error:</b> {errorMsg}</div>
              {backendUrl.includes('devtunnels.ms') && (
                <div className="pt-2">
                  <a href={backendUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-[9px] uppercase tracking-wider transition-all">
                    Authorize Dev Tunnel
                  </a>
                  <span className="block text-[9px] text-zinc-500 mt-1">
                    Opens the tunnel. Click "Continue", then return here.
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {isConnecting && (
            <div className="p-3 bg-amber-950/10 border border-amber-900/20 text-center space-y-2">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
              <p className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">Signing Message...</p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between">
          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">Solana Devnet</span>
          <span className="text-[8px] font-mono text-zinc-600">Smart Signature Auth</span>
        </div>
      </motion.div>
    </div>
  );
}
