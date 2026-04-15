import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw, AlertCircle, Package, Search, Database, CheckCircle2 } from 'lucide-react';

const InventoryRow = React.memo(({ item, onUpdateQuantity, onUpdatePrice }) => (
    <tr key={item.id} className="hover:bg-blue-500/5 transition-colors group">
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:scale-125 transition-transform" />
                <span className="text-white font-semibold capitalize tracking-tight">
                    {item.component_type.replace(/-/g, ' ')}
                </span>
            </div>
        </td>
        <td className="px-6 py-4">
            <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg font-bold uppercase tracking-wider text-[9px] border border-slate-700/50">
                {item.material}
            </span>
        </td>
        <td className="px-6 py-4">
            <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-lg font-bold ${item.quantity < 10 ? 'text-amber-500' : 'text-blue-400'}`}>
                    {item.quantity.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-600 font-bold uppercase">{item.unit}</span>
            </div>
        </td>
        <td className="px-6 py-4 text-right">
            <div className="inline-flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 group-hover:border-blue-500/30 transition-colors mr-4">
                <span className="pl-2 text-[9px] font-black text-slate-600 uppercase pr-2 border-r border-slate-800">₹</span>
                <input
                    type="number"
                    value={item.price || 0}
                    onChange={(e) => onUpdatePrice(item.id, e.target.value)}
                    className="w-24 bg-transparent px-1 py-1 text-emerald-400 font-mono font-bold focus:outline-none text-right text-sm"
                />
            </div>
            <div className="inline-flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 group-hover:border-blue-500/30 transition-colors">
                <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onUpdateQuantity(item.id, e.target.value)}
                    className="w-20 bg-transparent px-2.5 py-1 text-white font-mono font-bold focus:outline-none text-right text-sm"
                />
                <span className="pr-2 text-[9px] font-black text-slate-600 uppercase border-l border-slate-800 pl-2">
                    {item.unit}
                </span>
            </div>
        </td>
    </tr>
));

export default function InventoryManager({ isOpen, onClose, user }) {
    const [inventory, setInventory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMaterial, setFilterMaterial] = useState('all');

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const response = await fetch('http://localhost:5001/api/inventory');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to fetch inventory');
            }

            setInventory(data);
        } catch (err) {
            setError(err.message === 'Failed to fetch'
                ? 'Backend server not responding on port 5001'
                : err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchInventory();
        }
    }, [isOpen, fetchInventory]);

    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    const materials = useMemo(() => {
        const m = new Set(inventory.map(i => i.material));
        return ['all', ...Array.from(m)].sort();
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.component_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.material.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterMaterial === 'all' || item.material.toLowerCase() === filterMaterial.toLowerCase();
            return matchesSearch && matchesFilter;
        });
    }, [inventory, searchQuery, filterMaterial]);

    const handleUpdateQuantity = useCallback((id, val) => {
        setInventory(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: parseFloat(val) || 0 } : item
        ));
    }, []);

    const handleUpdatePrice = useCallback((id, val) => {
        setInventory(prev => prev.map(item =>
            item.id === id ? { ...item, price: parseFloat(val) || 0 } : item
        ));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const response = await fetch('http://localhost:5001/api/inventory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: inventory })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMsg('Inventory synced with MSSQL successfully!');
                fetchInventory();
            } else {
                throw new Error(data.details || data.error || 'Failed to update inventory');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">

                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500">
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">MSSQL Inventory Manager</h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {isLoading ? 'Syncing...' : 'Connection: Active'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={fetchInventory} 
                            disabled={isLoading}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-blue-400 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                            title="Refresh stock levels from DB"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-6 pt-4">
                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-medium animate-in slide-in-from-top-2">
                            <AlertCircle size={18} />
                            <div className="flex-1">
                                <span className="font-bold">Database Error:</span> {error}
                            </div>
                            <button onClick={fetchInventory} className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs transition-colors">
                                Retry Sync
                            </button>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-sm font-medium animate-in slide-in-from-top-2">
                            <CheckCircle2 size={18} />
                            {successMsg}
                        </div>
                    )}
                </div>

                <div className="p-6 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by component or material..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                        />
                    </div>

                    <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Material:</span>
                        <select
                            value={filterMaterial}
                            onChange={(e) => setFilterMaterial(e.target.value)}
                            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer capitalize"
                        >
                            {materials.map(m => (
                                <option key={m} value={m} className="bg-slate-900">{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className="text-right ml-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Items Loaded: {filteredInventory.length}
                        </span>
                    </div>
                </div>

                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    {isLoading && inventory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <RefreshCw size={40} className="animate-spin text-blue-500 opacity-50" />
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Establishing Pool...</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/30">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr className="border-b border-slate-800">
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Component Type</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Material</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Current Quantity</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">Unit Price & Adjust</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredInventory.map((item) => (
                                        <InventoryRow 
                                            key={item.id} 
                                            item={item} 
                                            onUpdateQuantity={handleUpdateQuantity} 
                                            onUpdatePrice={handleUpdatePrice} 
                                        />
                                    ))}
                                    {filteredInventory.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-32 text-center">
                                                <Package size={48} className="mx-auto mb-4 text-slate-800" />
                                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records found in database</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Pipe3D PRO • Inventory System</p>
                        <p className="text-[9px] text-slate-500 font-medium italic mt-0.5">Automated MSSQL synchronization active.</p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-2xl border border-slate-800 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all">
                            Close
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading || inventory.length === 0}
                            className="px-10 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
                            Sync to MSSQL
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
