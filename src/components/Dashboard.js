import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Database,
  Package,
  ShoppingCart,
  ShoppingBag,
  BarChart3,
  LifeBuoy,
  Settings,
  LogOut,
  Search,
  Bell,
  Moon,
  Users,
  MoreVertical,
  AlertOctagon,
  Info,
  Box,
  Clock,
  Trash2,
  ClipboardList,
  X,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Filter,
  RefreshCw,
  AlertCircle,
  Plus,
  Check,
  ChevronDown,
  Heart
} from 'lucide-react';

import { 
  calculateComponentMetrics, 
  calculateComponentCost, 
  calculateTotalWeight,
  calculateTotalCost,
  formatIndianNumber, 
  GST_RATE 
} from '../utils/pricing.js';
import { getComponentTag } from '../utils/tagging.js';
import logoImage from '../assets/logo.png';
import { LIBRARY_PARTS } from './ComponentLibrary.js';

/* --- HELPER COMPONENTS --- */

function InventoryView({ inventory, onRefresh, onRestock }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedMaterial, setSelectedMaterial] = React.useState('All');

  // Get unique materials for the dropdown
  const materials = ['All', ...new Set(inventory.map(item => item.material).filter(Boolean))].sort();

  const filtered = inventory.filter(item => {
    const matchesSearch = 
      item.component_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMaterial = selectedMaterial === 'All' || item.material === selectedMaterial;
    
    return matchesSearch && matchesMaterial;
  });

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-20 space-y-8">
      <div className="flex justify-between items-end">
        <div>
           <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">WAREHOUSE STOCK</h3>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Real-time Inventory tracking</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by component or material..."
              className="bg-white border border-slate-100 rounded-2xl pl-10 pr-6 py-3 text-[10px] font-black tracking-widest outline-none focus:border-blue-400 transition-all w-72 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Material Select Dropdown */}
          <div className="relative min-w-[180px]">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-500/50 uppercase tracking-widest pointer-events-none">
                Material:
             </div>
             <select
               className="w-full bg-white border border-slate-100 rounded-2xl pl-[84px] pr-10 py-3 text-[10px] font-black tracking-widest outline-none focus:border-blue-400 appearance-none cursor-pointer shadow-sm"
               value={selectedMaterial}
               onChange={(e) => setSelectedMaterial(e.target.value)}
             >
               {materials.map(m => (
                 <option key={m} value={m}>{m.replace(/_/g, ' ').toUpperCase()}</option>
               ))}
             </select>
             <Filter size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="hidden lg:block px-6 py-3 bg-slate-900/5 rounded-2xl border border-slate-100 italic">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Items Loaded: </span>
             <span className="text-xs font-black text-slate-700">{filtered.length}</span>
          </div>

          <button
            onClick={onRefresh}
            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Catalog Item</th>
              <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Spec</th>
              <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Status</th>
              <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Usage History</th>
              <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Mkt Price</th>
              <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const part = LIBRARY_PARTS.find(p => p.type === item.component_type);
                      return part ? (
                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center transition-colors shadow-sm" style={{ color: part.color }}>
                          {React.cloneElement(part.icon, { size: 16 })}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <Package size={16} />
                        </div>
                      );
                    })()}
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{item.component_type.replace(/-/g, ' ')}</span>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.material.replace(/_/g, ' ')}</span>
                  </div>
                </td>
                <td className="p-6">
                   <div className="flex items-center gap-3">
                      <span className={`text-xs font-black tracking-widest ${parseFloat(item.quantity) < 50 ? 'text-amber-500' : 'text-slate-600'}`}>
                        {Math.floor(item.quantity).toLocaleString()} {item.unit || 'PCS'}
                      </span>
                      {parseFloat(item.quantity) < 50 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded-full uppercase tracking-tighter">Low Stock</span>
                      )}
                   </div>
                </td>
                <td className="p-6">
                  <span className="text-xs font-bold text-blue-500">{Math.floor(item.used_quantity || 0).toLocaleString()} <span className="text-[10px] opacity-50 font-black">CONSUMED</span></span>
                </td>
                <td className="p-6 text-right">
                  <span className="text-xs font-black text-slate-500 tracking-wider">₹{parseFloat(item.price || 0).toLocaleString()}</span>
                </td>
                <td className="p-6 text-right">
                  <button 
                    onClick={() => onRestock(item)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                  >
                    Restock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComponentPreview({ activeType }) {
  const [hasError, setHasError] = useState(false);
  const part = LIBRARY_PARTS.find(p => p.type === activeType);

  React.useEffect(() => {
    setHasError(false);
  }, [activeType]);

  return (
    <div 
      className="w-52 h-52 rounded-[3.5rem] flex items-center justify-center border border-slate-50 bg-white shadow-xl shadow-slate-200/50 transition-all duration-300 relative" 
      style={{ color: part?.color || '#94a3b8' }}
    >
      {!hasError ? (
        <img 
          src={`/components/${activeType}.png`} 
          alt={activeType} 
          className="w-[90%] h-[90%] object-contain transform scale-110 transition-transform hover:rotate-2 hover:scale-125 duration-500 drop-shadow-2xl"
          onError={() => setHasError(true)}
        />
      ) : part ? (
        <div className="transform transition-transform scale-125 drop-shadow-md translate-y-1">
          {React.cloneElement(part.icon, { size: 104, strokeWidth: 1.5 })}
        </div>
      ) : (
        <Package size={104} strokeWidth={1.5} className="text-slate-200" />
      )}
    </div>
  );
}

function AddComponentsView({ onRefresh, inventory = [] }) {
  const availableTypes = React.useMemo(() => {
    return [
      'straight', 'vertical', 'elbow', 'elbow-45', 't-joint', 'cross', 'reducer', 
      'flange', 'union', 'coupling', 'valve', 'filter', 'tank', 'cap', 'plug',
      'water-tap', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall',
      'y-cross', 'stere-cross', 'water-stop-ring', 'y-tee', 's-trap', 'p-trap',
      'equal-tee', 'unequal-tee', 'h-pipe', 'equal-cross', 'unequal-cross',
      'expansion-joint', 'rainwater-funnel', 'unequal-coupling', 'lucency-cap', 'checking-hole',
      'floor-leakage', 'hang-clamp', 'clamp', 'expand-clamp', 'pump',
      'globe-valve', 'check-valve', 'gate-valve', 'y-strainer', 
      'blind-flange', 'pressure-gauge', 'flow-meter', 'pipe-support'
    ];
  }, []);

  const categorizedTypes = React.useMemo(() => {
    const cats = {
      PIPES: ['straight', 'vertical'],
      FITTINGS: ['elbow', 'elbow-45', 't-joint', 'cross', 'reducer', 'flange', 'union', 'coupling', 'cap', 'plug', 'y-cross', 'stere-cross', 's-trap', 'p-trap', 'y-tee', 'h-pipe', 'equal-tee', 'unequal-tee', 'equal-cross', 'unequal-cross', 'expansion-joint', 'unequal-coupling', 'checking-hole', 'floor-leakage', 'lucency-cap', 'blind-flange'],
      VALVES: ['valve', 'globe-valve', 'check-valve', 'gate-valve', 'y-strainer'],
      EQUIPMENT: ['filter', 'tank', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall', 'pump', 'water-tap', 'water-stop-ring', 'rainwater-funnel', 'pressure-gauge', 'flow-meter'],
      HARDWARE: ['pipe-support', 'hang-clamp', 'clamp', 'expand-clamp']
    };
    
    const res = {};
    for (const [cat, items] of Object.entries(cats)) {
      const available = items.filter(i => availableTypes.includes(i));
      if (available.length > 0) {
        res[cat] = available;
      }
    }
    return res;
  }, [availableTypes]);

  const [formData, setFormData] = useState({
    type: availableTypes.length > 0 ? availableTypes[0] : 'straight',
    material: 'pvc',
    quantity: 100,
    unit: 'pcs',
    price: 50
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const [hoveredType, setHoveredType] = useState(null);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    function handlePosition() {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Only flip if there is less than 350px below AND there is more space above
        if (spaceBelow < 350 && spaceAbove > spaceBelow) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }
    if (isDropdownOpen) {
      handlePosition();
      window.addEventListener('resize', handlePosition);
      window.addEventListener('scroll', handlePosition, true);
    }
    return () => {
      window.removeEventListener('resize', handlePosition);
      window.removeEventListener('scroll', handlePosition, true);
    };
  }, [isDropdownOpen]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(formData.type)) {
      setFormData(prev => ({ ...prev, type: availableTypes[0] }));
    }
  }, [availableTypes, formData.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        alert('✅ Component added to Library and Inventory successfully!');
        onRefresh();
        setFormData({ ...formData, quantity: 100 }); // reset quantity
      } else {
        const err = await response.json();
        alert('❌ Failed: ' + (err.details || err.error));
      }
    } catch (err) {
      alert('❌ Server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-[40px] shadow-2xl p-10 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-blue-500" />
        
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner">
             <Plus size={24} strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Expand Library Catalog</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Register new components in the main 3D Master Library</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative w-full z-50" ref={dropdownRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-2">Component Category</label>
            
            {/* The Select Button */}
            <div 
              className={`w-full bg-slate-50 border ${isDropdownOpen ? 'border-blue-500' : 'border-slate-100'} rounded-2xl p-4 text-xs font-black flex items-center justify-between cursor-pointer transition-all hover:border-blue-300 uppercase`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>{formData.type ? formData.type.replace(/-/g, ' ') : 'Select Component...'}</span>
              <ChevronDown size={18} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* The Custom Popover Menu */}
            {isDropdownOpen && (
              <div 
                className={`absolute ${dropdownPosition === 'top' ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]'} left-0 w-full md:w-[680px] max-h-[380px] bg-white/98 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.15)] border border-slate-200/50 flex overflow-visible animate-in fade-in zoom-in-95 duration-300 z-[9999] pointer-events-auto divide-x divide-slate-100/50`}
                style={{ 
                  transformOrigin: dropdownPosition === 'top' ? 'bottom left' : 'top left',
                }}
              >
                
                {/* Left side: Scrollable Categorized List */}
                <div className="w-[45%] overflow-y-auto max-h-[380px] p-4 bg-slate-50/10 custom-scrollbar relative">
                  {Object.entries(categorizedTypes).map(([category, items]) => (
                    <div key={category} className="mb-8 last:mb-2 text-left">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 pl-3 select-none flex items-center">{category}</h4>
                      <div className="space-y-1">
                         {items.map(item => (
                           <button
                             key={item}
                             type="button"
                             className={`w-full text-left px-5 py-3.5 rounded-[1.3rem] text-[11px] font-bold transition-all capitalize cursor-pointer flex items-center justify-between select-none ${formData.type === item ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-slate-100/60 text-slate-600'}`}
                             onMouseEnter={() => setHoveredType(item)}
                             onMouseLeave={() => setHoveredType(null)}
                             onClick={(e) => {
                               e.stopPropagation();
                               setFormData(prev => ({...prev, type: item}));
                               setIsDropdownOpen(false);
                             }}
                           >
                             <span className="truncate">{item.replace(/-/g, ' ')}</span>
                             {formData.type === item && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                           </button>
                         ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right side: Modern Visual Preview Container */}
                <div className="w-[55%] p-10 flex flex-col items-center justify-center bg-transparent relative pointer-events-none rounded-r-[2.5rem] overflow-hidden">
                  <div className="absolute top-8 left-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">Modern Real-Time Preview</div>
                  
                  <ComponentPreview activeType={hoveredType || formData.type} />

                  <div className="mt-12 transition-all">
                     <span className="text-sm font-black text-slate-800 uppercase tracking-[0.25em] bg-white border-2 border-slate-50 shadow-[0_15px_30px_rgba(0,0,0,0.05)] px-10 py-5 rounded-2xl block min-w-[200px] text-center">
                        {(hoveredType || formData.type || 'Select').replace(/-/g, ' ')}
                     </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2 text-center border-r border-slate-50 relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Initial Stock</label>
              <input 
                type="number" 
                className="w-full bg-transparent text-center text-xl font-black text-slate-800 outline-none p-2"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
              <div className="h-0.5 w-1/2 mx-auto bg-slate-100 group-hover:bg-emerald-400 transition-colors" />
            </div>
            <div className="space-y-2 text-center border-r border-slate-50 relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pricing (INR)</label>
              <input 
                type="number" 
                className="w-full bg-transparent text-center text-xl font-black text-emerald-600 outline-none p-2"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />
              <div className="h-0.5 w-1/2 mx-auto bg-slate-100 group-hover:bg-emerald-400 transition-colors" />
            </div>
            <div className="space-y-2 text-center relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Measurement Unit</label>
              <select 
                className="w-full bg-transparent text-center text-sm font-black text-slate-800 outline-none p-2 appearance-none uppercase"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              >
                <option value="pcs">Pieces (PCS)</option>
                <option value="m">Meters (M)</option>
              </select>
              <div className="h-0.5 w-1/2 mx-auto bg-slate-100 group-hover:bg-emerald-400 transition-colors" />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
            Register Component in 3D Library
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [history, setHistory] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const [restockingItem, setRestockingItem] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0); // Force re-render

  const handleToggleFavorite = async (id, e) => {
    // 1. Find project for current value
    const project = history.find(p => p.id == id);
    const currentStatus = project ? (project.is_favourite == 1 || project.is_favourite === true) : false;
    const newStatus = !currentStatus;

    console.log(`[Dashboard] Optimistic Toggle: ${currentStatus} -> ${newStatus}`);
    
    setHistory(prev => prev.map(p => {
       if (p.id == id) {
          console.log('[Dashboard] Optimistically toggling p.id:', p.id, 'to', newStatus);
          return { ...p, is_favourite: newStatus };
       }
       return p;
    }));
    setRenderTrigger(v => v + 1);

    try {
      const res = await fetch(`/api/projects/${id}/favourite`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Dashboard] Server confirmed:', data);
        setHistory(prev => prev.map(p => p.id == id ? { ...p, is_favourite: !!data.is_favourite } : p));
      } else {
        console.error('[Dashboard] Toggle failed on server');
        setHistory(prev => prev.map(p => p.id == id ? { ...p, is_favourite: currentStatus } : p));
      }
    } catch (err) {
      console.error('[Dashboard] Toggle network error:', err);
      setHistory(prev => prev.map(p => p.id == id ? { ...p, is_favourite: currentStatus } : p));
    }
  };

  const fetchInventory = () => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => setInventory(Array.isArray(data) ? data : []))
      .catch(err => console.error('[Dashboard] Failed to fetch inventory:', err));
  };

  const fetchProjects = () => {
    setIsLoading(true);
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('[Dashboard] Failed to fetch database history:', err);
        setIsLoading(false);
      });
  };

  // Fetch API Data
  React.useEffect(() => {
    if (activeTab === 'database') {
      fetchProjects();
    } else if (activeTab === 'dashboard' || activeTab === 'inventory') {
      fetchInventory();
    }
  }, [isOpen, activeTab]);

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation(); // Don't trigger project load
    if (!window.confirm('Are you sure you want to permanently delete this project?')) return;

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setHistory(prev => prev.filter(p => p.id !== id));
      } else {
        alert('Failed to delete project');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error connecting to server');
    }
  };

  // ── Multi-select helpers ──────────────────────────────────
  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    setSelectedProjects(new Set());
  };

  const toggleProjectSelect = (id, e) => {
    e.stopPropagation();
    setSelectedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === history.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(history.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedProjects.size} project(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      try {
        await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Bulk delete error for id', id, err);
      }
    }
    setHistory(prev => prev.filter(p => !selectedProjects.has(p.id)));
    setSelectedProjects(new Set());
    setSelectMode(false);
  };
  // ─────────────────────────────────────────────────────────

  const [isBOMLoading, setIsBOMLoading] = React.useState(false);

  const openBOM = async (project) => {
    setSelectedBOM(project);
    setIsBOMLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      const full = await res.json();
      setSelectedBOM(full);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch full project for BOM:', err);
    } finally {
      setIsBOMLoading(false);
    }
  };

  const handleExportExcel = useCallback((project) => {
    try {
      const components = JSON.parse(project.components_json || "[]");
      if (components.length === 0) {
        alert('No components to export.');
        return;
      }

      const bomData = components.map((comp, idx) => {
        const metrics = calculateComponentMetrics(comp);
        const cost = calculateComponentCost(comp);
        const typeIdx = components.filter((c, i) => i < idx && c.component_type === comp.component_type).length;
        const tag = getComponentTag(comp.component_type, typeIdx);

        return {
          'Tag': tag,
          'Component': comp.component_type.replace('-', ' ').toUpperCase(),
          'Material': metrics.material,
          'OD (m)': metrics.od.toFixed(3),
          'Thick (m)': metrics.thick.toFixed(4),
          'Length (m)': metrics.length.toFixed(2),
          'Weight (kg)': metrics.weight.toFixed(2),
          'Volume (m3)': metrics.volume.toFixed(5),
          'Base Price (INR)': cost.toFixed(2),
          'GST 18% (INR)': (cost * 0.18).toFixed(2),
          'Total Price (INR)': (cost * 1.18).toFixed(2)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(bomData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bill of Materials');
      const safeName = (project.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(workbook, `${safeName}_bom_archive.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to generate Excel report.');
    }
  }, []);

  const handleExportPDF = useCallback((project) => {
    try {
      const components = JSON.parse(project.components_json || "[]");
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();

      const drawH = (doc, title) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pW, 25, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
        doc.text('Pipe3D PRO', 10, 16);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(title.toUpperCase(), 70, 16);
        doc.setFontSize(8); doc.text(`ARCHIVE DATE: ${new Date(project.created_at).toLocaleDateString()}`, pW - 50, 16);
      };

      // Page 1: BOM
      drawH(pdf, 'Bill of Materials (Historical)');
      const bMap = new Map();
      components.forEach((c) => {
        const k = `${c.component_type}-${c.properties?.material || 'pvc'}-${c.properties?.od || 0.3}`;
        if (bMap.has(k)) bMap.get(k).qty++;
        else bMap.set(k, { type: c.component_type, mat: (c.properties?.material || 'pvc').toUpperCase(), qty: 1 });
      });
      const tR = Array.from(bMap.values()).map((r, i) => [i + 1, r.type.toUpperCase(), r.mat, `${r.qty} pcs`]);
      autoTable(pdf, { startY: 35, head: [['S.No', 'Component', 'Material', 'Quantity']], body: tR, theme: 'grid' });

      // Page 2: Workshop Cut List
      const cutPipes = components.filter(c => ['straight', 'vertical', 'cylinder'].includes(c.component_type));
      if (cutPipes.length > 0) {
        const startY = pdf.lastAutoTable.finalY + 15;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(15, 23, 42);
        pdf.text('Workshop Cut List (Pipes Only)', 15, startY);
        const cutRows = cutPipes.map((c, idx) => {
          const typeIdx = components.filter((comp, i) => i < components.indexOf(c) && comp.component_type === c.component_type).length;
          return [
            getComponentTag(c.component_type, typeIdx),
            (c.properties?.material || 'pvc').toUpperCase(),
            (c.properties?.od || 0.3).toFixed(3),
            (c.properties?.length || 2.0).toFixed(3) + ' m'
          ];
        });
        autoTable(pdf, { startY: startY + 5, head: [['Tag ID', 'Material', 'Outer Diameter (m)', 'Cut Length (m)']], body: cutRows, theme: 'grid' });
      }

      pdf.save(`Pipe3D_Archive_${(project.name || 'untilted').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF report.');
    }
  }, []);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#e8f0fe] font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 bg-[#2b65f0] flex flex-col h-full text-white/70 shadow-2xl z-50 transition-all shrink-0">

        {/* Brand Header Section */}
        <div className="flex flex-col py-10 px-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            {/* P3D Icon Box */}
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg p-1 shrink-0">
              <img src={logoImage} alt="P3D" className="w-full h-full object-contain" />
            </div>
            {/* Brand Names */}
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-white font-black text-xl tracking-tight">Pipe3D</span>
                <span className="text-[#e0e7ff] font-black italic text-xl ml-1">PRO</span>
              </div>
            </div>
          </div>
          {/* Subtitle */}
          <div className="text-[8px] font-bold text-white/30 tracking-[0.2em] uppercase mt-1 pl-1">
            Engineering Excellence
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-8 space-y-1">
          <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem
            icon={<Database size={18} />}
            label="Projects"
            active={activeTab === 'database'}
            onClick={() => setActiveTab('database')}
          />
          <NavItem
            icon={<Package size={18} />}
            label="Inventory"
            active={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
          />
          <NavItem
            icon={<Plus size={18} className="text-emerald-400" />}
            label="Add Component"
            active={activeTab === 'add-component'}
            onClick={() => setActiveTab('add-component')}
          />
        </div>

        {/* Logout at bottom */}
        <div className="p-6">
          <button
            onClick={onClose}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden text-slate-900">


        {/* Dashboard Content Scroller */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 hidden-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
              {/* Critical Stock Alert Banner */}
              {inventory.some(i => parseFloat(i.quantity) < 50) && (
                <div 
                  onClick={() => setActiveTab('inventory')}
                  className="bg-red-50 border border-red-100 rounded-3xl p-6 flex items-center justify-between cursor-pointer hover:bg-red-100/50 transition-all group animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">System Alert: Critical Inventory Levels</h4>
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mt-1">
                        {inventory.filter(i => parseFloat(i.quantity) < 50).length} items are below safety threshold. Production risk detected.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-200 group-hover:scale-105 transition-transform">
                    Resolve Sub-Stock <ArrowUpRight size={14}/>
                  </div>
                </div>
              )}

              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={<Activity className="text-blue-500" />}
                  label="System Status"
                  value="Operational"
                  trend="+100%"
                  color="bg-blue-50"
                  infoTitle="Network & DB"
                  infoList={[
                    { label: "Latency", value: "12ms" },
                    { label: "DB Connection", value: "Stable" }
                  ]}
                />
                <StatCard
                  icon={<Database className="text-indigo-500" />}
                  label="Total Projects"
                  value={history.length}
                  trend={`+${Math.min(history.length, 5)}%`}
                  color="bg-indigo-50"
                  infoTitle="Recent Saves"
                  infoList={history.slice(0, 2).map(p => ({ label: p.name, value: "Saved" }))}
                />
                <StatCard
                  icon={<Package className="text-emerald-500" />}
                  label="Total Stock"
                  value={inventory.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0).toFixed(0)}
                  trend="Stable"
                  color="bg-emerald-50"
                  infoTitle="Stock Value"
                  infoList={[
                    { label: "Assets", value: `₹${(inventory.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * (item.price || 50)), 0) / 1000).toFixed(1)}k` }
                  ]}
                />
                <StatCard
                  icon={<TrendingUp className="text-amber-500" />}
                  label="Stock Alerts"
                  value={inventory.filter(i => parseFloat(i.quantity) < 50).length}
                  trend="Attention"
                  color="bg-amber-50"
                  infoTitle="Low Stock Items"
                  infoList={inventory.filter(i => parseFloat(i.quantity) < 50).slice(0, 2).map(i => ({ label: i.component_type, value: "Critical" }))}
                />
              </div>

              {/* Analytics Section */}
              {/* Analytics Section - Full Width Landscape */}
              <div className="w-full">
                <StockUsageChart inventory={inventory} onRefresh={fetchInventory} />
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">DESIGN ARCHIVE</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Managed Engineering Records</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFavoritesOnly(prev => !prev)}
                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all flex items-center gap-2 ${
                      showFavoritesOnly
                        ? 'bg-rose-500 text-white border-transparent shadow-lg shadow-rose-200'
                        : 'bg-white text-slate-500 border-slate-100 hover:border-rose-200 hover:text-rose-500'
                    }`}
                    title="Toggle Favorites Only"
                  >
                    <Heart size={14} fill={showFavoritesOnly ? "currentColor" : "none"} />
                    {showFavoritesOnly ? 'Favorites Only' : 'Favorites'}
                  </button>
                  {selectMode && (
                    <button
                      onClick={handleSelectAll}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#2b65f0] bg-white border border-slate-100 rounded-xl transition-all"
                    >
                      {selectedProjects.size === history.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  <button
                    onClick={toggleSelectMode}
                    className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                      selectMode
                        ? 'bg-[#2b65f0] text-white border-transparent shadow-lg shadow-blue-200'
                        : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200 hover:text-[#2b65f0]'
                    }`}
                  >
                    {selectMode ? '✕ Cancel' : 'Select'}
                  </button>
                  <div className="bg-white/50 backdrop-blur-sm border border-slate-100 px-6 py-3 rounded-full flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{history.length} Live Records Found</span>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 animate-pulse">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Accessing Vault...</span>
                </div>
              ) : history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {history.filter(p => !showFavoritesOnly || p.is_favourite).map((project, idx) => {
                    const isSelected = selectedProjects.has(project.id);
                    return (
                    <div
                      key={project.id}
                      className={`group transition-all duration-500 bg-white rounded-[2rem] overflow-hidden border ${
                        isSelected ? 'border-4 border-[#2b65f0] shadow-2xl scale-[1.02]' : 'border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.01] hover:border-blue-100'
                      } relative flex flex-col h-full`}
                    >
                      {/* 1. Clickable Area: Image & Name */}
                      <div 
                        className="flex-grow cursor-pointer"
                        onClick={(e) => {
                          if (selectMode) toggleProjectSelect(project.id, e);
                          else window.location.href = `/?load=${project.id}`;
                        }}
                      >
                        {selectMode && (
                          <div
                            onClick={(e) => toggleProjectSelect(project.id, e)}
                            className={`absolute top-4 left-4 z-40 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                              isSelected ? 'bg-[#2b65f0] border-transparent scale-110 shadow-lg' : 'bg-white/80 backdrop-blur-md border-white/50 shadow-sm hover:scale-105'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="aspect-video bg-slate-50 relative overflow-hidden">
                          {project.image_data && project.image_data.length > 1000 ? (
                            <img
                              src={project.image_data}
                              alt={project.name}
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 relative overflow-hidden group-hover:bg-blue-50 transition-colors">
                               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#2b65f0 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                               <Box size={40} className="text-slate-200 group-hover:text-blue-200 transition-colors relative z-10" />
                               <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em] mt-4 relative z-10">Blueprint Pending</span>
                            </div>
                          )}
                          {!selectMode && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                               <div className="flex items-center gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                     <ArrowUpRight size={16} />
                                  </div>
                                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Open System Specification</span>
                               </div>
                            </div>
                          )}
                        </div>
                        <div className="p-6 pb-2">
                          <h4 className={`text-sm font-black uppercase tracking-wide leading-tight transition-colors ${
                            isSelected ? 'text-[#2b65f0]' : 'text-slate-800 group-hover:text-blue-600'
                          }`}>
                            {project.name || 'Untitled Design'}
                          </h4>
                          <div className="flex items-center gap-2 text-slate-400 mt-2">
                            <Database size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {new Date(project.created_at || project.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Isolated Actions Area: Favorite, BOM, Delete */}
                      <div className="p-6 pt-2 border-t border-slate-50 flex justify-between items-center gap-4 relative z-50">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openBOM(project); }}
                            className="bg-slate-50/50 border border-slate-100 text-slate-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-500 transition-all p-2 rounded-xl shadow-sm"
                            title="Bill of Materials"
                          >
                            <ClipboardList size={20} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteProject(project.id, e); }}
                            className="bg-slate-50/50 border border-slate-100 text-slate-600 hover:bg-red-50 hover:border-red-100 hover:text-red-500 transition-all p-2 rounded-xl shadow-sm"
                            title="Purge Record"
                          >
                            <Trash2 size={20} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleFavorite(project.id, e); 
                            }}
                            style={{ 
                              backgroundColor: (project.is_favourite == 1 || project.is_favourite === true) ? '#22c55e' : '#f1f5f9',
                              color: (project.is_favourite == 1 || project.is_favourite === true) ? 'white' : '#94a3b8',
                              border: '1px solid ' + ((project.is_favourite == 1 || project.is_favourite === true) ? '#16a34a' : '#e2e8f0')
                            }}
                            className="transition-all p-2 rounded-xl flex items-center gap-1 shadow-sm"
                            title={(project.is_favourite == 1 || project.is_favourite === true) ? "Remove from Favorites" : "Mark as Favorite"}
                          >
                            <Heart 
                              size={20} 
                              fill={(project.is_favourite == 1 || project.is_favourite === true) ? "white" : "transparent"} 
                              stroke={(project.is_favourite == 1 || project.is_favourite === true) ? "white" : "currentColor"}
                              strokeWidth={2}
                            />
                            {(project.is_favourite == 1 || project.is_favourite === true) && <span className="text-[12px] font-black italic">FAV!!!</span>}
                          </button>
                        </div>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-100 py-32 flex flex-col items-center justify-center text-center">
                  <Database size={48} className="text-slate-100 mb-6" />
                  <h5 className="text-lg font-bold text-slate-300 tracking-tight">No Projects found</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 px-10">No engineering designs have been committed yet.</p>
                </div>
              )}

              {/* Bulk Delete Action Bar */}
              {selectMode && selectedProjects.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-4 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-slate-900/40">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      {selectedProjects.size} project{selectedProjects.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="w-px h-5 bg-slate-600" />
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-500/30"
                    >
                      <Trash2 size={14} />
                      Delete Selected
                    </button>
                    <button
                      onClick={() => setSelectedProjects(new Set())}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'inventory' && (
            <InventoryView inventory={inventory} onRefresh={fetchInventory} onRestock={setRestockingItem} />
          )}

          {activeTab === 'add-component' && (
             <AddComponentsView onRefresh={fetchInventory} inventory={inventory} />
          )}
        </div>
      </div>

      {/* BOM Selection Modal Overlay */}
      {selectedBOM && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#e8f0fe]/50 backdrop-blur-md animate-in fade-in zoom-in duration-300">
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                 <div className="flex items-center gap-4">
                    <div className="w-1 h-10 bg-[#2b65f0] rounded-full" />
                    <div>
                       <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Engineering Bill of Materials</h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{selectedBOM.name}</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setSelectedBOM(null)}
                  className="p-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all shadow-sm border border-slate-100"
                 >
                    <X size={20} />
                 </button>
              </div>

               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                  {isBOMLoading && (
                     <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Querying Database...</span>
                     </div>
                  )}
                  <div className="mb-6 flex justify-between items-end">
                     <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated system tonnage</h4>
                        <div className="flex items-center gap-2 text-[#2b65f0]">
                           <Box size={14} className="opacity-50" />
                           <span className="text-sm font-black uppercase tracking-tighter">
                              St. Wt: {(() => {
                                 try {
                                    const comps = JSON.parse(selectedBOM.components_json || "[]");
                                    return calculateTotalWeight(comps).toLocaleString();
                                 } catch(e) { return "0.00"; }
                              })()} kg
                           </span>
                        </div>
                     </div>
                     <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 tabular-nums">
                           {new Date(selectedBOM.created_at || selectedBOM.timestamp).toLocaleDateString()}
                        </span>
                     </div>
                  </div>

                  <table className="w-full border-collapse">
                     <thead>
                        <tr className="border-b border-slate-100 text-left text-[9px]">
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest pl-2">Tag</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">Component</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">Material</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">OD (m)</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">Thk (m)</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">Len (m)</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest">Wt (kg)</th>
                           <th className="pb-4 font-black text-slate-400 uppercase tracking-widest text-right pr-2">Total Price</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {(() => {
                           try {
                              const components = JSON.parse(selectedBOM.components_json || "[]");
                              if (components.length === 0) return <tr><td colSpan="8" className="py-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No components found</td></tr>;
                              return components.map((comp, idx) => {
                                 const metrics = calculateComponentMetrics(comp);
                                 const cost = calculateComponentCost(comp);
                                 const typeIdx = components.filter((c, i) => i < idx && c.component_type === comp.component_type).length;
                                 const tag = getComponentTag(comp.component_type, typeIdx);
                                 return (
                                    <tr key={comp.id || idx} className="group hover:bg-slate-50/50 transition-colors">
                                       <td className="py-4 pl-2 text-[10px] font-black text-[#2b65f0] uppercase tracking-tighter">{tag}</td>
                                       <td className="py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">
                                          <div className="flex items-center gap-2">
                                             {(() => {
                                                const part = LIBRARY_PARTS.find(p => p.type === comp.component_type);
                                                return part ? React.cloneElement(part.icon, { size: 14, style: { color: part.color } }) : <Package size={14} className="text-slate-400" />;
                                             })()}
                                             <span>{comp.component_type.replace(/-/g, " ")}</span>
                                          </div>
                                       </td>
                                       <td className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{metrics.material}</td>
                                       <td className="py-4 text-[10px] font-mono text-slate-500">{metrics.od.toFixed(3)}</td>
                                       <td className="py-4 text-[10px] font-mono text-slate-500">{metrics.thick.toFixed(4)}</td>
                                       <td className="py-4 text-[10px] font-mono text-slate-500">{metrics.length.toFixed(2)}</td>
                                       <td className="py-4 text-[10px] font-mono text-[#2b65f0] font-black">{metrics.weight.toFixed(2)}</td>
                                       <td className="py-4 text-right pr-2">
                                          <span className="text-xs font-black text-slate-800 tabular-nums">
                                             ₹{formatIndianNumber(cost * (1 + GST_RATE))}
                                          </span>
                                       </td>
                                    </tr>
                                 );
                              });
                           } catch (e) {
                              console.error("BOM Modal Error:", e);
                              return <tr><td colSpan="8" className="py-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Error generating technical BOM</td></tr>;
                           }
                        })()}
                     </tbody>
                  </table>
               </div>

               <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                  <div className="flex gap-4">
                     <button 
                        onClick={() => handleExportExcel(selectedBOM)}
                        className="flex items-center gap-2 px-6 py-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                     >
                        <ShoppingCart size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Excel BOM</span>
                     </button>
                     <button 
                        onClick={() => handleExportPDF(selectedBOM)}
                        className="flex items-center gap-2 px-6 py-3 bg-[#2b65f0] hover:bg-[#1d4ed8] text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                     >
                        <ClipboardList size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Blueprint PDF</span>
                     </button>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total System Value (with GST)</p>
                     <p className="text-2xl font-black text-[#2b65f0] tabular-nums tracking-tighter italic">
                        ₹{(() => {
                           try {
                              const comps = JSON.parse(selectedBOM.components_json || "[]");
                              return formatIndianNumber(calculateTotalCost(comps, true));
                           } catch(e) { return "0.00"; }
                        })()}
                     </p>
                  </div>
               </div>
           </div>
        </div>
      )}
      {/* Restock Modal */}
      {restockingItem && (
        <RestockModal 
          item={restockingItem} 
          onClose={() => setRestockingItem(null)} 
          onRefresh={fetchInventory}
        />
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div className="relative group pl-2">
      {/* Top Concave Curve */}
      {active && (
        <div className="absolute -top-[20px] right-0 w-[20px] h-[20px] bg-[#e8f0fe] pointer-events-none">
          <div className="w-full h-full bg-[#2b65f0] rounded-br-[20px]" />
        </div>
      )}

      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-4 rounded-l-full transition-all text-sm font-bold relative z-10 ${active
          ? 'bg-[#e8f0fe] text-[#2b65f0]'
          : 'hover:bg-white/5 text-white/60 hover:text-white'
          }`}
      >
        <div className={active ? 'text-[#2b65f0]' : 'text-white/40 group-hover:text-white'}>
          {icon}
        </div>
        <span>{label}</span>
      </button>

      {/* Bottom Concave Curve */}
      {active && (
        <div className="absolute -bottom-[20px] right-0 w-[20px] h-[20px] bg-[#e8f0fe] pointer-events-none">
          <div className="w-full h-full bg-[#2b65f0] rounded-tr-[20px]" />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, alert, infoList, infoTitle, infoAlignLeft }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className={`rounded-3xl p-6 border transition-all flex items-center justify-between relative ${alert ? 'bg-[#FDF2F2] border-[#FEE2E2] shadow-sm ring-1 ring-red-100' : 'bg-white border-slate-50 shadow-sm'
      }`}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${color}`}>
            {React.cloneElement(icon, { size: 16 })}
          </div>
          <span className="text-2xl font-black text-slate-800 tracking-tight">{value}</span>
        </div>
        <p className={`text-[11px] font-bold uppercase tracking-widest ${alert ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
      </div>

      {infoList && (
        <div className="relative">
          <div
            className="cursor-pointer text-slate-400 hover:text-[#2b65f0] transition-colors p-2 -mr-2"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info size={16} />
          </div>

          {showInfo && (
            <div className={`absolute top-full ${infoAlignLeft ? 'right-0' : 'right-[-80px]'} mt-2 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl z-[100] ${infoList.length > 5 ? 'min-w-[320px]' : 'min-w-[150px]'} pointer-events-auto`}>
              <div className="font-black text-[10px] uppercase tracking-[0.2em] text-blue-400 mb-3 border-b border-white/5 pb-2">
                {infoTitle || 'Information'}
              </div>
              <div className={`grid ${infoList.length > 5 ? 'grid-cols-2' : 'grid-cols-1'} gap-x-4 gap-y-2`}>
                {infoList.map((item, idx) => (
                  <div key={idx} className="text-[10px] font-bold opacity-80 hover:opacity-100 hover:text-blue-300 transition-colors uppercase truncate">
                    • {item}
                  </div>
                ))}
                {infoList.length === 0 && <div className="text-[10px] opacity-40 font-bold uppercase italic">No Data available</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BarRow({ label, value, max }) {
  const percentage = (value / max) * 100;
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-slate-500 font-bold md:w-32 truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-[#2b65f0] rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-slate-400 font-bold w-12 text-right">{value}k</span>
    </div>
  );
}

/* --- ANALYTICS COMPONENTS --- */

function EditableValue({ itemId, field, value, label, prefix = '', suffix = '', colorClass, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSubmit = () => {
    setIsEditing(false);
    if (parseFloat(inputValue) !== parseFloat(value)) {
      onUpdate(itemId, field, inputValue);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        className="w-16 bg-white border border-blue-200 rounded px-1 text-[10px] font-black text-center outline-none focus:ring-2 focus:ring-blue-100"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:underline decoration-dotted transition-all ${colorClass}`}
      title="Click to edit"
    >
      {label} ({prefix}{Math.floor(value)}{suffix})
    </span>
  );
}

function ModalChartSection({ title, data, unitLabel, onUpdateStock }) {
  if (data.length === 0) return null;
  
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-8 border-b border-slate-50 pb-4">
         <div className="w-1.5 h-4 bg-[#2b65f0] rounded-full" />
         <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{title} <span className="text-slate-400">({unitLabel})</span></span>
      </div>
      
      <div className="space-y-6">
        {data.map((item) => {
          const remaining = Math.max(parseFloat(item.quantity) || 0, 0);
          const used = Math.max(parseFloat(item.used_quantity) || 0, 0);
          const currentTotal = remaining + used;
          const barMax = item.unit === 'm' ? 10000 : currentTotal;
          
          const usedPct = Math.min((used / barMax) * 100, 100);
          const remPct = Math.min((remaining / barMax) * 100, 100 - usedPct);

          return (
            <div key={item.id} className="group">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{item.component_type.replace(/_/g, ' ')}</span>
                <div className="flex gap-4">
                  <EditableValue 
                    itemId={item.id} 
                    field="used" 
                    value={used} 
                    label="Used" 
                    colorClass="text-blue-500 font-bold"
                    onUpdate={onUpdateStock}
                  />
                  <EditableValue 
                    itemId={item.id} 
                    field="rem" 
                    value={remaining} 
                    label="Rem" 
                    colorClass="text-slate-400 font-bold"
                    onUpdate={onUpdateStock}
                  />
                </div>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-lg overflow-hidden flex shadow-inner group-hover:bg-slate-200/50 transition-colors">
                 <div 
                  className="h-full bg-blue-600 transition-all duration-700 relative flex items-center justify-center" 
                  style={{ width: `${usedPct}%` }}
                 >
                    <div className="absolute inset-0 bg-white/10" />
                 </div>
                 <div 
                  className="h-full bg-[#f1f5f9] transition-all duration-700 delay-100" 
                  style={{ width: `${remPct}%` }}
                 />
              </div>
              <div className="flex justify-between mt-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">
                 <span>{usedPct.toFixed(0)}% Utilization</span>
                 <span>Cap: {barMax} {item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaterialDetailModal({ material, items, onClose, onRefresh }) {
  const pipesData = items.filter(i => i.unit === 'm');
  const fittingsData = items.filter(i => i.unit !== 'm');

  const handleUpdateStock = async (itemId, field, newValue) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updatedItem = {
      ...item,
      [field === 'used' ? 'used_quantity' : 'quantity']: parseFloat(newValue) || 0
    };

    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [updatedItem] })
      });

      if (response.ok) {
        onRefresh && onRefresh();
      } else {
        alert('Failed to update inventory');
      }
    } catch (err) {
      console.error('Update inventory error:', err);
      alert('Error updating stock');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#e8f0fe]/50 backdrop-blur-md animate-in fade-in duration-300">
       <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-white/20">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white/50">
             <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase italic">{material.replace(/_/g, ' ')} INVENTORY</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Live component-level tracking (Click totals to edit)</p>
             </div>
             <button 
              onClick={onClose}
              className="p-3 bg-white hover:bg-slate-50 text-slate-400 rounded-2xl transition-all shadow-sm border border-slate-100"
             >
                <X size={20} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-12 scroller-thin">
             <ModalChartSection title="Pipes & Structural" data={pipesData} unitLabel="meters" onUpdateStock={handleUpdateStock} />
             <ModalChartSection title="Fittings & Components" data={fittingsData} unitLabel="pieces" onUpdateStock={handleUpdateStock} />
             {items.length === 0 && (
                <div className="py-20 text-center opacity-30">
                   <Package size={48} className="mx-auto mb-4" />
                   <span className="text-xs font-black uppercase tracking-widest">No components mapped</span>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}

function StockUsageChart({ inventory, onRefresh }) {
  const [selectedMaterialForDetails, setSelectedMaterialForDetails] = useState(null);

  const materials = [...new Set(inventory.filter(i => i.material).map(i => i.material))].sort();
  
  const materialStats = materials.map(m => {
    const items = inventory.filter(item => item.material === m);
    const stock = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const used = items.reduce((sum, i) => sum + (parseFloat(i.used_quantity) || 0), 0);
    return { material: m, stock, used, items };
  });

  const maxVal = Math.max(...materialStats.map(m => m.stock + m.used), 1);

  return (
    <div className="bg-white rounded-[40px] p-12 border border-slate-100 flex flex-col h-[600px] shadow-[0_4px_30px_rgba(0,0,0,0.02)] relative overflow-hidden">
      <div className="flex justify-between items-start mb-16 relative z-10">
        <div>
          <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter mb-2">Inventory Analytics Landscape</h4>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
            <Activity size={12} className="text-blue-500" />
            Dynamic Material Mapping (Click bars for deep-dive)
          </p>
        </div>
        <div className="flex gap-10 bg-slate-50/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-sm">
           <div className="flex items-center gap-3">
             <div className="w-4 h-4 rounded-lg bg-[#2b65f0] shadow-lg shadow-blue-500/20" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consumed (Used)</span>
           </div>
           <div className="flex items-center gap-3">
             <div className="w-4 h-4 rounded-lg bg-slate-200" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available Stock</span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-start gap-12 pb-14 px-8 relative z-0 overflow-x-auto scroller-thin custom-scrollbar">
        {materialStats.map(stat => {
          const usedPct = (stat.used / maxVal) * 100;
          const stockPct = (stat.stock / maxVal) * 100;
          const totalUnits = stat.stock + stat.used;

          return (
            <div key={stat.material} className="flex flex-col items-center group relative h-full flex-shrink-0 w-32 pt-14">
               {/* Total Count Stack (Above Bar) */}
               <div className="absolute top-0 flex flex-col items-center">
                  <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Total</div>
                  <div className="text-[11px] font-black text-slate-700 tracking-tight">{Math.floor(totalUnits).toLocaleString()}</div>
               </div>

               {/* The Vertical Bar Stack */}
               <div 
                onClick={() => setSelectedMaterialForDetails(stat)}
                className="w-8 flex flex-col-reverse rounded-full overflow-hidden cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all duration-500 border border-slate-100 shadow-inner relative group-hover:shadow-[0_20px_40px_rgba(43,101,240,0.1)] group-hover:scale-[1.05]"
                style={{ height: '100%' }}
               >
                  <div className="w-full bg-slate-200 transition-all duration-1000 delay-100 hover:brightness-105" style={{ height: `${stockPct}%` }} />
                  <div className="w-full bg-[#2b65f0] transition-all duration-1000 relative hover:brightness-110" style={{ height: `${usedPct}%` }}>
                     <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                     <div className="absolute inset-x-0 top-0 h-4 bg-white/20 blur-[8px]" />
                  </div>
                  
                  {/* Detailed Info Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-blue-600/5 backdrop-blur-[2px]">
                     <div className="px-5 py-3 bg-white text-[#2b65f0] rounded-[20px] shadow-2xl flex items-center gap-3 border border-blue-50">
                        <Info size={16} />
                     </div>
                  </div>
               </div>

               {/* Metrics Stack (Below Bar) */}
               <div className="mt-6 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none mb-2">
                    {stat.material.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-black text-[#2b65f0] tracking-tight leading-none mb-1">
                    {Math.floor(stat.used).toLocaleString()}
                  </span>
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">
                    Uses
                  </span>
               </div>
            </div>
          );
        })}
        
        {materialStats.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 italic">
             <Box size={64} className="mb-6 text-slate-200" />
             <span className="text-sm font-black uppercase tracking-[0.5em] text-slate-300">Warehouse Empty</span>
          </div>
        )}
      </div>

      {selectedMaterialForDetails && (
        <MaterialDetailModal 
          material={selectedMaterialForDetails.material}
          items={selectedMaterialForDetails.items}
          onClose={() => setSelectedMaterialForDetails(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}


function RestockModal({ item, onClose, onRefresh }) {
  const [amount, setAmount] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const newQuantity = parseFloat(item.quantity) + parseFloat(amount);
    
    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ ...item, quantity: newQuantity }] })
      });
      if (response.ok) {
        onRefresh();
        onClose();
      } else {
        alert('Failed to restock material');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during restock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#e8f0fe]/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 border border-slate-100 animate-in zoom-in duration-300">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Manual Restock</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {item.component_type.replace(/-/g, ' ')} ({item.material})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 rounded-2xl p-4">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Current Inventory</label>
             <div className="text-lg font-black text-slate-800 tracking-tight">{Math.floor(item.quantity)} {item.unit || 'PCS'}</div>
          </div>
          
          <div>
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Restock Quantity</label>
             <div className="flex items-center gap-4">
                <input 
                  type="number"
                  className="flex-1 bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-blue-500 transition-all shadow-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
             </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-[#2b65f0] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
          >
            {isSubmitting ? 'Syncing...' : 'Update Warehouse Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
