import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function NotificationToast({ notifications, onRemove, darkMode }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((note) => (
        <ToastItem 
          key={note.id} 
          note={note} 
          onRemove={() => onRemove(note.id)} 
          darkMode={darkMode} 
        />
      ))}
    </div>
  );
}

function ToastItem({ note, onRemove, darkMode }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 400); // Wait for fade out animation
    }, 5000); // 5 seconds display
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-500" size={18} />,
    error: <AlertCircle className="text-rose-500" size={18} />,
    info: <Info className="text-blue-500" size={18} />,
  };

  const colors = {
    success: darkMode ? 'border-emerald-500/30 bg-slate-900/90' : 'border-emerald-100 bg-white/90',
    error: darkMode ? 'border-rose-500/30 bg-slate-900/90' : 'border-rose-100 bg-white/90',
    info: darkMode ? 'border-blue-500/30 bg-slate-900/90' : 'border-blue-100 bg-white/90',
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-md
        transition-all duration-400 transform
        ${isExiting ? 'opacity-0 translate-x-12 scale-95' : 'opacity-100 translate-x-0 scale-100'}
        ${colors[note.type] || colors.info}
        animate-in slide-in-from-right-8 fade-in duration-300
      `}
      style={{ minWidth: '280px', maxWidth: '400px' }}
    >
      <div className="flex-shrink-0">
        {icons[note.type] || icons.info}
      </div>
      <div className="flex-grow">
        <p className={`text-[11px] font-black uppercase tracking-widest mb-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {note.type === 'success' ? 'Inventory Updated' : 'System Message'}
        </p>
        <p className={`text-[13px] font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {note.message}
        </p>
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onRemove, 400);
        }}
        className={`p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
