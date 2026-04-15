import { useState, useRef } from 'react';
import { Menu, Save, Share2, ZoomIn, ZoomOut, Box, Download, Settings, Trash2, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Plus, Minus, Info, Maximize2, Minimize2, Palette, Shield, Wind, Droplets, Zap, Users, Search, Moon, Sun, Database, Lock, Unlock, FileText, Layout, Plug, Layers, Copy, History, Undo, Redo, ChevronDown, Table, MousePointer2, CheckCircle2 } from 'lucide-react';
import { formatIndianNumber } from '../utils/pricing.js';
import logoImage from '../assets/logo.png';

export default function Toolbar({
  designName,
  onRename,
  onSave,
  onNewDesign,
  componentCount,
  totalCost,
  onShowMaterials,
  onShowInventory,
  darkMode,
  onToggleTheme,
  isMobile,
  onToggleLibrary,
  showLibrary,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isLocked,
  onToggleLock,
  onExportExcel,
  onExport,
  isSaving,
  user,
  onLogout,
  connectionMode,
  onToggleConnection,
  showColorDifferentiation,
  onToggleColorDifferentiation,
  showSketchMode,
  onToggleSketchMode,
  showFlow,
  onToggleFlow
}) {

  return (
    <div className={`transition-colors duration-300 backdrop-blur-xl border-b flex items-center gap-4 px-4 lg:px-6 z-40 shadow-sm ${isMobile ? 'h-20 lg:h-24' : 'h-24'} ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/70 border-blue-100/50'}`}>
      <div className="flex items-center gap-1 group/name">
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              onClick={onToggleLibrary}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${showLibrary ? 'bg-blue-600 border-blue-500 text-white' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-blue-100 text-slate-400')}`}
              title="Toggle Library"
            >
              <Plus size={18} className={showLibrary ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>
          )}
          <div className="flex items-center justify-center">
            <img src={logoImage} alt="P3D Logo" className="h-14 lg:h-[72px] w-auto object-contain" style={{ minWidth: '40px' }} />
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className={`font-black text-base lg:text-xl leading-none tracking-tight transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>Pipe3D <span className="text-blue-600 italic">PRO</span></span>
            {!isMobile && <span className={`text-[8px] font-bold tracking-[0.3em] ml-0.5 uppercase transition-colors ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Engineering Excellence</span>}
          </div>
        </div>
        {!isMobile && (
          <>
            <div className={`h-10 w-px transition-colors ${darkMode ? 'bg-slate-800' : 'bg-blue-100'}`} />
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={designName}
                onChange={(e) => onRename(e.target.value)}
                className={`bg-transparent text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded border border-transparent transition-all w-32 xl:w-48 focus:outline-none ${darkMode ? 'text-white hover:border-slate-700 focus:border-blue-500 focus:bg-slate-800/50' : 'text-slate-900 hover:border-blue-100 focus:border-blue-300 focus:bg-white/50'}`}
                placeholder="Project Name..."
              />
              <button
                onClick={onSave}
                disabled={isSaving}
                className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isSaving
                  ? (darkMode ? 'bg-slate-800 border-blue-500/30' : 'bg-blue-50 border-blue-200')
                  : (darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-blue-100 hover:bg-blue-50')
                  }`}>
                {isSaving ? (
                  <RotateCw size={18} className={`animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                ) : (
                  <Save size={18} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isMobile && (
          <>
            <button
              onClick={onToggleTheme}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50'}`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={onShowInventory}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50'}`}
              title="Inventory Manager (MSSQL)"
            >
              <Database size={18} />
            </button>
          </>
        )}

        <div className="flex-grow" />

        <button
          onClick={onShowMaterials}
          className={`flex items-center gap-2 lg:gap-4 px-3 lg:px-4 py-2 lg:py-2.5 transition-all duration-300 border group shadow-sm hover:shadow-lg rounded-xl ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-blue-50/50 border-blue-100/50 hover:bg-blue-600 hover:border-blue-500'}`}
          title="View Bill of Materials"
        >
          <div className="flex items-center gap-1.5 lg:gap-2">
            {!isMobile && <span className={`text-[10px] self-center transition-colors ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>₹</span>}
            <span className={`font-bold text-sm lg:text-lg font-mono tracking-tight transition-colors group-hover:text-white ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatIndianNumber(totalCost)}</span>
            {!isMobile && <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors group-hover:text-blue-200 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Estimate</span>}
          </div>
          {!isMobile && (
            <>
              <div className={`h-4 w-px transition-colors ${darkMode ? 'bg-slate-700' : 'bg-blue-100'} group-hover:bg-blue-400/30`} />
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium transition-colors group-hover:text-white ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{componentCount} items</span>
                <Info size={14} className={`transition-colors group-hover:text-blue-100 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
            </>
          )}
        </button>

        <div className="flex items-center gap-2 border-x px-2 mx-1 border-blue-100/30">
          <button
            onClick={onToggleLock}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${isLocked
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
              : (darkMode ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50')
              }`}
            title={isLocked ? "Unlock View" : "Lock View"}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>
          <button
            onClick={onToggleColorDifferentiation}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${showColorDifferentiation
              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
              : (darkMode ? 'bg-slate-800 border-slate-700 text-purple-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-purple-600 hover:bg-blue-50')
              }`}
            title={showColorDifferentiation ? "Disable Color Differentiation" : "Enable Color Differentiation"}
          >
            <Palette size={18} />
          </button>
          <button
            onClick={onToggleSketchMode}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${showSketchMode
              ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20'
              : (darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-amber-600 hover:bg-blue-50')
              }`}
            title={showSketchMode ? "Disable Sketch Mode" : "Enable Artistic Sketch Mode"}
          >
            <Zap size={18} />
          </button>
          <button
            onClick={onToggleFlow}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${showFlow
              ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 animate-pulse'
              : (darkMode ? 'bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-cyan-600 hover:bg-blue-50')
              }`}
            title={showFlow ? "Stop Industrial Flow" : "Start Industrial Flow Animation"}
          >
            <Droplets size={18} className={showFlow ? 'fill-current' : ''} />
          </button>
          <button
            onClick={onToggleConnection}

            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${connectionMode
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
              : (darkMode ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50')
              }`}
            title={connectionMode ? "Cancel Connection" : "Socket-to-Socket Connection"}
          >
            <div className="flex items-center gap-1.5">
              <Plug size={18} className={connectionMode ? "rotate-90 transition-transform text-white" : "transition-transform"} />
              {connectionMode && <span className="text-[9px] font-black uppercase tracking-tight text-white animate-pulse">Mode Active</span>}
            </div>
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm disabled:opacity-20 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50'}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm disabled:opacity-20 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50'}`}
            title="Redo (Ctrl+Y)"
          >
            <Redo size={18} />
          </button>
        </div>

        <button
          onClick={onNewDesign}
          className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50'}`}
          title="New Design"
        >
          <Plus size={18} />
        </button>

        {!isMobile && (
          <button
            onClick={onLogout}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2 rounded-xl border transition-all active:scale-95 shadow-sm group/logout ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50' : 'bg-white/80 hover:bg-rose-50 text-slate-600 border-blue-100 hover:text-rose-600 hover:border-rose-200'}`}
            title="Logout"
          >
            <Lock size={16} className="group-hover/logout:scale-110 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-tight">Exit</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-5 lg:px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-900/10 transition-all active:scale-95 border border-blue-600 group/blueprint"
          disabled={isSaving}
        >
          <FileText size={18} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] lg:text-xs font-black uppercase tracking-tight">Blueprint</span>
        </button>
      </div>
    </div>
  );
}
