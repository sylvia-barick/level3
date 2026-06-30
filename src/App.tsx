import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  Wallet, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  ChevronRight,
  Info,
  History,
  AlertCircle,
  Activity,
  Lock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Navbar } from './components/Navbar';
import { WalletState, fetchTransactions, fetchAccountAge, fetchTransactionsCount, fetchPaymentsCount, server, checkConnection, supplyFunds, borrowFunds, repayFunds, get_balance, get_borrowed, getWalletBalance } from './lib/stellar';
import { ReputationScore, calculateReputation, getMaxBorrowAmount, calculateInterestRate } from './lib/scoring';
import { cn, formatAmount } from './lib/utils';
import VideoBackground from './components/ui/video-bg';

// Mock data for yield history (internal values, axis will be hidden)
const yieldData = [
  { name: 'Monday', yield: 4.2 },
  { name: 'Tuesday', yield: 4.5 },
  { name: 'Wednesday', yield: 4.3 },
  { name: 'Thursday', yield: 4.8 },
  { name: 'Friday', yield: 5.2 },
  { name: 'Saturday', yield: 5.5 },
  { name: 'Sunday', yield: 5.4 },
];

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, connected: false });
  const [reputation, setReputation] = useState<ReputationScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow' | 'repayment'>('supply');
  const [processing, setProcessing] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Protocol State
  const [userBalance, setUserBalance] = useState(0);
  const [borrowedAmount, setBorrowedAmount] = useState(0);
  const [events, setEvents] = useState<{id: string, type: string, status: string, time: string, details?: string}[]>(() => {
    const saved = localStorage.getItem('stellar_events');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('stellar_events', JSON.stringify(events));
  }, [events]);


  useEffect(() => {
    const init = async () => {
      const address = await checkConnection();
      if (address) {
        const balance = await getWalletBalance(address);
        setWallet({ address, connected: true, balance });
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      loadUserData(wallet.address);
    } else {
      setReputation(null);
    }
  }, [wallet.connected, wallet.address]);

  const loadUserData = async (address: string) => {
    if (address === 'DEMO_ACCOUNT') {
      setReputation({
        score: 85,
        tier: 'Elite',
        factors: {
          accountAge: 45,
          transactionCount: 40,
          daysOld: 120,
          totalTxs: 88
        }
      });
      setUserBalance(1250.50);
      setBorrowedAmount(150.00);
      return;
    }
    setLoading(true);
    try {
      const createdAt = await fetchAccountAge(address);
      const txCount = await fetchTransactionsCount(address);
      const paymentCount = await fetchPaymentsCount(address);
      const score = await calculateReputation(createdAt, txCount, paymentCount);
      setReputation(score);

      // Refresh wallet balance
      const walletBalance = await getWalletBalance(address);
      setWallet(prev => ({ ...prev, balance: walletBalance }));

      // Fetch on-chain vault state
      const balance = await get_balance(address);
      const borrowed = await get_borrowed(address);
      setUserBalance(Number(balance));
      setBorrowedAmount(Number(borrowed));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = (type: string, status: string = 'SUCCESS', details?: string) => {
    const newEvent = {
      id: Math.random().toString(36).substring(7).toUpperCase(),
      type,
      status,
      details,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 10));
  };

  const enterDemoMode = () => {
    setIsDemo(true);
    setWallet({ address: 'DEMO_ACCOUNT', connected: true });
    loadUserData('DEMO_ACCOUNT');
  };

  const handleSupply = async (overrideAmount?: string) => {
    if (!wallet.connected || !wallet.address) return;
    const finalAmount = overrideAmount || amount;
    if (!finalAmount || isNaN(Number(finalAmount))) {
      setError("Please enter a valid amount");
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      if (wallet.address === 'DEMO_ACCOUNT') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const txHash = Math.random().toString(36).substring(7).toUpperCase();
        setLastTxId(txHash);
        addEvent('DEPOSIT_INIT', 'SUCCESS', `${finalAmount} XLM`);
      } else {
        const txHash = await supplyFunds(wallet.address, finalAmount);
        setLastTxId(txHash);
        addEvent('CONTRACT_CALL', 'SUCCESS', `+${finalAmount} XLM`);
        
        // Refresh balance from contract
        const balance = await get_balance(wallet.address);
        setUserBalance(Number(balance));
      }
      setAmount('');
    } catch (e: any) {
      if (e.message?.includes('CONTRACT_ID') || e.message?.includes('Contract')) {
        setError("Deployment required. Using a placeholder ID. Try 'Demo Mode' in the navbar to test UI flow.");
      } else {
        setError(e.message || "Supply failed");
      }
      addEvent('TRX_FAILED', 'ERROR');
    } finally {
      setProcessing(false);
      setTimeout(() => setLastTxId(null), 10000);
    }
  };

  const handleBorrow = async () => {
    if (!wallet.connected || !wallet.address || !reputation) return;
    
    const limit = getMaxBorrowAmount(reputation.score);
    if (!amount || isNaN(Number(amount))) {
      setError("Please enter a valid amount");
      return;
    }
    
    if (Number(amount) > limit) {
      setError(`Amount exceeds your reputation-based limit of ${limit} XLM`);
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      if (wallet.address === 'DEMO_ACCOUNT') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const txHash = Math.random().toString(36).substring(7).toUpperCase();
        setLastTxId(txHash);
        addEvent('LOAN_ISSUED', 'SUCCESS', `${amount} XLM`);
      } else {
        const txHash = await borrowFunds(wallet.address, amount);
        setLastTxId(txHash);
        addEvent('BORROW_CALL', 'SUCCESS', `${amount} XLM`);

        // Refresh balance and borrowed from contract
        const balance = await get_balance(wallet.address);
        const borrowed = await get_borrowed(wallet.address);
        setUserBalance(Number(balance));
        setBorrowedAmount(Number(borrowed));
      }
      setAmount('');
    } catch (e: any) {
      if (e.message?.includes('CONTRACT_ID') || e.message?.includes('Contract')) {
        setError("Deployment required. Try 'Demo Mode' to see the full borrowing flow.");
      } else {
        setError(e.message || "Borrow failed");
      }
      addEvent('TRX_FAILED', 'ERROR');
    } finally {
      setProcessing(false);
      setTimeout(() => setLastTxId(null), 10000);
    }
  };

  const handleRepay = async (overrideAmount?: string) => {
    if (!wallet.connected || !wallet.address) return;
    const finalAmount = overrideAmount || amount;
    if (!finalAmount || isNaN(Number(finalAmount))) {
      setError("Please enter a valid amount");
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      if (wallet.address === 'DEMO_ACCOUNT') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const txHash = Math.random().toString(36).substring(7).toUpperCase();
        setLastTxId(txHash);
        addEvent('REPAY_COMPLETE', 'SUCCESS', `${finalAmount} XLM`);
      } else {
        const txHash = await repayFunds(wallet.address, finalAmount);
        setLastTxId(txHash);
        addEvent('CONTRACT_REPAY', 'SUCCESS', `-${finalAmount} XLM`);

        // Refresh state
        const balance = await get_balance(wallet.address);
        const borrowed = await get_borrowed(wallet.address);
        setUserBalance(Number(balance));
        setBorrowedAmount(Number(borrowed));
      }
      setAmount('');
    } catch (e: any) {
      if (e.message?.includes('CONTRACT_ID') || e.message?.includes('Contract')) {
        setError("Deployment required. Try 'Demo Mode' to see the full repayment flow.");
      } else {
        setError(e.message || "Repay failed");
      }
      addEvent('TRX_FAILED', 'ERROR');
    } finally {
      setProcessing(false);
      setTimeout(() => setLastTxId(null), 10000);
    }
  };

  const switchTab = (tab: 'supply' | 'borrow' | 'repayment') => {
    setActiveTab(tab);
    setAmount('');
    setError(null);
  };

  const handleSimulatedTx = async (type: string) => {
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setProcessing(false);
    alert(`${type.toUpperCase()} process simulated.`);
  };
  const getExplorerUrl = (txId: string | null) => {
    if (!txId) return '#';
    if (wallet.address === 'DEMO_ACCOUNT') {
      return 'https://stellar.expert/explorer/testnet/tx/52f7ff35285f0ec22361156c3160fdb2c9bbbe77d77991333f3c6c30c3351778';
    }
    return `https://stellar.expert/explorer/testnet/tx/${txId}`;
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-brutal-pink selection:text-black relative overflow-x-hidden">
      <VideoBackground />
      <Navbar wallet={wallet} setWallet={setWallet} switchTab={switchTab} enterDemoMode={enterDemoMode} />

      <main className="pt-32 pb-24 px-4 md:px-8 max-w-7xl mx-auto relative z-10">
        {/* Header Stats Bento */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-16">
          <div className="lg:col-span-2 brutal-card p-6 md:p-10 flex flex-col justify-center relative group min-h-[320px]">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-48 h-48 rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brutal-blue text-white animate-pulse" />
                  Network: Horizon Mainline
                </div>
                {isDemo && (
                  <div className="bg-brutal-orange/20 text-brutal-orange px-2 py-0.5 rounded border border-amber-500/20 text-[8px] font-bold tracking-widest">
                    SIMULATION ACTIVE
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="bg-brutal-green/20 text-brutal-green px-2 py-0.5 rounded border border-emerald-500/20 text-[8px] font-bold tracking-widest">
                    NO_KYC
                  </div>
                  <div className="bg-brutal-pink/20 text-indigo-500 px-2 py-0.5 rounded border border-black text-[8px] font-bold tracking-widest">
                    PURE_DEFI
                  </div>
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-wider leading-normal mb-6 uppercase font-display bg-white px-4 py-2 border-4 border-black brutal-shadow inline-block max-w-full break-words text-black">
                LIQUIDITY <br />
                <span className="text-black/40">MEETS</span> REPUTATION
              </h1>
              <p className="text-slate-300 font-bold max-w-sm text-sm leading-relaxed mb-8 font-medium">
                The first decentralized micro-lending engine on Stellar. 
                Using on-chain history to enable collateral-efficient financing.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button 
                  onClick={() => switchTab('supply')}
                  className="bg-white text-black px-6 py-3 rounded-none font-bold text-xs uppercase tracking-widest hover:bg-brutal-blue hover:text-black transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                  Explore Pool
                </button>
                <button 
                  onClick={() => switchTab('repayment')}
                  className="border border-white/20 text-white px-6 py-3 rounded-none font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Manage Debt
                </button>
              </div>
            </div>
          </div>

          <div className="brutal-card p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2">Protocol Liquidity</span>
                <div className="p-1.5 bg-brutal-pink/20 rounded-md">
                  <BarChart3 className="w-4 h-4 text-brutal-blue" />
                </div>
              </div>
              <div className="text-4xl font-black text-white tracking-tighter uppercase">
                Maximum
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-brutal-green font-bold text-[10px] tracking-wider uppercase">
                <TrendingUp className="w-3 h-3" />
                Growth Positive
              </div>
            </div>
            
            <div className="h-24 w-full mt-6 -mx-2 opacity-50 grayscale hover:grayscale-0 transition-all">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldData}>
                  <Area type="monotone" dataKey="yield" stroke="#6366f1" strokeWidth={3} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="brutal-card p-8 flex flex-col justify-between accent-border">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 text-brutal-blue">Baseline Yield</span>
                <Clock className="w-4 h-4 text-white/70 font-bold" />
              </div>
              <div className="text-4xl font-black text-white tracking-tighter uppercase">
                Robust
              </div>
              <p className="text-slate-300 font-bold text-[10px] uppercase mt-4 tracking-widest">Optimized APY Curve</p>
            </div>
            <div className="pt-6 border-t border-white/10">
              <div className="flex justify-between text-[10px] font-mono mb-2">
                <span className="text-brutal-blue opacity-60">REWARD STATUS</span>
                <span className="text-white uppercase tracking-tighter">Distributed</span>
              </div>
              <div className="w-full bg-white h-1.5 rounded-full overflow-hidden">
                <div className="bg-brutal-pink h-full w-[65%]" />
              </div>
            </div>
          </div>
        </section>

        {/* Tab Interface */}
        <div className="flex flex-wrap justify-start items-center gap-x-4 gap-y-4 md:gap-10 mb-10 border-4 border-black bg-white p-4 brutal-shadow w-fit">
          <button 
            onClick={() => switchTab('supply')}
            className={cn(
              "pb-2 font-mono text-[10px] sm:text-xs uppercase tracking-widest md:tracking-[0.2em] transition-all relative",
              activeTab === 'supply' ? "text-black font-black" : "text-black/70 font-bold hover:text-black"
            )}
          >
            LENDING_VAULTS
            {activeTab === 'supply' && <motion.div layoutId="tab" className="absolute bottom-[-16px] left-0 right-0 h-1 bg-brutal-blue text-white" />}
          </button>
          <button 
            onClick={() => switchTab('borrow')}
            className={cn(
              "pb-2 font-mono text-[10px] sm:text-xs uppercase tracking-widest md:tracking-[0.2em] transition-all relative",
              activeTab === 'borrow' ? "text-black font-black" : "text-black/70 font-bold hover:text-black"
            )}
          >
            BORROW_CONSOLE
            {activeTab === 'borrow' && <motion.div layoutId="tab" className="absolute bottom-[-16px] left-0 right-0 h-1 bg-brutal-blue text-white" />}
          </button>
          <button 
            onClick={() => switchTab('repayment')}
            className={cn(
              "pb-2 font-mono text-[10px] sm:text-xs uppercase tracking-widest md:tracking-[0.2em] transition-all relative",
              activeTab === 'repayment' ? "text-black font-black" : "text-black/70 font-bold hover:text-black"
            )}
          >
            REPAYMENT_CENTER
            {activeTab === 'repayment' && <motion.div layoutId="tab" className="absolute bottom-[-16px] left-0 right-0 h-1 bg-brutal-blue text-white" />}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'supply' ? (
                <motion.div 
                  key="supply"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="brutal-card p-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0 mb-12">
                      <div>
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 block w-fit">Protocol Asset</span>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase break-words max-w-full">Native Core Vault</h2>
                      </div>
                      <div className="p-4 bg-brutal-green/20 rounded-none border-4 border-black text-center flex flex-col items-center gap-3 w-full md:w-auto">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] !text-brutal-green">Yield Profile</span>
                        <span className="text-3xl font-black text-brutal-green tracking-tighter">MAXIMUM</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                      <div className="bg-white rounded-none p-6 border border-black">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 mb-4 block">Personal Stake</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-black">{userBalance > 0 ? userBalance.toFixed(2) : 'MINIMAL'}</span>
                          <span className="text-black/70 font-bold font-bold text-[10px] uppercase tracking-widest">XLM Asset</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-none p-6 border border-black">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 mb-4 block">Yield Accrued</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-brutal-green">{(userBalance * 0.05).toFixed(4)}</span>
                          <span className="text-black/70 font-bold font-bold text-[10px] uppercase tracking-widest">Growth Factor</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end">
                          <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] !text-black/70 font-bold w-fit">AMOUNT</span>
                          <button 
                            onClick={() => setAmount('100')} 
                            className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-brutal-blue cursor-pointer hover:bg-brutal-pink transition-colors active:translate-y-1 active:translate-x-1 active:shadow-none w-fit"
                          >
                            ALL
                          </button>
                        </div>
                        <input 
                          type="text" 
                          placeholder="INPUT VALUE" 
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-white text-black border-4 border-black rounded-none px-6 py-6 font-black text-xl focus:border-brutal-blue outline-none transition-all placeholder:text-black/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        />
                      </div>
                      {error && activeTab === 'supply' && (
                        <p className="text-red-500 text-[10px] font-mono uppercase tracking-widest">{error}</p>
                      )}
                      <button 
                        onClick={() => wallet.address && handleSupply(amount || "10000000")}
                        disabled={processing}
                        className={cn(
                          "w-full bg-brutal-blue text-white py-6 font-bold uppercase tracking-widest text-xl flex items-center justify-center gap-3 brutal-btn",
                          processing ? "opacity-50 cursor-not-allowed" : "hover:bg-brutal-blue text-white hover:text-black active:scale-95"
                        )}
                      >
                        {processing ? "BROADCASTING..." : lastTxId ? "SUCCESSFUL_DEPOSIT" : "INITIALIZE SUPPLY"}
                         {processing ? <Activity className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                      </button>
                      {lastTxId && (
                        <p className="text-center font-mono text-[9px] text-brutal-blue animate-pulse tracking-widest uppercase mt-4">
                          Sig Accepted:{" "}
                          <a
                            href={getExplorerUrl(lastTxId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-black transition-colors"
                          >
                            Hash_{lastTxId} ↗
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'borrow' ? (
                <motion.div 
                  key="borrow"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                   <div className="brutal-card p-10 border-black">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0 mb-12">
                      <div>
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 block w-fit">Micro-Financing</span>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase break-words max-w-full">Algorithm Credit</h2>
                      </div>
                      <div className="p-4 bg-brutal-pink/20 rounded-none border-4 border-black text-center flex flex-col items-center gap-3 w-full md:w-auto">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">Credit Status</span>
                        <span className="text-3xl font-black text-brutal-blue tracking-tighter uppercase">
                          {reputation ? reputation.tier : "Locked"}
                        </span>
                      </div>
                    </div>

                    {!wallet.connected ? (
                      <div className="p-6 md:p-20 text-center bg-white rounded-none border-2 border-dashed border-black">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border border-black shadow-2xl">
                          <Wallet className="w-7 h-7 text-black/70 font-bold" />
                        </div>
                        <h3 className="text-xl font-black text-black mb-2 uppercase tracking-tight">Identity Required</h3>
                        <p className="text-black/70 font-bold font-mono text-[10px] uppercase tracking-widest leading-relaxed">Connect Freighter to compute reputation score</p>
                      </div>
                    ) : loading ? (
                       <div className="p-20 text-center">
                        <Activity className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-6" />
                        <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 animate-pulse">Syncing Blockchain Data...</div>
                       </div>
                    ) : (
                      <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-8 bg-white rounded-none border border-black">
                            <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 mb-4 block">Risk Adjusted Rate</span>
                            <span className="text-5xl font-black text-black uppercase tracking-tighter">
                              {reputation ? calculateInterestRate(reputation.score).toFixed(2) : '---'}%
                            </span>
                             <div className="mt-2 flex flex-col gap-1">
                               <div className="text-[8px] font-mono text-brutal-blue uppercase tracking-widest">
                                 Your Reputation-Based APR
                               </div>
                               <div className="text-[7px] font-mono text-black/70 font-bold uppercase tracking-[0.05em] opacity-80 leading-relaxed">
                                 Formula: Base Rate (15%) - (Score/100 × Max Reputation Discount (10%))
                               </div>
                             </div>
                          </div>
                          <div className="p-8 bg-brutal-pink/10 rounded-none border border-black flex flex-col justify-center">
                            <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 mb-4 block text-brutal-blue">Current Debt</span>
                            <span className="text-4xl font-black text-white uppercase tracking-tighter">
                              {borrowedAmount.toFixed(2)} XLM
                            </span>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                              <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] !text-black/70 font-bold w-fit">AMOUNT</span>
                              <div className="text-[9px] font-mono font-bold text-black bg-white px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                MAX: {reputation ? getMaxBorrowAmount(reputation.score) : 0} XLM
                              </div>
                            </div>
                            <input 
                              type="text" 
                              placeholder="INPUT VALUE" 
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="w-full bg-white text-black border-4 border-black rounded-none px-6 py-6 font-black text-xl focus:border-brutal-blue outline-none transition-all placeholder:text-black/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            />
                          </div>
                          {error && activeTab === 'borrow' && (
                            <p className="text-red-500 text-[10px] font-mono uppercase tracking-widest">{error}</p>
                          )}
                          <div className="flex flex-col gap-4">
                            <button 
                              onClick={handleBorrow}
                              disabled={processing}
                              className={cn(
                                "w-full bg-brutal-pink text-black py-6 rounded-none font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 shadow-xl",
                                processing ? "opacity-50 cursor-not-allowed" : "hover:bg-brutal-blue text-white active:scale-95 shadow-indigo-600/20"
                              )}
                            >
                              {processing ? "PROC..." : lastTxId ? "LOAN_OK" : "Borrow"}
                              <ArrowUpRight className="w-5 h-5" />
                            </button>
                            {lastTxId && (
                              <p className="text-center font-mono text-[9px] text-brutal-blue animate-pulse tracking-widest uppercase mt-4">
                                Sig Accepted:{" "}
                                <a
                                  href={getExplorerUrl(lastTxId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-black transition-colors"
                                >
                                  Hash_{lastTxId} ↗
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="repayment"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="brutal-card p-10 border-black brutal-shadow">
                     <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0 mb-12">
                      <div>
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 block w-fit">Active Loans</span>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase break-words max-w-full">Repayment Center</h2>
                      </div>
                      <div className="p-4 bg-brutal-pink/20 rounded-none border-4 border-black text-center flex flex-col items-center gap-3 w-full md:w-auto">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">Credit Usage</span>
                        <span className="text-3xl font-black text-brutal-blue tracking-tighter uppercase">
                          {reputation && borrowedAmount > 0 ? ((borrowedAmount / getMaxBorrowAmount(reputation.score)) * 100).toFixed(1) : "0.0"}%
                        </span>
                      </div>
                    </div>

                    {!wallet.connected || borrowedAmount === 0 ? (
                      <div className="p-6 md:p-20 text-center bg-white rounded-none border-2 border-dashed border-black">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border border-black">
                          <ShieldCheck className="w-7 h-7 text-brutal-green/50" />
                        </div>
                        <h3 className="text-xl font-black text-black mb-2 uppercase tracking-tight">No Active Debt</h3>
                        <p className="text-black/70 font-bold font-mono text-[10px] uppercase tracking-widest leading-relaxed">Your account is in good standing with the protocol.</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-none border-4 border-black flex flex-col gap-4">
                            <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-fit">Borrowed Principal</span>
                            <span className="text-3xl font-black text-black">{borrowedAmount.toFixed(2)} XLM</span>
                          </div>
                           <div className="bg-white p-6 rounded-none border-4 border-black flex flex-col gap-4">
                             <div className="flex items-center justify-between w-full">
                               <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] !text-brutal-blue">Accrued Interest</span>
                               <span className="text-[6px] font-mono text-black/70 font-bold uppercase tracking-tighter opacity-60 text-right max-w-[150px]">Base Rate (15%) - (S/100 × Max Discount (10%))</span>
                             </div>
                             <span className="text-3xl font-black text-brutal-blue">
                               {reputation ? (borrowedAmount * (calculateInterestRate(reputation.score) / 100)).toFixed(4) : '0.00'} XLM
                             </span>
                           </div>
                        </div>

                        <div className="p-10 bg-brutal-pink/10 rounded-none border border-black text-center relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                             <History className="w-32 h-32" />
                           </div>
                           <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-brutal-blue mb-4 block">Total Return Amount</span>
                           <div className="text-6xl font-black text-white tracking-tighter mb-8">
                             {reputation ? (borrowedAmount * (1 + calculateInterestRate(reputation.score) / 100)).toFixed(2) : borrowedAmount} <span className="text-2xl text-white/50">XLM</span>
                           </div>
                           
                           <button 
                              onClick={() => {
                                const total = (borrowedAmount * (1 + calculateInterestRate(reputation.score) / 100)).toString();
                                handleRepay(total);
                              }}
                              disabled={processing}
                              className="w-full bg-white text-black border-4 border-black py-6 rounded-none font-black uppercase tracking-widest text-xl hover:bg-brutal-blue hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                              {processing ? "SETTLING..." : "CLEAR DEBT"}
                              <ArrowUpRight className="w-5 h-5" />
                            </button>
                            {lastTxId && (
                              <p className="text-center font-mono text-[9px] text-brutal-blue animate-pulse tracking-widest uppercase mt-4">
                                Sig Accepted:{" "}
                                <a
                                  href={getExplorerUrl(lastTxId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-black transition-colors"
                                >
                                  Hash_{lastTxId} ↗
                                </a>
                              </p>
                            )}
                        </div>

                        <div className="flex items-start gap-4 p-6 bg-brutal-yellow border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                          <Info className="w-5 h-5 text-black shrink-0 mt-0.5" />
                          <p className="text-[9px] font-mono font-bold text-black uppercase leading-relaxed tracking-widest">
                            Repaying your debt increases your future credit limit. The interest paid is distributed back to liquidity providers in the Core Vault.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Protocol Insights Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="brutal-card p-8">
                 <div className="flex items-center gap-3 mb-8">
                   <div className="p-2.5 bg-brutal-pink/20 rounded-none">
                     <Activity className="w-5 h-5 text-indigo-500" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-wider text-white">Safety Metrics</h3>
                 </div>
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-3">
                        <span className="text-slate-300 font-bold">SOLVENCY RATIO</span>
                        <span className="text-white font-bold uppercase tracking-tighter">High</span>
                      </div>
                      <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-black">
                        <div className="bg-brutal-blue text-white h-full w-[95%]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-3">
                        <span className="text-slate-300 font-bold">RESERVE RATIO</span>
                        <span className="text-brutal-blue font-bold uppercase tracking-tighter">Robust</span>
                      </div>
                      <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-black">
                        <div className="bg-brutal-blue text-white h-full w-[70%]" />
                      </div>
                    </div>
                 </div>
                 <p className="mt-8 text-[9px] font-mono tracking-widest text-slate-300 font-bold leading-relaxed uppercase">
                   Verified by Soroban smart contract invariants. Protocols state is decentralized and redundant.
                 </p>
               </div>

               <div className="brutal-card p-8 flex flex-col justify-between h-full">
                 <div className="flex items-center gap-3 mb-8">
                   <div className="p-2.5 bg-brutal-pink/20 rounded-none">
                     <History className="w-5 h-5 text-indigo-500" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-wider text-white">Event Log</h3>
                 </div>
                 <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                    {events.length > 0 ? events.map(ev => (
                       <div key={ev.id} className="flex flex-col gap-1 p-3 bg-white rounded-none border border-black mb-3">
                         <div className="flex items-center justify-between">
                           <span className="font-mono text-[9px] text-black/70 font-bold">{ev.type}</span>
                           <span className={cn(
                             "font-mono text-[9px] font-bold tracking-tighter",
                             ev.status === 'ERROR' ? "text-red-500" : "text-brutal-green"
                           )}>{ev.status}</span>
                         </div>
                         {ev.details && (
                           <div className="flex items-center justify-between">
                             <span className="text-[10px] font-black text-black">{ev.details}</span>
                             <span className="text-[7px] font-mono text-black/70 font-bold">{ev.time}</span>
                           </div>
                         )}
                       </div>
                    )) : (
                      <div className="p-8 text-center border-2 border-dashed border-black rounded-none opacity-20">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-[8px]">Awaiting Events</span>
                      </div>
                    )}
                 </div>
                 <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/10">
                    <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-[9px]">System Latency</span>
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-widest underline underline-offset-4 decoration-emerald-500">Nominal</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6">
            <div className={cn(
              "brutal-card p-10 transition-all duration-700 relative group overflow-hidden",
              reputation ? "border-indigo-500/40" : "opacity-40 grayscale"
            )}>
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white border-l-2 border-indigo-500 pl-3">Reputation Engine</h3>
                <div className="flex flex-col items-end">
                  <ShieldCheck className={cn("w-6 h-6 mb-1", reputation ? "text-indigo-500" : "text-slate-500")} />
                  <span className="text-[7px] font-mono text-slate-300 font-bold uppercase tracking-widest">Privacy_Preserved</span>
                </div>
              </div>

              {reputation ? (
                <div className="space-y-12">
                  <div className="relative text-center py-4">
                    <div className="text-[100px] font-black tracking-tighter text-white/5 absolute inset-0 flex items-center justify-center leading-none select-none uppercase">
                      {reputation.score}
                    </div>
                    <div className="relative z-10">
                      <div className="text-6xl font-black text-white tracking-tighter mb-4">
                        {reputation.score}<span className="text-2xl text-indigo-500">/100</span>
                      </div>
                      <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 text-brutal-blue font-bold tracking-[0.25em]">STELLAR TRUST SCORE</div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-10 border-t border-white/10">
                    <div className="flex justify-between items-center mb-1 bg-[#1E1F23]/30 p-3 rounded-none border border-white/10">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-black/70 font-bold">Account Age</span>
                        <span className="text-white font-bold text-xs uppercase tracking-tight">{reputation.factors.daysOld} Days</span>
                      </div>
                      <div className="text-right">
                        <span className="text-brutal-blue font-bold text-lg font-mono">+{reputation.factors.accountAge}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-1 bg-[#1E1F23]/30 p-3 rounded-none border border-white/10">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-black/70 font-bold">Network Activity</span>
                        <span className="text-white font-bold text-xs uppercase tracking-tight">{reputation.factors.totalTxs} Transactions</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold text-lg font-mono">+{reputation.factors.transactionCount}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-black/70 font-bold">Verification Tier</span>
                        <span className="text-[10px] font-mono font-bold text-brutal-blue uppercase tracking-widest">{reputation.tier}</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-black">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${reputation.score}%` }}
                          className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full " 
                        />
                      </div>
                    </div>
                  </div>

                  <p className="font-mono text-[9px] uppercase text-slate-300 font-bold leading-relaxed tracking-widest text-center opacity-60">
                    Sourced from open data relays.
                  </p>
                </div>
              ) : (
                <div className="py-24 text-center space-y-6">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto border border-black">
                    <Lock className="w-6 h-6 text-[#2A2B2E]" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2">Protocol Locked</div>
                    <p className="text-[10px] font-mono text-slate-400 uppercase">Awaiting Signature</p>
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
      </main>

      <footer className="border-t border-black py-20 px-8 relative z-10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="md:col-span-2 space-y-8">
            <div className="flex items-center gap-4">
              <img src="/logo.jpg" alt="StellarYield Logo" className="w-12 h-12 object-contain rounded-full border border-black bg-white" />
              <span className="text-2xl font-black tracking-tighter text-black uppercase">StellarYield</span>
            </div>
            <p className="text-black/70 font-bold text-sm max-w-sm leading-relaxed font-medium">
              StellarYield uses a modular multi-contract engine to provide trustless, reputation-based micro-lending with dynamically scaled interest rates on the Stellar blockchain.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 text-black uppercase">Resources</h4>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-black/70 font-bold">
              <li><a href="#" className="hover:text-black transition-colors">Lab Documentation</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Governance Token</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Audit Reports</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 text-black uppercase">Protocol Status</h4>
            <div className="space-y-4">
              <div className="p-4 bg-white border border-black rounded-none">
                <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-[8px] mb-2 opacity-50 uppercase">Network Segment</div>
                <div className="font-mono text-[10px] text-brutal-blue font-black uppercase tracking-widest">Active Mainline</div>
              </div>
              <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-black font-black bg-white px-2 py-1 border-2 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2 !text-[8px] opacity-40 uppercase tracking-tighter"> 
                stellar labs protocol evolution lab.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
