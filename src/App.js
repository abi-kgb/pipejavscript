import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { findSnapPoint, findSnapForTransform, checkIntersection, calculateManualConnection, autoConnect, checkConnectionCompatibility } from './utils/snapping.js';
import Scene3D from './components/Scene3D';
import ComponentLibrary from './components/ComponentLibrary';
import Toolbar from './components/Toolbar';
import { calculateTotalCost } from './utils/pricing.js';
import MaterialsList from './components/MaterialsList';
import ResizablePane from './components/ResizablePane';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getComponentTag } from './utils/tagging.js';
import { applyTechnicalDrawing } from './utils/exportUtils.js';
import * as XLSX from 'xlsx';
import { calculateComponentMetrics, calculateComponentCost } from './utils/pricing.js';
import AuthPage from './components/AuthPage';
import { COMPONENT_DEFINITIONS, MATERIALS } from './config/componentDefinitions.js';
import InventoryManager from './components/InventoryManager';
import NotificationToast from './components/NotificationToast';
import Dashboard from './components/Dashboard';

function App() {

  useEffect(() => {
    const handleGlobalClick = (e) => {
      try {
        console.log(`[Global/Click] target:${e?.target?.tagName}.${e?.target?.className}, x:${e?.clientX}, y:${e?.clientY}`);
      } catch (err) { }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const [components, setComponents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [placingType, setPlacingType] = useState(null);
  const [placingTemplate, setPlacingTemplate] = useState(null);
  const [designName, setDesignName] = useState('Untitled Design');
  const [currentProjectId, setCurrentProjectId] = useState(null); // DB id of the active project
  const [clipboard, setClipboard] = useState(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const [transformMode, setTransformMode] = useState('translate');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lastSaved, setLastSaved] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [connectionMode, setConnectionMode] = useState(false);
  const [selectedSockets, setSelectedSockets] = useState([]); // [{ componentId, socketIndex }]
  const [snapPivot, setSnapPivot] = useState(null); // { id: string, worldPos: Vector3, socketIndex: number, isAssembly: boolean }
  const sceneRef = useRef(null); // ref to Scene3D for export control
  const lastPlacementTime = useRef(0);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('pipe3d_theme') === 'dark';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showLibrary, setShowLibrary] = useState(window.innerWidth >= 1024);
  const [user, setUser] = useState(null); // 🎯 User requested non-persistent login on refresh
  const [showInventory, setShowInventory] = useState(false);
  const [showColorDifferentiation, setShowColorDifferentiation] = useState(false);
  const [showSketchMode, setShowSketchMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showFlow, setShowFlow] = useState(false);
  const [chainAnchor, setChainAnchor] = useState(null); // { componentId, socketIdx, worldPos, componentType }


  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Track window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setShowLibrary(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [pendingRefunds, setPendingRefunds] = useState([]); // Track committed parts deleted but not yet saved

  const fetchHistory = useCallback(() => {
    // 2. Fetch projects from history (Filter by current user + legacy anonymous projects)
    const fetchUrl = user?.id ? `/api/projects?userId=${user.id}` : '/api/projects';
    console.log('[App] Refreshing history from:', fetchUrl);
    fetch(fetchUrl)
      .then(res => {
        if (!res.ok) throw new Error('API history fetch failed');
        return res.json();
      })
      .then(data => {
        const historyData = Array.isArray(data) ? data : [];
        console.log('[App] Successfully fetched history:', historyData.length, 'records');
        setHistory(historyData);
      })
      .catch(err => {
        console.error('[App] Failed to fetch history:', err);
      });
  }, [user]);

  const fetchInventory = useCallback(() => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => setInventory(Array.isArray(data) ? data : []))
      .catch(err => console.error('[App] Failed to fetch inventory:', err));
  }, []);

  // Fetch history and dynamic materials from DB
  useEffect(() => {
    fetchHistory();
    fetchInventory();

    // Sync materials from Inventory DB to 3D Library
    fetch('/api/inventory/materials')
      .then(res => res.json())
      .then(dbMaterials => {
        if (Array.isArray(dbMaterials)) {
          dbMaterials.forEach(m => {
            const matKey = m.toLowerCase();
            if (!MATERIALS[matKey]) {
              // Register new material from DB with a default industrial grey
              MATERIALS[matKey] = { 
                id: matKey, 
                name: m.toUpperCase(), 
                density: 7850, 
                color: '#94a3b8' 
              };
              console.log(`[MaterialSync] Registered new material from DB: ${matKey}`);
            }
          });
        }
      })
      .catch(err => console.error('[App] Material sync failed:', err));

    // Poll inventory every 10 seconds to keep 3D library in sync with dashboard changes
    const interval = setInterval(fetchInventory, 10000);
    return () => clearInterval(interval);
  }, [fetchHistory, fetchInventory]);
  const [userParts, setUserParts] = useState(() => {
    try {
      const saved = localStorage.getItem('pipe3d_user_parts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // --- UNDO / REDO STATE ---
  const [historyStack, setHistoryStack] = useState([[]]); // Start with empty state
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = useCallback((newComps) => {
    setHistoryStack(prev => {
      const nextStack = prev.slice(0, historyIndex + 1);
      const lastState = nextStack[nextStack.length - 1];

      // Don't save if state is identical to last (using a faster check if possible, or just keeping it)
      if (lastState && JSON.stringify(lastState) === JSON.stringify(newComps)) return prev;

      const updatedStack = [...nextStack, structuredClone(newComps)];
      // Limit history to 50 steps
      const finalStack = updatedStack.length > 50 ? updatedStack.slice(1) : updatedStack;

      // Update index to match the new stack top
      setHistoryIndex(finalStack.length - 1);
      return finalStack;
    });
  }, [historyIndex]);


  // Re-sync components and save to history in one flow to avoid double re-renders
  const updateComponentsWithHistory = useCallback((newComps) => {
    setComponents(newComps);
    saveToHistory(newComps);
  }, [saveToHistory]);

  // Helper: decrement inventory for a list of components in one batch request
  const decrementInventoryBatch = useCallback(async (comps) => {
    if (!comps || comps.length === 0) return;

    // Check if input is already formatted for the API { component_type, material, amount }
    const first = comps[0];
    const items = (first && first.component_type && first.material && first.amount !== undefined)
      ? comps.map(c => ({
          component_type: (c.component_type || '').toString().toLowerCase(),
          material: (c.material || 'pvc').toString().toLowerCase(),
          amount: parseFloat(c.amount) || 0
        }))
      : comps.map(comp => ({
        component_type: (comp.component_type || '').toString().toLowerCase(),
        material: (comp.properties?.material || 'pvc').toString().toLowerCase(),
        amount: (comp.component_type === 'straight' || comp.component_type === 'vertical')
          ? (parseFloat(comp.properties?.length) || 2)
          : 1
      }));
    try {
      const res = await fetch('/api/inventory/use-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        if (items.length === 1) {
          const item = items[0];
          addNotification(`✅ ${item.component_type.toUpperCase()} deducted from inventory.`, 'success');
        } else {
          addNotification(`✅ Assembly (${items.length} parts) deducted from inventory.`, 'success');
        }
      }
    } catch (err) {
      console.error('Inventory Batch Update Failed:', err);
      addNotification('❌ Inventory update failed. Server unavailable.', 'error');
    }
  }, [addNotification]);


  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setComponents(structuredClone(historyStack[prevIdx]));
      setHistoryIndex(prevIdx);
      setSelectedIds([]);
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setComponents(structuredClone(historyStack[nextIdx]));
      setHistoryIndex(nextIdx);
      setSelectedIds([]);
    }
  }, [historyIndex, historyStack]);

  const handleSaveToHistory = useCallback(async (providedImageData, providedComponents, options = {}) => {
    const { isSilent = false } = options;
    const finalComponents = providedComponents || components;
    if (finalComponents.length === 0) {
      if (!isSilent) alert('Cannot save an empty project.');
      return null;
    }

    if (!isSilent) setIsSaving(true);
    try {
      // Guard: If called directly as an event handler, the first arg will be a React Event object.
      // We must ignore it to avoid circular structure errors during JSON.stringify.
      let image_data = (providedImageData && typeof providedImageData === 'object' && (providedImageData.nativeEvent || providedImageData.target))
        ? ''
        : (providedImageData || '');


      if (!image_data && sceneRef.current) {
        if (isSilent) {
          // Optimization: During background sync, don't capture a new 3D view (saves significant time/delay)
          // Look for an existing image in history to preserve it
          const searchName = (designName || '').trim().toLowerCase();
          const existing = history.find(h => (h.name || '').trim().toLowerCase() === searchName);
          
          // 🛡️ Image Stability Guard: Only use captured canvas if it looks like a valid 3D render (>15KB).
          // Otherwise, stick with whatever image we already have in history.
          const canvas = document.querySelector('canvas');
          const captured = canvas ? canvas.toDataURL('image/jpeg', 0.2) : '';
          
          if (captured && captured.length > 15000) {
            image_data = captured;
          } else {
            image_data = existing?.image_data || '';
          }
        } else {
          // Manual save: capture a high-quality (but now faster) thumbnail
          const captureResult = await sceneRef.current.captureViews(['iso'], ['color']) || {};
          const images = captureResult.images || captureResult; // handle both old and new shape
          image_data = images['iso_color'] || '';
        }
      }

      // 2. Build BOM summary (ONLY for non-committed / newly added components)
      // This ensures existing parts don't get double-deducted upon modify/save update.
      const uncommittedComponents = finalComponents.filter(c => !c.isCommitted);
      let typeCounts = null;

      if (uncommittedComponents.length > 0) {
        typeCounts = {};
        uncommittedComponents.forEach(c => {
          const type = (c.component_type || '').toLowerCase();
          const material = (c.properties?.material || 'pvc').toLowerCase();
          const isPipe = ['straight', 'vertical', 'wall', 'cylinder'].includes(type);
          
          // For pipes, we deduct the actual length in meters. For fittings, we deduct 1 piece.
          const amount = isPipe ? (parseFloat(c.properties?.length) || 1.0) : 1.0;
          
          const key = `${type}|${material}`; // Use | to avoid conflicts with underscores in material names
          typeCounts[key] = (typeCounts[key] || 0) + amount;
        });
      }

      // Add PENDING REFUNDS (things we deleted that were already committed)
      const refundBom = {};
      if (pendingRefunds.length > 0) {
        pendingRefunds.forEach(c => {
          const type = (c.component_type || '').toLowerCase();
          const material = (c.properties?.material || 'pvc').toLowerCase();
          const isPipe = ['straight', 'vertical', 'wall', 'cylinder'].includes(type);
          const amount = isPipe ? (parseFloat(c.properties?.length) || 1.0) : 1.0;

          const key = `${type}|${material}`;
          refundBom[key] = (refundBom[key] || 0) + amount;
        });
      }

      // Prepare the data to be saved (Full project state)
      // Every part in the DB should be considered "committed" for future loads.
      const dbComponents = finalComponents.map(c => ({ ...c, isCommitted: true }));
      const fullProjectBom = {};
      finalComponents.forEach(c => {
        const key = `${c.component_type}_${c.properties?.material || 'pvc'}`;
        fullProjectBom[key] = (fullProjectBom[key] || 0) + 1;
      });

      const payload = {
        user_id: user?.id || null,
        name: designName || 'Untitled Design',
        components_json: JSON.stringify(dbComponents),
        bom_json: JSON.stringify(fullProjectBom),
        image_data: (typeof image_data === 'string') ? image_data : ''
      };

      // Use in-memory currentProjectId first (most reliable).
      // Fall back to name-match in history only as a safety net for first load.
      // Robust project ID resolution: prioritize matching by name in user history.
      // This ensures "Save" always hits the same project if the name matches (overwrite mode).
      const searchName = (designName || '').trim().toLowerCase();
      const existingProject = history.find(h => (h.name || '').trim().toLowerCase() === searchName);
      const targetId = existingProject?.id || currentProjectId || null;

      if (!isSilent) console.log(`[Save] Project: "${designName}", Detected Target ID: ${targetId}, Mode: ${targetId ? 'OVERWRITE (PUT)' : 'NEW (POST)'}`);

      const url = targetId
        ? `/api/projects/${targetId}`
        : '/api/projects';

      const res = await fetch(url, {
        method: targetId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        // Pin the project ID in memory so all subsequent auto-saves hit PUT
        const savedId = targetId || data.id;
        if (savedId) setCurrentProjectId(savedId);

        // Update history list state
        setHistory(prev => {
          if (targetId) {
            return prev.map(h => (h.id === targetId ? { ...h, name: designName, image_data } : h));
          } else {
            return [{
              id: data.id,
              name: designName,
              created_at: new Date().toISOString(),
              image_data
            }, ...prev];
          }
        });

        console.log('Project saved to history successfully.');

        // --- MSSQL INVENTORY DECREMENT (SAVES ONLY DELTA) ---
        // ONLY triggers for manual saves as per user request.
        if (!isSilent) {
          if (typeCounts) {
            const bomList = Object.entries(typeCounts).map(([key, amount]) => {
              const [type, material] = key.split('|');
              return { component_type: type, material, amount };
            });
            await decrementInventoryBatch(bomList);
          }

          // --- MSSQL INVENTORY REFUND ---
          if (Object.keys(refundBom).length > 0) {
            const refundList = Object.entries(refundBom).map(([key, amount]) => {
              const [type, material] = key.split('|');
              return { component_type: type, material, amount: -amount }; // NEGATIVE to add back
            });
            await decrementInventoryBatch(refundList);
          }

          // Local Commitment: Mark components as committed after successful manual save
          setComponents(prev => prev.map(c => ({ ...c, isCommitted: true })));
          setPendingRefunds([]); 
          setActiveTab('history');
        }
        return fullProjectBom; // Return the full BOM
      } else {
        if (!isSilent) alert(`❌ Failed to save project: ${data.details || data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to save project to DB:', err);
      if (!isSilent) alert(`❌ Failed to save project: ${err.message || 'Server connection error.'}`);
    } finally {
      if (!isSilent) setIsSaving(false);
    }
    return null;
  }, [designName, currentProjectId, user, history, components, pendingRefunds, addNotification, decrementInventoryBatch]);

  // ---------------------------------------------------------
  // HANDLER: Save Project (Only Saves to DB/History)
  // ---------------------------------------------------------
  const handleSaveDesign = useCallback(async () => {
    if (isSaving || components.length === 0) return;

    setIsSaving(true);
    setIsCapturing(true);
    setSelectedIds([]);

    try {
      // 1. Capture Snapshot (Longer delay for stable images)
      // Capturing a 3D view requires the renderer to be in a certain state. 
      // We wait for 400ms to ensure the scene is fully settled and rendered.
      await new Promise(r => setTimeout(r, 450));
      const captureResult = await sceneRef.current?.captureViews?.(['iso'], ['color']) || {};
      const imgMap = captureResult.images || captureResult;
      let thumbnail = imgMap['iso_color'];

      // Fallback: If capture is too small (likely blank/black), retry once
      if (!thumbnail || thumbnail.length < 10000) {
          console.warn('[Save] Thumbnail capture was small/empty. Retrying...');
          await new Promise(r => setTimeout(r, 300));
          const retryResult = await sceneRef.current?.captureViews?.(['iso'], ['color']) || {};
          const retryMap = retryResult.images || retryResult;
          thumbnail = retryMap['iso_color'] || thumbnail;
      }

      // 2. Save to database (will handle its own setIsSaving if not silent)
      const result = await handleSaveToHistory(thumbnail, components, { isSilent: false });
      if (result) {
        alert('✅ Project saved successfully!');
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('❌ Failed to save project.');
    } finally {
      setIsSaving(false);
      setIsCapturing(false);
    }
  }, [isSaving, components, handleSaveToHistory]);

  // ---------------------------------------------------------
  // HANDLER: Export Blueprint (Full PDF Generation)
  // ---------------------------------------------------------
  const handleExportBlueprint = useCallback(async () => {
    if (!sceneRef.current) return;
    setIsSaving(true);
    setIsCapturing(true);
    setSelectedIds([]);
    try {
      addNotification('🔄 Generating Technical Blueprint... Using Engineering Filter.', 'info');
      const requestedViews = ['iso', 'front', 'top', 'right', 'left', 'back', 'bottom'];

      // ── Capture all views ──────────────────────────────────────
      const captureResult = await sceneRef.current?.captureViews?.(requestedViews, ['pencil']) || {};
      const vResults = captureResult.images || captureResult; // handle both return shapes
      const pStats = captureResult.projectStats || null;

      if (Object.keys(vResults).length === 0) throw new Error("Capture engine returned no images.");

      // ── PDF in LANDSCAPE A4 so views are wider and clearer ──
      const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape
      const pW = pdf.internal.pageSize.getWidth();  // ~297 mm
      const pH = pdf.internal.pageSize.getHeight(); // ~210 mm

      // ── Stats string built from projectStats ────────────────────
      const statsStr = pStats
        ? `TOTAL: L ${pStats.width}m  ×  W ${pStats.depth}m  ×  H ${pStats.height}m  |  ${pStats.totalParts} Parts`
        : `Project: ${designName}`;

      // ── Header: 28 mm tall ──────────────────────────────────────
      const HEADER_H = 28;
      const drawH = (doc, title) => {
        // Dark banner
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pW, HEADER_H, 'F');

        // Left: logo
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text('Pipe3D PRO', 10, 12);

        // Centre: view title
        doc.setFontSize(15); doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), pW / 2, 12, { align: 'center' });

        // Right: date
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`DATE: ${new Date().toLocaleDateString()}`, pW - 10, 12, { align: 'right' });

        // Second row: project details
        doc.setFillColor(30, 41, 59);
        doc.rect(10, 18, pW - 20, 7, 'F');
        
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`PROJECT: ${designName.toUpperCase()}`, 15, 22.8);
        
        doc.setTextColor(52, 211, 153); // Emerald-400
        doc.text(statsStr, pW - 15, 22.8, { align: 'right' });
      };

      // ── Label renderer ──────────────────────────────────────────
      const drawL = (doc, labels, xO, yO, w, h) => {
        if (!labels || labels.length === 0) return;
        labels.forEach((l) => {
          const ox = xO + (l.x * w);
          const oy = yO + (l.y * h);
          const tagText = String(l.tag || l.text || 'ID');

          if (l.isOccluded) return;

          // 1. DYNAMIC SCALING: Tag circle mathematically bound to the physical component's outer diameter
          // This guarantees the circle is strictly 'inside' the pipe boundaries on the final PDF
          const componentOuterDiameter = l.width || 0.3; 
          const radiusScale = Math.min(2.5, Math.max(0.45, componentOuterDiameter * 2.2));
          const fSize = Math.max(1.8, radiusScale * 3.0); // 1.8pt minimum readable vector text

          doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.08);
          doc.circle(ox, oy, radiusScale, 'FD'); 
          doc.setTextColor(0, 0, 0); doc.setFontSize(fSize); doc.setFont('helvetica', 'bold'); 
          doc.text(tagText, ox, oy + (radiusScale * 0.35), { align: 'center' });

          // 3. Dimensions below circle
          const hasLen = l.length && l.length > 0;
          const isPipe = ['straight', 'vertical', 'cylinder'].includes(l.type);
          if (hasLen || l.width) {
            let dimText = `Ø${(l.width || 0).toFixed(2)}m`;
            if (isPipe && hasLen) dimText += ` × ${l.length.toFixed(2)}m`;
            const dimFSize = Math.max(1.6, fSize * 0.7);
            doc.setTextColor(110, 110, 110); doc.setFontSize(dimFSize); doc.setFont('helvetica', 'italic'); 
            doc.text(dimText, ox, oy + radiusScale + (dimFSize * 0.35), { align: 'center' }); 
          }
        });
      };

      // ── Footer ─────────────────────────────────────────────────
      const FOOTER_H = 8;
      const drawFooter = (doc, pageNum) => {
        doc.setFillColor(240, 242, 245);
        doc.rect(0, pH - FOOTER_H, pW, FOOTER_H, 'F');
        doc.setTextColor(100, 116, 139); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
        doc.text(`${designName} — Technical Engineering Blueprint`, 8, pH - 2.5);
        doc.text(`Page ${pageNum} of ${requestedViews.length + 1}`, pW - 8, pH - 2.5, { align: 'right' });
      };

      // ── Tag Legend panel at the bottom of each view page ────────
      const LEGEND_H = 30; // mm reserved at bottom of page for tag table
      const drawTagLegend = (doc, labels) => {
        const visibleLabels = (labels || []).filter(l => !l.isOccluded);
        if (visibleLabels.length === 0) return;

        const legendY = pH - FOOTER_H - LEGEND_H;

        // Legend header bar
        doc.setFillColor(15, 23, 42);
        doc.rect(5, legendY, pW - 10, 5.5, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text('TAG LEGEND', 8, legendY + 3.8);

        // Columns layout
        const colW = (pW - 10) / Math.min(visibleLabels.length, 6); // up to 6 cols
        const rowH = 5.5;
        const headerH = 5.5;
        const bodyY = legendY + headerH;

        // Column headers
        doc.setFillColor(30, 41, 59);
        doc.rect(5, bodyY, pW - 10, rowH, 'F');
        doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'bold'); doc.setFontSize(5);

        const cols = Math.min(visibleLabels.length, Math.floor((pW - 10) / 42));
        const cW = (pW - 10) / cols;

        for (let ci = 0; ci < cols; ci++) {
          const cx = 5 + ci * cW;
          doc.text('TAG', cx + 1, bodyY + 3.5);
          doc.text('COMPONENT', cx + 7, bodyY + 3.5);
          doc.text('DIMENSIONS', cx + 24, bodyY + 3.5);
        }

        // Rows
        const itemsPerCol = Math.ceil(visibleLabels.length / cols);
        visibleLabels.forEach((l, i) => {
          const col = Math.floor(i / itemsPerCol);
          const row = i % itemsPerCol;
          const cx = 5 + col * cW;
          const cy = bodyY + rowH + row * rowH;

          const bg = row % 2 === 0 ? [248, 250, 252] : [241, 245, 249];
          doc.setFillColor(...bg);
          doc.rect(cx, cy, cW, rowH, 'F');

          const tagText = String(l.tag || 'ID');
          const compName = (l.name || l.type || '').replace(/-/g, ' ').toUpperCase();
          const isPipe = ['straight', 'vertical', 'cylinder'].includes(l.type);
          let dimText = `Ø${(l.width || 0).toFixed(2)}m`;
          if (isPipe && l.length > 0) dimText += ` × ${l.length.toFixed(2)}m`;

          doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(15, 23, 42);
          doc.text(tagText, cx + 1, cy + 3.5);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(51, 65, 85);
          doc.text(compName.substring(0,12), cx + 7, cy + 3.5);
          doc.setTextColor(100, 116, 139);
          doc.text(dimText, cx + 24, cy + 3.5);
        });

        // Border around legend
        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2);
        doc.rect(5, legendY, pW - 10, LEGEND_H - 1, 'S');
      };

      // ── Render each view ────────────────────────────────────────
      const IMG_Y = HEADER_H + 3;   // top of image area
      const IMG_H = pH - IMG_Y - FOOTER_H - LEGEND_H - 2; // height available (shrunk for legend)
      const IMG_W = pW - 10;        // full width minus margins
      const IMG_X = 5;              // left margin

      const titles = {
        iso: '3D Isometric View', front: 'Front Elevation', top: 'Top Plan View',
        right: 'Right Side Elevation', left: 'Left Side Elevation',
        back: 'Back Elevation', bottom: 'Bottom View'
      };

      let pC = 0;
      for (const vid of requestedViews) {
        const res = vResults[`${vid}_pencil`];
        if (!res || !res.data) continue;
        if (pC > 0) pdf.addPage();

        drawH(pdf, titles[vid]);

        // Apply Sobel edge filter and place image to fill available area
        const techImg = await applyTechnicalDrawing(res.data);
        
        // Use Actual Image Properties to calculate aspect ratio (safest for A4 fitting)
        const props = pdf.getImageProperties(techImg);
        const asp = props.width / props.height;
        
        let finalW = IMG_W;
        let finalH = finalW / asp;
        
        // If the calculated height exceeds available space, scale based on height instead
        if (finalH > IMG_H) {
            finalH = IMG_H;
            finalW = finalH * asp;
        }
        
        // Centering precisely in the available space
        const finalX = IMG_X + (IMG_W - finalW) / 2;
        const finalY = IMG_Y + (IMG_H - finalH) / 2;
        
        pdf.addImage(techImg, 'PNG', finalX, finalY, finalW, finalH, undefined, 'FAST');

        drawL(pdf, res.labels, finalX, finalY, finalW, finalH);
        drawTagLegend(pdf, res.labels);
        drawFooter(pdf, ++pC);
      }

      // BOM Page
      pdf.addPage();
      drawH(pdf, 'Bill of Materials');
      const bMap = new Map();
      components.forEach((c, idx) => {
        const k = `${c.component_type}-${c.properties?.material || 'pvc'}-${c.properties?.od || 0.3}`;
        if (bMap.has(k)) bMap.get(k).qty++;
        else bMap.set(k, { type: c.component_type, mat: (c.properties?.material || 'pvc').toUpperCase(), qty: 1 });
      });
      const tR = Array.from(bMap.values()).map((r, i) => [i + 1, r.type.toUpperCase(), r.mat, `${r.qty} pcs`]);
      autoTable(pdf, { startY: 35, head: [['S.No', 'Component', 'Material', 'Quantity']], body: tR, theme: 'grid' });

      // Workshop Cut List
      const cutPipes = components.filter(c => ['straight', 'vertical', 'cylinder'].includes(c.component_type));
      if (cutPipes.length > 0) {
        const startY = pdf.lastAutoTable.finalY + 15;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(15, 23, 42);
        pdf.text('Workshop Cut List (Pipes Only)', 15, startY);
        const cutRows = cutPipes.map((c, idx) => {
          const typeIdx = components.filter((comp, i) => i < components.indexOf(c) && comp.component_type === c.component_type).length;
          return [
            getComponentTag(c.component_type, typeIdx, systemConfig?.NamingPrefix),
            (c.properties?.material || 'pvc').toUpperCase(),
            (c.properties?.od || 0.3).toFixed(3),
            (c.properties?.length || 2.0).toFixed(3) + ' m'
          ];
        });
        autoTable(pdf, { startY: startY + 5, head: [['Tag ID', 'Material', 'Outer Diameter (m)', 'Cut Length (m)']], body: cutRows, theme: 'grid' });
      }

      pdf.save(`Pipe3D_Engineering_${designName.replace(/\s+/g, '_')}.pdf`);
      alert('✅ Professional Blueprint generated!');
    } catch (err) {
      console.error('Export Error:', err);
      alert('Export Failed: ' + err.message);
    } finally {
      setIsSaving(false);
      setIsCapturing(false);
    }
  }, [components, designName]);

  const handleLoadHistory = useCallback(async (entry) => {
    if (!entry || !entry.id) {
      console.error('[App] Cannot load project: Missing entry or ID', entry);
      return;
    }

    if (components.length > 0) {
      const confirmSave = window.confirm('Your current design will be replaced. Continue?');
      if (!confirmSave) return;
    }

    setIsSaving(true);
    addNotification(`🔄 Loading project: ${entry.name}...`, 'info');
    console.log(`[App] Loading project ID: ${entry.id} (${entry.name})`);

    try {
      // Use relative URL as Vite proxy handles /api -> localhost:5000
      const res = await fetch(`/api/projects/${entry.id}`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      console.log('[App] Successfully retrieved project data:', data.name);

      if (data && data.components_json) {
        try {
          const parsed = JSON.parse(data.components_json);
          const loadedComponents = (Array.isArray(parsed) ? parsed : []).map(c => ({
            ...c,
            isCommitted: false // Set to false so first save after load correctly deducts from reset stock
          }));

          setComponents(loadedComponents);
          setPendingRefunds([]);
          setDesignName(data.name || 'Loaded Project');
          setCurrentProjectId(entry.id); // Pin this project — auto-save will always PUT to it
          setSelectedIds([]);

          // Clear any active placement modes
          setPlacingType(null);
          setPlacingTemplate(null);

          // Force update cameras for all viewports once components are rendered
          setTimeout(() => {
            sceneRef.current?.resetAllViews?.();
            addNotification('✅ Project loaded successfully.', 'success');
          }, 100);
        } catch (jsonErr) {
          console.error('[App] Failed to parse project components:', jsonErr);
          throw new Error('Project save data is corrupted or invalid JSON.');
        }
      } else {
        throw new Error('Project data is missing component information.');
      }
    } catch (err) {
      console.error('[App] CRITICAL: Failed to load project:', err);
      alert(`❌ Error: ${err.message}`);
      addNotification('Could not load project. Server may be down or database error.', 'error');
    } finally {
      setIsSaving(false);
      setIsCapturing(false);
    }
  }, [components]);

  // Handle auto-loading projects from URL parameter (Must be after handleLoadHistory)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');
    if (loadId && !window.__HAS_LOADED_PARAM_PROJECT) {
       window.__HAS_LOADED_PARAM_PROJECT = true;
       // Clean up URL visually
       window.history.replaceState({}, document.title, window.location.pathname);
       // Give it a tiny delay to ensure dependencies are ready
       setTimeout(() => {
          handleLoadHistory({ id: loadId, name: `Loading Project...` });
       }, 500);
    }
  }, [handleLoadHistory]);

  const handleDeleteHistory = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(prev => prev.filter(h => h.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete history item', err);
    }
  }, []);

  const handleNewDesign = () => {
    if (components.length > 0) {
      if (!window.confirm("Start new design? Unsaved changes will be lost.")) return;
    }
    setComponents([]);
    setPendingRefunds([]); // Clear refunds
    setSelectedIds([]);
    setDesignName('Untitled Design');
    setCurrentProjectId(null); // New project — next save will POST
  };
  const handleCancelPlacement = useCallback(() => {
    setPlacingType(null);
    setPlacingTemplate(null);
    setChainAnchor(null);
  }, []);

  const handleSelectComponent = useCallback((id, e) => {
    // If we are in connection mode, we don't want to change selection.
    // We only want to handle socket clicks.
    if (connectionMode) return;

    // console.log('Selection event:', { id, multiMode: multiSelectMode, hasEvent: !!e });
    if (!id) {
      setSelectedIds([]);
      return;
    }

    handleCancelPlacement();
    const isMulti = multiSelectMode || (e && (e.shiftKey || e.ctrlKey || e.metaKey));

    // Smart Assembly Selection
    // Assembly Selection
    const targetComp = components.find(c => c.id === id);
    if (!targetComp) {
      setSelectedIds([]);
      return;
    }

    let idsToSelect = [id];
    if (targetComp.assemblyId && !connectionMode) {
      idsToSelect = components
        .filter(c => c.assemblyId === targetComp.assemblyId)
        .map(c => c.id);
    }

    if (isMulti) {
      setSelectedIds(prev => {
        const alreadySelected = idsToSelect.every(i => prev.includes(i));
        if (alreadySelected) {
          return prev.filter(i => !idsToSelect.includes(i));
        } else {
          return [...new Set([...prev, ...idsToSelect])];
        }
      });
    } else {
      setSelectedIds(idsToSelect);
    }
  }, [multiSelectMode, components, handleCancelPlacement, connectionMode]);
  const handleBatchSelect = useCallback((ids, e) => {
    const isMulti = multiSelectMode || (e && (e.shiftKey || e.ctrlKey || e.metaKey));

    if (isMulti) {
      setSelectedIds(prev => [...new Set([...prev, ...ids])]);
    } else {
      setSelectedIds(ids);
    }
  }, [multiSelectMode]);

  // Theme persistence
  useEffect(() => {
    localStorage.setItem('pipe3d_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial load from autosave
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pipe3d_autosave');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.components && Array.isArray(data.components)) {
          setComponents(data.components);
          // Auto-fit cameras after Three.js viewports initialize
          if (data.components.length > 0) {
            setTimeout(() => { sceneRef.current?.resetAllViews?.(); }, 100);
          }
        }
        if (data.name) setDesignName(data.name);
      }
    } catch (e) {
      console.error('Failed to load autosave');
    }
  }, []);

  // Autosave to local storage when data changes (silently)
  useEffect(() => {
    const timer = setTimeout(() => {
      const data = {
        name: designName,
        components: components,
        timestamp: Date.now()
      };
      localStorage.setItem('pipe3d_autosave', JSON.stringify(data));
      setLastSaved(Date.now());
    }, 3000); // 3 second debounce to avoid blocking i3 during active modeling
    return () => clearTimeout(timer);
  }, [components, designName]);

  // --- BACKGROUND SILENT DB SYNC (FOR ALL CHANGES) ---
  // Silently saves to MSSQL 2 seconds after the last change (Add, Delete, Move, Rotate)
  useEffect(() => {
    if (!user || components.length === 0) return;

    const timer = setTimeout(() => {
      console.log('[DBSync] Silently syncing project state to MSSQL...');
      handleSaveToHistory(null, components, { isSilent: true });
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [components, user, handleSaveToHistory]);

  // Handle browser closure/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const data = {
        name: designName,
        components: components,
        timestamp: Date.now()
      };
      localStorage.setItem('pipe3d_autosave', JSON.stringify(data));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [components, designName]);

  // Fetch System Configuration (Pricing/Naming)
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setSystemConfig(data);
        console.log('Pipe3D Config Loaded:', data);
      })
      .catch(err => console.error('Failed to load system config:', err));
  }, []);

  // userParts syncing still active


  useEffect(() => {
    localStorage.setItem('pipe3d_user_parts', JSON.stringify(userParts));
  }, [userParts]);

  const totalCost = useMemo(() => calculateTotalCost(components, false, systemConfig), [components, systemConfig]);


  const handleAddComponent = useCallback((type, template = null) => {
    setPlacingType(type);
    setPlacingTemplate(template);
    setSelectedIds([]);
  }, []);

  const handlePlaceComponent = useCallback(async (position, rotation, properties = {}, targetId = null, targetSocketIdx = null, placingSocketIdx = null, requiresFitting = null) => {
    if (!placingType) return;

    // Debounce placement to prevent rapid-fire double components
    if (Date.now() - lastPlacementTime.current < 350) {
      console.warn('Pipe3D: Double-placement prevented.');
      return;
    }
    lastPlacementTime.current = Date.now();

    const finalProperties = {
      ...(placingTemplate?.properties || {}),
      ...properties
    };

    // --- STOCK VALIDATION ---
    // Prepare list of items to check
    let itemsToCheck = [];
    let assemblyParts = [];
    const assemblyId = placingTemplate?.isAssembly ? `ass_${Date.now()}` : null;

    if (placingTemplate?.isAssembly && placingTemplate.parts) {
      // ASSEMBLY PRE-CALCULATION
      const assemblyQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rotation[0] * Math.PI) / 180, (rotation[1] * Math.PI) / 180, (rotation[2] * Math.PI) / 180)
      );

      assemblyParts = placingTemplate.parts.map(p => {
        const offsetVec = new THREE.Vector3(p.offset_x || 0, p.offset_y || 0, p.offset_z || 0).applyQuaternion(assemblyQuat);
        const partFinalQuat = assemblyQuat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((p.rotation_x || 0) * (Math.PI / 180), (p.rotation_y || 0) * (Math.PI / 180), (p.rotation_z || 0) * (Math.PI / 180))));
        const finalRot = new THREE.Euler().setFromQuaternion(partFinalQuat);

        return {
          ...p,
          id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random()}`,
          assemblyId,
          position_x: position[0] + offsetVec.x,
          position_y: position[1] + offsetVec.y,
          position_z: position[2] + offsetVec.z,
          rotation_x: finalRot.x * (180 / Math.PI),
          rotation_y: finalRot.y * (180 / Math.PI),
          rotation_z: finalRot.z * (180 / Math.PI),
          connections: [],
          isCommitted: false // 🛡️ CRITICAL: Always reset commitment for new placements from library
        };
      });

      itemsToCheck = assemblyParts.map(p => ({
        type: p.component_type,
        material: p.properties?.material || 'pvc',
        amount: (p.component_type === 'straight' || p.component_type === 'vertical') ? (p.properties?.length || 2) : 1
      }));
    } else {
      // SINGLE PART
      itemsToCheck = [{
        type: placingType,
        material: finalProperties.material || 'pvc',
        amount: (placingType === 'straight' || placingType === 'vertical') ? (finalProperties.length || 2) : 1
      }];
    }

    // Perform API Batch Check
    try {
      const checkRes = await fetch('/api/inventory/check-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToCheck })
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.ok) {
          const failed = checkData.failedItem;
          alert(`❌ Insufficient Stock!\n\nPart: ${failed.type} (${failed.material})\nAvailable: ${failed.quantity}${failed.unit}\n\nPlease update inventory to proceed.`);
          return;
        }
      }
    } catch (e) { console.warn('Stock check service unavailable, allowing placement.'); }


    // --- PLACEMENT LOGIC ---
    if (assemblyId) {
      // PLACE ASSEMBLY
      setComponents(prev => {
        const finalComps = [...prev, ...assemblyParts];
        saveToHistory(finalComps);
        return finalComps;
      });
    } else {
      // PLACE SINGLE PART
      const isIntersecting = checkIntersection(
        new THREE.Vector3(...position),
        new THREE.Euler(rotation[0] * (Math.PI / 180), rotation[1] * (Math.PI / 180), rotation[2] * (Math.PI / 180)),
        placingType,
        finalProperties,
        components,
        targetId
      );

      if (isIntersecting) {
        console.warn('Pipe3D: Placement blocked due to intersection.');
        return;
      }

      const componentId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // ── AUTO-ELBOW LOGIC ──
      if (requiresFitting === 'elbow' && targetId) {
        const target = components.find(c => c.id === targetId);
        if (target) {
          const elbowId = `elbow_auto_${Date.now()}`;
          const isTargetVertical = target.component_type === 'vertical';
          
          // Geometry correction: The elbow has a Radius of 1.0. 
          // We need to offset the pipes so they don't have a gap.
          const elbowPos = new THREE.Vector3(...position);
          
          const elbowComp = {
            id: elbowId,
            component_type: 'elbow',
            position_x: elbowPos.x,
            position_y: elbowPos.y,
            position_z: elbowPos.z,
            rotation_x: rotation[0], // Snapper already calculated the 90-degree alignment
            rotation_y: rotation[1],
            rotation_z: rotation[2],
            properties: { ...finalProperties },
            connections: [
              { targetId, targetSocketIdx, localSocketIdx: 1 },
              { targetId: componentId, targetSocketIdx: placingSocketIdx, localSocketIdx: 0 }
            ],
            isCommitted: false
          };
          
          const newComponent = {
            id: componentId,
            component_type: placingType,
            position_x: position[0], 
            position_y: position[1],
            position_z: position[2],
            rotation_x: rotation[0],
            rotation_y: rotation[1],
            rotation_z: rotation[2],
            connections: [{ targetId: elbowId, targetSocketIdx: 0, localSocketIdx: placingSocketIdx }],
            properties: finalProperties,
            isCommitted: false
          };

          setComponents(prev => {
            let next = [...prev, elbowComp, newComponent];
            next = next.map(c => (c.id === targetId ? { ...c, connections: [...(c.connections || []), { targetId: elbowId, targetSocketIdx: 1, localSocketIdx: targetSocketIdx }] } : c));
            saveToHistory(next);
            return next;
          });
          addNotification(`🛠️ Auto-inserted elbow for angled connection`, 'success');
          // For chaining, the "last placed" is the pipe, not the elbow
          handleFinalChain(componentId, placingType, finalProperties, position, rotation, placingSocketIdx);
          return;
        }
      }

      const newComponent = {
        id: componentId,
        component_type: placingType,
        position_x: position[0],
        position_y: position[1],
        position_z: position[2],
        rotation_x: rotation[0],
        rotation_y: rotation[1],
        rotation_z: rotation[2],
        connections: targetId ? [{ targetId, targetSocketIdx, localSocketIdx: placingSocketIdx }] : [],
        properties: finalProperties,
        isCommitted: false // New parts must be deducted on save
      };

      setComponents(prev => {
        let next = [...prev, newComponent];
        if (targetId) {
          next = next.map(c => (c.id === targetId ? { ...c, connections: [...(c.connections || []), { targetId: componentId, targetSocketIdx: placingSocketIdx, localSocketIdx: targetSocketIdx }] } : c));
        }
        saveToHistory(next);
        return next;
      });
      handleFinalChain(componentId, placingType, finalProperties, position, rotation, placingSocketIdx);
    }
  }, [placingType, placingTemplate, components, saveToHistory, handleFinalChain, decrementInventoryBatch, addNotification]);

  const handleFinalChain = useCallback((componentId, placingType, finalProperties, position, rotation, placingSocketIdx) => {
    // Moved chain logic to its own function to keep handlePlaceComponent clean
    const isPipeType = ['straight', 'vertical', 'cylinder'].includes(placingType);
    const isFitting = ['elbow', 'elbow-45', 't-joint', 'valve', 'reducer', 'flange', 'coupling',
      'union', 'cross', 'filter', 'cap', 'plug', 'check-valve', 'gate-valve', 'globe-valve',
      'y-strainer', 'pump', 'flow-meter', 'equal-tee', 'unequal-tee', 'y-tee', 'expansion-joint'].includes(placingType);

    if (isPipeType || isFitting) {
      const def = COMPONENT_DEFINITIONS[placingType];
      if (def) {
        const usedSocketIdx = placingSocketIdx;
        const openSocket = def.sockets.findIndex((_, idx) => idx !== usedSocketIdx);
        if (openSocket !== -1) {
          const compQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            rotation[0] * Math.PI / 180, rotation[1] * Math.PI / 180, rotation[2] * Math.PI / 180
          ));
          const socketLocalPos = def.sockets[openSocket].position.clone();
          if (isPipeType) {
            socketLocalPos.y = (def.sockets[openSocket].position.y + 1) * ((finalProperties.length || 2) / 2);
          } else {
            socketLocalPos.multiplyScalar(finalProperties.radiusScale || 1);
          }
          const socketWorldPos = socketLocalPos.applyQuaternion(compQuat).add(new THREE.Vector3(...position));

          setChainAnchor({
            componentId,
            socketIdx: openSocket,
            worldPos: socketWorldPos,
            componentType: placingType
          });
          setSelectedIds([]);
          return;
        }
      }
    }
    setPlacingType(null);
    setPlacingTemplate(null);
    setChainAnchor(null);
    setSelectedIds([]);
  }, []);


  const handleUpdateComponent = useCallback((updatedComp) => {
    setComponents(prev => {
      // PIVOT-AWARE ROTATION COMPENSATION
      let compToUse = updatedComp;
      if (snapPivot && updatedComp.id === snapPivot.id && transformMode === 'rotate') {
        const oldComp = prev.find(c => c.id === updatedComp.id);
        if (oldComp) {
          const def = COMPONENT_DEFINITIONS[oldComp.component_type];
          if (def && def.sockets[snapPivot.socketIndex]) {
            let socketLocalPos = def.sockets[snapPivot.socketIndex].position.clone();
            if (oldComp.component_type === 'industrial-tank') {
              const hScale = ((oldComp.properties?.od || 2.2) + 0.5) / 2.2;
              const vScale = (oldComp.properties?.length || 4.0) / 4.0;
              const iConeH = (oldComp.properties?.length || 4.0) * 0.25;
              socketLocalPos.x *= hScale;
              socketLocalPos.z *= hScale;
              socketLocalPos.y = (socketLocalPos.y * vScale) + iConeH;
            } else if (oldComp.component_type === 'straight' || oldComp.component_type === 'vertical') {
              socketLocalPos.y = (socketLocalPos.y + 1) * ((oldComp.properties?.length || 2.0) / 2);
            } else if (oldComp.component_type === 'tank') {
              const tHeight = oldComp.properties?.length || 2.0;
              socketLocalPos.y = (socketLocalPos.y * (tHeight / 2)) + (tHeight / 2);
              socketLocalPos.x *= (oldComp.properties?.radiusScale || 1);
              socketLocalPos.z *= (oldComp.properties?.radiusScale || 1);
            } else {
              socketLocalPos.multiplyScalar(oldComp.properties?.radiusScale || 1);
            }

            // Calculate where the socket WOULD BE with the new rotation
            const newQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
              updatedComp.rotation_x * (Math.PI / 180),
              updatedComp.rotation_y * (Math.PI / 180),
              updatedComp.rotation_z * (Math.PI / 180)
            ));
            const newSocketWorldOffset = socketLocalPos.clone().applyQuaternion(newQuat);

            // New position = pivotWorldPos - newSocketWorldOffset
            const newPos = snapPivot.worldPos.clone().sub(newSocketWorldOffset);

            compToUse = {
              ...updatedComp,
              position_x: newPos.x,
              position_y: newPos.y,
              position_z: newPos.z
            };
          }
        }
      } else if (snapPivot && updatedComp.id === snapPivot.id && transformMode === 'translate') {
        // Clear pivot if they manually move it away
        setSnapPivot(null);
      }

      const next = prev.map(comp => (comp.id === compToUse.id ? compToUse : comp));
      saveToHistory(next);

      // ── AUTO-CONNECT: Detect nearby sockets after drag and create connections ──
      const detected = autoConnect(next, [compToUse.id]);
      if (detected.length > 0) {
        let autoResult = [...next];
        for (const conn of detected) {
          // Show compatibility warnings
          if (conn.compatibility.warning) {
            addNotification(conn.compatibility.warning, 'warning');
          }

          // Check if both are pipes — auto-insert coupling
          const compA = autoResult.find(c => c.id === conn.compAId);
          const compB = autoResult.find(c => c.id === conn.compBId);
          const bothPipes = compA && compB &&
            ['straight', 'vertical'].includes(compA.component_type) &&
            ['straight', 'vertical'].includes(compB.component_type);

          if (bothPipes) {
            // Check orientation: collinear (coupling) or angled (elbow)
            const isOrthogonal = conn.requiresFitting === 'elbow';
            
            if (isOrthogonal) {
              const elbowId = `elbow_auto_${Date.now()}`;
              const elbowComp = {
                id: elbowId,
                component_type: 'elbow',
                position_x: conn.connectionPoint.x,
                position_y: conn.connectionPoint.y,
                position_z: conn.connectionPoint.z,
                rotation_x: compA.rotation_x, // Initial guess
                rotation_y: compA.rotation_y,
                rotation_z: compA.rotation_z,
                properties: { ...compA.properties },
                connections: [
                  { targetId: conn.compAId, targetSocketIdx: conn.socketA, localSocketIdx: 1 },
                  { targetId: conn.compBId, targetSocketIdx: conn.socketB, localSocketIdx: 0 }
                ],
                isCommitted: false
              };
              autoResult.push(elbowComp);
              autoResult = autoResult.map(c => {
                if (c.id === conn.compAId) return { ...c, connections: [...(c.connections || []), { targetId: elbowId, targetSocketIdx: 1, localSocketIdx: conn.socketA }] };
                if (c.id === conn.compBId) return { ...c, connections: [...(c.connections || []), { targetId: elbowId, targetSocketIdx: 0, localSocketIdx: conn.socketB }] };
                return c;
              });
              addNotification(`🛠️ Elbow auto-inserted for 90° turn`, 'success');
            } else {
              // Auto-insert coupling at the connection point
              const couplingId = `coupling_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const couplingComp = {
                id: couplingId,
                component_type: 'coupling',
                position_x: conn.connectionPoint.x,
                position_y: conn.connectionPoint.y,
                position_z: conn.connectionPoint.z,
                rotation_x: compA.rotation_x,
                rotation_y: compA.rotation_y,
                rotation_z: compA.rotation_z,
                properties: { material: compA.properties?.material || 'pvc', od: compA.properties?.od || 0.34 },
                connections: [
                  { targetId: conn.compAId, targetSocketIdx: conn.socketA, localSocketIdx: 1 },
                  { targetId: conn.compBId, targetSocketIdx: conn.socketB, localSocketIdx: 0 }
                ],
                isCommitted: false
              };
              autoResult.push(couplingComp);
              // Wire back-references
              autoResult = autoResult.map(c => {
                if (c.id === conn.compAId) return { ...c, connections: [...(c.connections || []), { targetId: couplingId, targetSocketIdx: 1, localSocketIdx: conn.socketA }] };
                if (c.id === conn.compBId) return { ...c, connections: [...(c.connections || []), { targetId: couplingId, targetSocketIdx: 0, localSocketIdx: conn.socketB }] };
                return c;
              });
              addNotification(`🔗 Coupling auto-inserted between pipes`, 'success');
            }
          } else {
            // Direct connection (pipe-to-fitting or fitting-to-fitting)
            autoResult = autoResult.map(c => {
              if (c.id === conn.compAId) return { ...c, connections: [...(c.connections || []), { targetId: conn.compBId, targetSocketIdx: conn.socketB, localSocketIdx: conn.socketA }] };
              if (c.id === conn.compBId) return { ...c, connections: [...(c.connections || []), { targetId: conn.compAId, targetSocketIdx: conn.socketA, localSocketIdx: conn.socketB }] };
              return c;
            });
            addNotification(`✅ Auto-connected components`, 'success');
          }
        }
        return autoResult;
      }

      return next;
    });
  }, [saveToHistory, snapPivot, transformMode, addNotification]);

  const handleUpdateComponents = useCallback((updatedComponents) => {
    setComponents(prev => {
      let finalUpdates = updatedComponents;

      // No need for redundant ASSEMBLY PIVOT COMPENSATION math here anymore, 
      // as Scene3D's TransformControls already handle the pivot-aware math in world space.
      // Trust the incoming updatedComponents.
      finalUpdates = updatedComponents;

      if (snapPivot && transformMode === 'translate') {
        const leadUpdate = updatedComponents.find(u => u.id === snapPivot.id);
        if (leadUpdate) setSnapPivot(null);
      }

      const updatesMap = new Map(finalUpdates.map(c => [c.id, c]));
      let next = prev.map(comp => updatesMap.has(comp.id) ? updatesMap.get(comp.id) : comp);

      // --- CONNECTION CLEANUP ON MOVE/ROTATE ---
      // RELIABLE: Preserve internal connections within the moved set.
      // IMPROVED: If rotating a single component, we now use Smart Pivot, so keep its connection!
      const movedIds = finalUpdates.map(u => u.id);
      const isRotation = transformMode === 'rotate';

      next = next.map(comp => {
        if (movedIds.includes(comp.id)) {
          // 1. Always keep connections where the partner also moved
          let connsToKeep = (comp.connections || []).filter(conn => movedIds.includes(conn.targetId));

          // 2. NEW: If this was a ROTATION, keep its connections to static partners
          // Because we now use Smart Pivot at the socket (even for assemblies), the connection is physically preserved.
          if (isRotation) {
            connsToKeep = comp.connections || [];
          }

          return { ...comp, connections: connsToKeep };
        }

        // 3. For components NOT in the moved set, only clear connections to things that moved away
        if (comp.connections && comp.connections.length > 0) {
          const validConnections = comp.connections.filter(conn => {
            const partnerMoved = movedIds.includes(conn.targetId);
            if (!partnerMoved) return true; // Partner stayed, I stayed -> Keep.
            if (isRotation) return true; // Partner rotated (possibly around me) -> Keep.
            return false; // Partner moved away -> Clear.
          });

          if (validConnections.length !== comp.connections.length) {
            return { ...comp, connections: validConnections };
          }
        }
        return comp;
      });

      saveToHistory(next);

      // ── AUTO-CONNECT after multi-component drag ──
      const detected = autoConnect(next, movedIds);
      if (detected.length > 0) {
        let autoResult = [...next];
        for (const conn of detected) {
          if (conn.compatibility.warning) addNotification(conn.compatibility.warning, 'warning');
          
          const compA = autoResult.find(c => c.id === conn.compAId);
          const compB = autoResult.find(c => c.id === conn.compBId);
          const bothPipes = compA && compB &&
            ['straight', 'vertical'].includes(compA.component_type) &&
            ['straight', 'vertical'].includes(compB.component_type);

          if (bothPipes) {
            const couplingId = `coupling_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const couplingComp = {
              id: couplingId, component_type: 'coupling',
              position_x: conn.connectionPoint.x, position_y: conn.connectionPoint.y, position_z: conn.connectionPoint.z,
              rotation_x: compA.rotation_x, rotation_y: compA.rotation_y, rotation_z: compA.rotation_z,
              properties: { material: compA.properties?.material || 'pvc', od: compA.properties?.od || 0.34 },
              connections: [
                { targetId: conn.compAId, targetSocketIdx: conn.socketA, localSocketIdx: 1 },
                { targetId: conn.compBId, targetSocketIdx: conn.socketB, localSocketIdx: 0 }
              ],
              isCommitted: false
            };
            autoResult.push(couplingComp);
            autoResult = autoResult.map(c => {
              if (c.id === conn.compAId) return { ...c, connections: [...(c.connections || []), { targetId: couplingId, targetSocketIdx: 1, localSocketIdx: conn.socketA }] };
              if (c.id === conn.compBId) return { ...c, connections: [...(c.connections || []), { targetId: couplingId, targetSocketIdx: 0, localSocketIdx: conn.socketB }] };
              return c;
            });
            addNotification(`🔗 Coupling auto-inserted between pipes`, 'success');
          } else {
            autoResult = autoResult.map(c => {
              if (c.id === conn.compAId) return { ...c, connections: [...(c.connections || []), { targetId: conn.compBId, targetSocketIdx: conn.socketB, localSocketIdx: conn.socketA }] };
              if (c.id === conn.compBId) return { ...c, connections: [...(c.connections || []), { targetId: conn.compAId, targetSocketIdx: conn.socketA, localSocketIdx: conn.socketB }] };
              return c;
            });
            addNotification(`✅ Auto-connected components`, 'success');
          }
        }
        return autoResult;
      }

      return next;
    });
  }, [saveToHistory, snapPivot, transformMode, addNotification]);

  const handleDeleteComponents = useCallback((ids) => {
    setComponents(prev => {
      // TRACK REFUNDS: Find which parts being deleted were already "committed"
      const beingDeleted = prev.filter(comp => ids.includes(comp.id));
      const committedDeleted = beingDeleted.filter(c => c.isCommitted);
      if (committedDeleted.length > 0) {
        setPendingRefunds(curr => [...curr, ...committedDeleted]);
      }

      // 1. Remove the components themselves
      let next = prev.filter(comp => !ids.includes(comp.id));

      // 2. Clean up connections in remaining components
      next = next.map(comp => {
        if (comp.connections && comp.connections.length > 0) {
          const remainingConnections = comp.connections.filter(conn => !ids.includes(conn.targetId));
          if (remainingConnections.length !== comp.connections.length) {
            return { ...comp, connections: remainingConnections };
          }
        }
        return comp;
      });

      saveToHistory(next);
      return next;
    });
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  }, [saveToHistory]);

  const handleUngroupComponents = useCallback((ids) => {
    if (ids.length === 0) return;
    setComponents(prev => {
      const next = prev.map(comp => {
        if (ids.includes(comp.id) && comp.assemblyId) {
          return { ...comp, assemblyId: null };
        }
        return comp;
      });
      saveToHistory(next);
      return next;
    });
  }, [saveToHistory]);

  const handleGroupComponents = useCallback((ids) => {
    if (ids.length < 2) return;
    const assemblyId = `ass_${Date.now()} `;
    setComponents(prev => {
      const next = prev.map(comp => {
        if (ids.includes(comp.id)) {
          return { ...comp, assemblyId };
        }
        return comp;
      });
      saveToHistory(next);
      return next;
    });
  }, [saveToHistory]);

  const handleSocketClick = useCallback((componentId, socketIndex) => {
    console.log('Socket Clicked:', { componentId, socketIndex });
    setSelectedSockets(prev => {
      const next = [...prev, { componentId, socketIndex }];

      if (next.length === 2) {
        // PERFORM CONNECTION
        const [target, source] = next;

        if (target.componentId === source.componentId) {
          alert("Cannot connect a component to itself!");
          return [];
        }

        setComponents(currentComponents => {
          const compA = currentComponents.find(c => c.id === target.componentId);
          const compB = currentComponents.find(c => c.id === source.componentId);

          if (!compA || !compB) return currentComponents;

          const result = calculateManualConnection(compA, target.socketIndex, compB, source.socketIndex);

          if (result) {
            // --- ASSEMBLY SNAP LOGIC ---
            // If the source component (compB) is part of an assembly, 
            // the entire assembly should move and rotate as a single unit.

            const assemblyId = compB.assemblyId;

            // 1. Calculate the relative transform (Matrix4) for the relocation
            const oldMatrixB = new THREE.Matrix4().compose(
              new THREE.Vector3(compB.position_x, compB.position_y, compB.position_z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(
                (compB.rotation_x || 0) * (Math.PI / 180),
                (compB.rotation_y || 0) * (Math.PI / 180),
                (compB.rotation_z || 0) * (Math.PI / 180)
              )),
              new THREE.Vector3(1, 1, 1)
            );

            const newMatrixB = new THREE.Matrix4().compose(
              result.position,
              new THREE.Quaternion().setFromEuler(result.rotation),
              new THREE.Vector3(1, 1, 1)
            );

            const relTransform = new THREE.Matrix4().multiplyMatrices(newMatrixB, oldMatrixB.invert());

            const updatedComponents = currentComponents.map(c => {
              // Apply transform if it's the source or part of the same assembly
              const shouldMove = (c.id === source.componentId) || (assemblyId && c.assemblyId === assemblyId);

              if (shouldMove) {
                const oldMatrixC = new THREE.Matrix4().compose(
                  new THREE.Vector3(c.position_x, c.position_y, c.position_z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                    (c.rotation_x || 0) * (Math.PI / 180),
                    (c.rotation_y || 0) * (Math.PI / 180),
                    (c.rotation_z || 0) * (Math.PI / 180)
                  )),
                  new THREE.Vector3(1, 1, 1)
                );

                const newMatrixC = new THREE.Matrix4().multiplyMatrices(relTransform, oldMatrixC);

                const finalPos = new THREE.Vector3();
                const finalQuat = new THREE.Quaternion();
                const finalScale = new THREE.Vector3();
                newMatrixC.decompose(finalPos, finalQuat, finalScale);
                const finalRot = new THREE.Euler().setFromQuaternion(finalQuat);

                return {
                  ...c,
                  position_x: finalPos.x,
                  position_y: finalPos.y,
                  position_z: finalPos.z,
                  rotation_x: finalRot.x * (180 / Math.PI),
                  rotation_y: finalRot.y * (180 / Math.PI),
                  rotation_z: finalRot.z * (180 / Math.PI),
                  // Record connection in source (or assembly members) for visual holes
                  connections: (c.id === source.componentId)
                    ? [...(c.connections || []), { targetId: target.componentId, targetSocketIdx: target.socketIndex, localSocketIdx: source.socketIndex }]
                    : (c.connections || [])
                };
              }

              // Record connection in target for visual holes
              if (c.id === target.componentId) {
                return {
                  ...c,
                  connections: [...(c.connections || []), { targetId: source.componentId, targetSocketIdx: source.socketIndex, localSocketIdx: target.socketIndex }]
                };
              }

              return c;
            });

            saveToHistory(updatedComponents);

            // 2. Set Snap Pivot for the source (so subsequent rotations pivot around this point)
            setSnapPivot({
              id: source.componentId,
              worldPos: result.socketWorldPos,
              socketIndex: source.socketIndex,
              isAssembly: !!assemblyId,
              assemblyId: assemblyId
            });

            return updatedComponents;
          }
          return currentComponents;
        });

        setConnectionMode(false);
        return [];
      }
      return next;
    });
  }, [saveToHistory]);

  const handleDuplicateComponents = useCallback((ids) => {
    if (ids.length === 0) return;

    setComponents(prev => {
      const selectedOnes = prev.filter(c => ids.includes(c.id));
      const newClones = selectedOnes.map(original => ({
        ...original,
        isCommitted: false, // New clone is NOT yet committed to inventory
        properties: { ...original.properties }, // Shallow clone properties
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `,
        connections: [], // Clones start without connections
        // Offset the clone slightly so it doesn't overlap perfectly
        position_x: original.position_x + 0.5,
        position_y: original.position_y,
        position_z: original.position_z + 0.5,
      }));

      // --- MSSQL INVENTORY DECREMENT (DUPLICATE) ---
      // Removed (User requested only on Save)
      // decrementInventoryBatch(newClones);

      const newComponents = [...prev, ...newClones];
      saveToHistory(newComponents);
      // Select the new clones automatically
      setTimeout(() => setSelectedIds(newClones.map(c => c.id)), 0);
      return newComponents;
    });
  }, [saveToHistory]);

  const handleSaveToLibrary = useCallback((ids) => {
    if (!ids || ids.length === 0) return;

    const selectedOnes = components.filter(c => ids.includes(c.id));
    if (selectedOnes.length === 0) return;

    const name = prompt(
      ids.length > 1 ? "Name your assembly:" : "Name your custom component:",
      ids.length > 1 ? "New Assembly" : `Custom ${selectedOnes[0].component_type} `
    );
    if (!name) return;

    let newPart;

    if (ids.length > 1) {
      // ASSEMBLY CAPTURE
      // Calculate center (using the first part as origin for simplicity, or geometric mean)
      const origin = {
        x: selectedOnes[0].position_x,
        y: selectedOnes[0].position_y,
        z: selectedOnes[0].position_z,
        rot: new THREE.Euler(
          (selectedOnes[0].rotation_x || 0) * (Math.PI / 180),
          (selectedOnes[0].rotation_y || 0) * (Math.PI / 180),
          (selectedOnes[0].rotation_z || 0) * (Math.PI / 180)
        )
      };
      const originQuatInv = new THREE.Quaternion().setFromEuler(origin.rot).invert();

      const assemblyParts = selectedOnes.map(comp => {
        // Position offset
        const pos = new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z);
        const offset = pos.sub(new THREE.Vector3(origin.x, origin.y, origin.z)).applyQuaternion(originQuatInv);

        // Rotation offset
        const compRot = new THREE.Euler(
          (comp.rotation_x || 0) * (Math.PI / 180),
          (comp.rotation_y || 0) * (Math.PI / 180),
          (comp.rotation_z || 0) * (Math.PI / 180)
        );
        const compQuat = new THREE.Quaternion().setFromEuler(compRot);
        const relQuat = originQuatInv.clone().multiply(compQuat);
        const relRot = new THREE.Euler().setFromQuaternion(relQuat);

        return {
          ...JSON.parse(JSON.stringify(comp)),
          offset_x: offset.x,
          offset_y: offset.y,
          offset_z: offset.z,
          rotation_x: relRot.x * (180 / Math.PI),
          rotation_y: relRot.y * (180 / Math.PI),
          rotation_z: relRot.z * (180 / Math.PI),
        };
      });

      newPart = {
        id: `user_ass_${Date.now()} `,
        label: name,
        type: 'assembly',
        isAssembly: true,
        parts: assemblyParts,
        timestamp: Date.now()
      };
    } else {
      // SINGLE PART CAPTURE
      newPart = {
        id: `user_${Date.now()} `,
        label: name,
        type: selectedOnes[0].component_type,
        properties: { ...selectedOnes[0].properties },
        timestamp: Date.now()
      };
    }

    setUserParts(prev => [newPart, ...prev]);
  }, [components]);

  const handleDeleteUserPart = useCallback((id) => {
    setUserParts(prev => prev.filter(p => p.id !== id));
  }, []);


  // Keyboard support for common engineering shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e || typeof e.key !== 'string') return;
      const key = e.key.toLowerCase();
      // 1. ESC to clear selection/placement
      if (key === 'escape') {
        handleCancelPlacement();
        setSelectedIds([]);
      }

      // 2. DELETE / BACKSPACE to remove selected parts
      if ((key === 'delete' || key === 'backspace') && selectedIds.length > 0) {
        // Prevent deleting if user is typing in an input
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        handleDeleteComponents(selectedIds);
      }

      // 3. CTRL + D to Duplicate
      if (e.ctrlKey && key === 'd') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          handleDuplicateComponents(selectedIds);
        }
      }

      // 4. CTRL + Z for Undo
      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      // 5. CTRL + Y or CTRL + SHIFT + Z for Redo
      if (e.ctrlKey && (key === 'y' || (e.shiftKey && key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }

      // 5b. U to Ungroup
      if (key === 'u' && selectedIds.length > 0) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        handleUngroupComponents(selectedIds);
      }

      // 5c. G to Group
      if (key === 'g' && selectedIds.length > 1) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        handleGroupComponents(selectedIds);
      }

      // 6. Transform Mode (T for Translate, R for Rotate)
      if (key === 't') {
        setTransformMode('translate');
      } else if (key === 'r') {
        setTransformMode('rotate');
      }

      // 7. CTRL + C to Copy
      if (e.ctrlKey && key === 'c' && selectedIds.length > 0) {
        const component = components.find(c => c.id === selectedIds[0]);
        if (component) {
          setClipboard(component);
        }
      }

      // 8. CTRL + V to Paste
      if (e.ctrlKey && key === 'v' && clipboard) {
        const newComponent = {
          ...clipboard,
          isCommitted: false, // New copy is NOT committed
          id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          position_x: (clipboard.position_x || 0) + 2,
          position_y: clipboard.position_y || 0,
          position_z: clipboard.position_z || 0,
          connections: []
        };

        // --- MSSQL INVENTORY DECREMENT (PASTE) ---
        // Removed (User requested only on Save)
        // decrementInventoryBatch([newComponent]);

        setComponents(prev => {
          const next = [...prev, newComponent];
          saveToHistory(next);
          return next;
        });
        setSelectedIds([newComponent.id]);
      }

      // 9. ARROW KEYS to nudge selected parts (Plan Movement)
      const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'w', 's', 'a', 'd'];
      if (moveKeys.includes(key) && selectedIds.length > 0 && !isLocked) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        e.preventDefault();

        let step = 0.5; // Default nudge half meter
        if (e.shiftKey) step = 2.0; // Large step
        if (e.ctrlKey) step = 0.05; // Precision step

        let dx = 0, dy = 0, dz = 0;
        // Standard 3D Editor mapping:
        // X-axis: Left/Right
        if (key === 'arrowleft' || key === 'a') dx = -step;
        if (key === 'arrowright' || key === 'd') dx = step;

        // Z-axis: Forward/Backward (Ground plane)
        if (key === 'arrowup' || key === 'w') dz = -step;
        if (key === 'arrowdown' || key === 's') dz = step;

        // Y-axis: Elevation (Up/Down)
        if (key === 'pageup') dy = step;
        if (key === 'pagedown') dy = -step;

        const updated = components
          .filter(c => selectedIds.includes(c.id))
          .map(c => ({
            ...c,
            position_x: (c.position_x || 0) + dx,
            position_y: (c.position_y || 0) + dy,
            position_z: (c.position_z || 0) + dz,
          }));

        handleUpdateComponents(updated);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancelPlacement, selectedIds, handleDeleteComponents, handleDuplicateComponents, handleUndo, handleRedo, components, clipboard, saveToHistory, isLocked, handleUpdateComponents]);


  const handleExportExcel = useCallback(() => {
    if (components.length === 0) {
      alert('No components to export.');
      return;
    }

    const bomData = components.map((comp, idx) => {
      const metrics = calculateComponentMetrics(comp);
      const cost = calculateComponentCost(comp);
      const typeIdx = components.filter((c, i) => i < idx && c.component_type === comp.component_type).length;
      const tag = getComponentTag(comp.component_type, typeIdx, systemConfig?.NamingPrefix);

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

    // Auto-size columns
    const max_width = bomData.reduce((w, r) => Math.max(w, ...Object.values(r).map(v => v.toString().length)), 10);
    worksheet['!cols'] = Object.keys(bomData[0]).map(() => ({ wch: max_width + 2 }));

    const safeName = (designName || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `${safeName} _bom.xlsx`);
    handleSaveToHistory(null, components, { isSilent: true });
  }, [components, designName, handleSaveToHistory]);


  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  // Standalone Dashboard Page Check
  if (typeof window !== 'undefined' && window.location.search.includes('page=dashboard')) {
    return <Dashboard isOpen={true} onClose={() => window.close()} />;
  }

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#f0f9ff] text-slate-900'} selection:bg-blue-200 ${connectionMode ? 'cursor-crosshair' : ''}`}>
      <Toolbar
        designName={designName}
        onRename={(newName) => { setDesignName(newName); setCurrentProjectId(null); }}
        onSave={handleSaveDesign}
        onExport={handleExportBlueprint}
        onExportExcel={handleExportExcel}
        onNewDesign={handleNewDesign}
        componentCount={components.length}
        totalCost={totalCost}
        onShowMaterials={() => setShowMaterials(true)}
        onShowInventory={() => setShowInventory(true)}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        isMobile={isMobile}
        onToggleLibrary={() => setShowLibrary(!showLibrary)}
        showLibrary={showLibrary}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyStack.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isLocked={isLocked}
        onToggleLock={() => setIsLocked(!isLocked)}
        isSaving={isSaving}
        user={user}
        onLogout={() => {
          localStorage.removeItem('pipe3d_user');
          setUser(null);
        }}
        connectionMode={connectionMode}
        onToggleConnection={() => {
          setConnectionMode(!connectionMode);
          setSelectedSockets([]);
          setSnapPivot(null);
        }}
        showColorDifferentiation={showColorDifferentiation}
        onToggleColorDifferentiation={() => setShowColorDifferentiation(!showColorDifferentiation)}
        showSketchMode={showSketchMode}
        onToggleSketchMode={() => setShowSketchMode(!showSketchMode)}
        showFlow={showFlow}
        onToggleFlow={() => setShowFlow(!showFlow)}
      />

      {showMaterials && (
        <MaterialsList
          designName={designName}
          components={components}
          onClose={() => setShowMaterials(false)}
        />
      )}

      {showInventory && (
        <InventoryManager
          isOpen={showInventory}
          onClose={() => setShowInventory(false)}
          user={user}
        />
      )}

      <main className="flex-1 relative overflow-hidden bg-slate-50">
        <div className="absolute inset-0">
          {isMobile ? (
            <div className="w-full h-full flex flex-col relative">
              <div className="flex-1 relative">
                <Scene3D
                  ref={sceneRef}
                  components={components}
                  selectedIds={selectedIds}
                  onSelectComponent={handleSelectComponent}
                  placingType={placingType}
                  placingTemplate={placingTemplate}
                  onPlaceComponent={(pos, rot, props, tId, tsIdx, psIdx) => {
                    handlePlaceComponent(pos, rot, props, tId, tsIdx, psIdx);
                    if (isMobile) setShowLibrary(false);
                  }}
                  onCancelPlacement={handleCancelPlacement}
                  onUpdateComponent={handleUpdateComponent}
                  onUpdateMultiple={handleUpdateComponents}
                  onBatchSelect={handleBatchSelect}
                  transformMode={transformMode}
                  onSetTransformMode={setTransformMode}
                  designName={designName}
                  darkMode={darkMode}
                  isLocked={isLocked}
                  isCapturing={isCapturing}
                  connectionMode={connectionMode}
                  selectedSockets={selectedSockets}
                  onSocketClick={handleSocketClick}
                  showColorDifferentiation={showColorDifferentiation}
                  showSketchMode={showSketchMode}
                  systemConfig={systemConfig}
                  showFlow={showFlow}
                  onShowHydroStats={(comp) => addNotification(`🔍 Hydraulic Diagnostic: [${comp._tag}] Status Normal.`, 'info')}
                />
              </div>

              {/* Mobile Library Overlay */}
              {showLibrary && (
                <div
                  className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
                  onClick={() => setShowLibrary(false)}
                >
                  <div
                    className="w-full max-w-sm h-full bg-white shadow-2xl animate-in slide-in-from-left duration-300"
                    onClick={e => e.stopPropagation()} // Keep onClick for the library div to prevent closing when interacting with library content
                  >
                    <ComponentLibrary
                      components={components}
                      onUpdate={handleUpdateComponent}
                      onUpdateMultiple={handleUpdateComponents}
                      onAddComponent={handleAddComponent}
                      selectedIds={selectedIds}
                      setSelectedIds={setSelectedIds}
                      onDelete={() => selectedIds.length > 0 && handleDeleteComponents(selectedIds)}
                      onUngroup={() => selectedIds.length > 0 && handleUngroupComponents(selectedIds)}
                      onGroup={() => selectedIds.length > 1 && handleGroupComponents(selectedIds)}
                      onDuplicate={() => selectedIds.length > 0 && handleDuplicateComponents(selectedIds)}
                      onSaveToLibrary={() => selectedIds.length > 0 && handleSaveToLibrary(selectedIds)}
                      userParts={userParts}
                      onDeleteUserPart={handleDeleteUserPart}
                      transformMode={transformMode}
                      onSetTransformMode={setTransformMode}
                      multiSelectMode={multiSelectMode}
                      onSetMultiSelectMode={setMultiSelectMode}
                      history={history}
                      onLoadHistory={handleLoadHistory}
                      onDeleteHistory={handleDeleteHistory}
                      inventory={inventory}
                      onSaveToHistory={() => handleSaveToHistory()}
                      onRefreshHistory={fetchHistory}
                      activeTab={activeTab}
                      onSetActiveTab={setActiveTab}
                      onOpenDashboard={() => window.open(window.location.pathname + '?page=dashboard', '_blank')}
                      darkMode={darkMode}
                      placingType={placingType}
                      placingTemplate={placingTemplate}
                    />
                  </div>
                </div>
              )}


            </div>
          ) : (
            <ResizablePane
              padding="p-0"
              initialSize={20}
              minSize={10}
              maxSize={40}
              first={
                <ComponentLibrary
                  components={components}
                  onUpdate={handleUpdateComponent}
                  onUpdateMultiple={handleUpdateComponents}
                  onAddComponent={handleAddComponent}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  onSelectComponent={handleSelectComponent}
                  onDelete={() => selectedIds.length > 0 && handleDeleteComponents(selectedIds)}
                  onUngroup={() => selectedIds.length > 0 && handleUngroupComponents(selectedIds)}
                  onGroup={() => selectedIds.length > 1 && handleGroupComponents(selectedIds)}
                  onDuplicate={() => selectedIds.length > 0 && handleDuplicateComponents(selectedIds)}
                  onSaveToLibrary={() => selectedIds.length > 0 && handleSaveToLibrary(selectedIds)}
                  userParts={userParts}
                  onDeleteUserPart={handleDeleteUserPart}
                  transformMode={transformMode}
                  onSetTransformMode={setTransformMode}
                  multiSelectMode={multiSelectMode}
                  onSetMultiSelectMode={setMultiSelectMode}
                  history={history}
                  onLoadHistory={handleLoadHistory}
                  onDeleteHistory={handleDeleteHistory}
                  inventory={inventory}
                  onSaveToHistory={handleSaveToHistory}
                  onRefreshHistory={fetchHistory}
                  activeTab={activeTab}
                  onSetActiveTab={setActiveTab}
                  onOpenDashboard={() => window.open(window.location.pathname + '?page=dashboard', '_blank')}
                  darkMode={darkMode}
                  placingType={placingType}
                  placingTemplate={placingTemplate}
                />
              }
              second={
                <div className="w-full h-full">
                  <Scene3D
                    ref={sceneRef}
                    components={components}
                    selectedIds={selectedIds}
                    onSelectComponent={handleSelectComponent}
                    placingType={placingType}
                    placingTemplate={placingTemplate}
                    onPlaceComponent={handlePlaceComponent}
                    onCancelPlacement={handleCancelPlacement}
                    onUpdateComponent={handleUpdateComponent}
                    onBatchSelect={handleBatchSelect}
                    onUpdateMultiple={handleUpdateComponents}
                    transformMode={transformMode}
                    onSetTransformMode={setTransformMode}
                    designName={designName}
                    darkMode={darkMode}
                    isLocked={isLocked}
                    isCapturing={isCapturing}
                    connectionMode={connectionMode}
                    selectedSockets={selectedSockets}
                    onSocketClick={handleSocketClick}
                    showColorDifferentiation={showColorDifferentiation}
                    showSketchMode={showSketchMode}
                    snapPivot={snapPivot}
                    systemConfig={systemConfig}
                    showFlow={showFlow}
                    onShowHydroStats={(comp) => addNotification(`🔍 Hydraulic Diagnostic: [${comp._tag}] Status Normal.`, 'info')}
                  />
                </div>
              }
            />
          )}
        </div>
      </main>
      <NotificationToast
        notifications={notifications}
        onRemove={removeNotification}
        darkMode={darkMode}
      />

      {/* SAVING OVERLAY */}
      {isSaving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-800 font-black uppercase tracking-widest text-xs">Saving Project Layout...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
