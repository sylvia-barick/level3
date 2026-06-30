import React, { useState, useEffect } from 'react';
import { Wallet, LogOut, ShieldCheck, TrendingUp, ArrowUpRight } from 'lucide-react';
import { connectWallet, WalletState } from '../lib/stellar';
import { cn } from '../lib/utils';

interface NavbarProps {
  wallet: WalletState;
  setWallet: (w: WalletState) => void;
  switchTab: (tab: 'supply' | 'borrow' | 'repayment') => void;
  enterDemoMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ wallet, setWallet, switchTab, enterDemoMode }) => {
  const [scrolled, setScrolled] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const address = await connectWallet();
      if (address) {
        setWallet({ address, connected: true });
      }
    } catch (error: any) {
      alert(error.message || "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWallet({ address: null, connected: false });
  };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4 md:px-8 py-3 md:py-5 border-b border-white/10",
      scrolled ? "bg-slate-950/60 backdrop-blur-md shadow-lg" : "bg-transparent border-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-nowrap md:flex-wrap gap-1 md:gap-4 w-full">
        <div className="flex items-center ml-0 md:ml-12 shrink-0">
          <img src="/logo.jpg" alt="StellarYield Logo" className="h-8 w-8 md:h-12 md:w-12 rounded-full object-cover border border-white/20 shadow-lg" />
        </div>

        <div className="hidden md:flex items-center gap-10 font-mono text-xs uppercase tracking-widest text-white/80 font-bold">
          <button onClick={() => switchTab('supply')} className="hover:text-brutal-blue transition-colors flex items-center gap-2 group cursor-pointer">
            <TrendingUp className="w-4 h-4 group-hover:text-brutal-pink transition-colors" />
            Supply
          </button>
          <button onClick={() => switchTab('borrow')} className="hover:text-brutal-blue transition-colors flex items-center gap-2 group cursor-pointer">
            <ArrowUpRight className="w-4 h-4 group-hover:text-brutal-pink transition-colors" />
            Borrow
          </button>
          <button onClick={() => switchTab('repayment')} className="hover:text-brutal-blue transition-colors flex items-center gap-2 group cursor-pointer">
            <ShieldCheck className="w-4 h-4 group-hover:text-brutal-pink transition-colors" />
            Repayment
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
          {wallet.connected ? (
            <div className="flex items-center gap-1.5 md:gap-4 pl-1.5 md:pl-4 border-l border-white/15">
              <div className="flex flex-col items-end pr-1.5 md:pr-4 border-r border-white/15">
                <span className="font-mono text-[6px] md:text-[8px] font-bold text-white/60 uppercase tracking-widest mb-0.5">Wallet</span>
                <span className="text-[10px] md:text-sm font-black text-white tracking-tighter">
                  {wallet.balance ? Number(wallet.balance).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex flex-col items-end pr-1.5 md:pr-0">
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="font-mono text-[5px] md:text-[9px] font-bold text-white/60 uppercase tracking-widest hidden sm:inline-block">Live Status</span>
                </div>
                <span className="text-[7px] md:text-xs font-mono font-bold text-emerald-400 mt-0.5 md:mt-1 uppercase tracking-tighter">
                   Verified
                </span>
              </div>
              <button 
                onClick={handleDisconnect}
                className="w-6 h-6 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/5 p-1 md:p-2 text-white font-bold hover:bg-white/15 transition-all border border-white/10 shadow-lg active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 md:gap-3">
              <button 
                onClick={enterDemoMode}
                className="bg-white/5 text-white border border-white/10 px-2 py-1 md:px-4 md:py-2.5 text-[7px] md:text-xs font-bold uppercase tracking-widest font-mono rounded-xl shadow-lg hover:bg-white/15 hover:border-white/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                DEMO
              </button>
              <button 
                onClick={handleConnect}
                disabled={connecting}
                className={cn(
                  "group relative flex items-center gap-1 md:gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 border-0 px-2.5 md:px-6 py-1 md:py-2.5 rounded-xl font-bold text-[7px] md:text-xs uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-500/25 whitespace-nowrap cursor-pointer",
                  connecting ? "opacity-50 cursor-not-allowed" : "hover:shadow-indigo-500/40 active:scale-95"
                )}
              >
                <Wallet className={cn("w-3 h-3 md:w-4 md:h-4 transition-transform", connecting ? "animate-pulse" : "group-hover:-rotate-12")} />
                {connecting ? "Load..." : "Init Wallet"}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
