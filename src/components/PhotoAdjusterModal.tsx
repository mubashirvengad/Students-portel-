import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { RotateCw, Sliders, Move, X, Check, RefreshCw } from 'lucide-react';

interface PhotoAdjusterModalProps {
  src: string;
  onSave: (adjusted: string) => void;
  onClose: () => void;
}

export const PhotoAdjusterModal: React.FC<PhotoAdjusterModalProps> = ({ src, onSave, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [grayscale, setGrayscale] = useState(0);

  const [activeTab, setActiveTab] = useState<'transform' | 'filters'>('transform');

  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    startPos.current = { x: clientX - xOffset, y: clientY - yOffset };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    // Cap offsets to avoid flying completely off screen
    const rawX = clientX - startPos.current.x;
    const rawY = clientY - startPos.current.y;
    setXOffset(rawX);
    setYOffset(rawY);
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  const handleReset = () => {
    setZoom(1);
    setRotate(0);
    setXOffset(0);
    setYOffset(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
  };

  const handleSave = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background white (for clean output card canvas)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 300);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const scaleFactor = Math.min(300 / w, 300 / h);
      const fitW = w * scaleFactor;
      const fitH = h * scaleFactor;

      // Determine ratio between canvas space (300px) and preview container (usually 224px / w-56)
      const previewWidth = previewRef.current?.clientWidth || 224;
      const conversionRatio = 300 / previewWidth;

      // Apply the image adjustment filter onto the 2d context
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%)`;

      // Move center of canvas to center origin
      ctx.translate(150 + xOffset * conversionRatio, 150 + yOffset * conversionRatio);

      // Rotate around model center
      ctx.rotate((rotate * Math.PI) / 180);

      // Scale
      ctx.scale(zoom, zoom);

      // Draw the image centered
      ctx.drawImage(img, -fitW / 2, -fitH / 2, fitW, fitH);

      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onSave(dataUrl);
      } catch (err) {
        console.error('Failed to convert canvas to DataURL (likely CORS issue with external host):', err);
        // Fallback: save the source directly
        onSave(src);
      }
    };
    img.onerror = () => {
      // Fallback
      onSave(src);
    };
    img.src = src;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Adjust Student Photo</h3>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Drag to position, use custom controls to enhance</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-150 rounded-full transition-colors bg-gray-50 text-gray-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview Frame Container */}
        <div className="p-5 flex flex-col items-center bg-gray-50/50 border-b border-gray-100">
          <div
            ref={previewRef}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handleEnd}
            className="w-52 h-52 rounded-2xl border-2 border-dashed border-gray-200 shadow-inner overflow-hidden relative bg-white flex items-center justify-center cursor-move select-none shrink-0"
          >
            <img
              src={src}
              alt="Adjustment Target"
              className="max-w-full max-h-full object-contain pointer-events-none"
              style={{
                transform: `translate(${xOffset}px, ${yOffset}px) scale(${zoom}) rotate(${rotate}deg)`,
                transformOrigin: 'center center',
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%)`
              }}
            />

            {/* Premium Alignment Targets */}
            <div className="absolute inset-0 border border-black/5 pointer-events-none rounded-2xl" />
            <div className="absolute top-1/3 left-0 right-0 border-t border-dashed border-black/10 pointer-events-none" />
            <div className="absolute top-2/3 left-0 right-0 border-t border-dashed border-black/10 pointer-events-none" />
            <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-black/10 pointer-events-none" />
            <div className="absolute left-2/3 top-0 bottom-0 border-l border-dashed border-black/10 pointer-events-none" />
            {/* Guide Silhouette Oval */}
            <div className="absolute inset-4 rounded-[40%] border-2 border-dashed border-emerald-500/20 pointer-events-none flex items-center justify-center">
              <div className="w-1/3 h-1/3 rounded-full border border-emerald-500/10" />
            </div>
          </div>
          
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <Move size={12} className="text-gray-300" />
            <span>Drag Photo to Reposition</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-4 flex gap-1 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('transform')}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'transform' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Crop & Position
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'filters' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Filters & Style
          </button>
        </div>

        {/* Controls Layout */}
        <div className="p-6 space-y-4">
          {activeTab === 'transform' ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Zoom Control */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span className="flex items-center gap-1">
                    <Sliders size={12} className="text-gray-400" />
                    Zoom (Scale)
                  </span>
                  <span className="text-slate-900 font-mono text-[10px]">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>

              {/* Rotate Control */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span className="flex items-center gap-1">
                    <RotateCw size={12} className="text-gray-400" />
                    Rotate (Degrees)
                  </span>
                  <span className="text-slate-900 font-mono text-[10px]">{rotate}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotate}
                  onChange={(e) => setRotate(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 animate-in fade-in duration-300">
              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span>Brightness</span>
                  <span className="text-slate-900 font-mono text-[10px]">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="175"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span>Contrast</span>
                  <span className="text-slate-900 font-mono text-[10px]">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="175"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span>Saturation</span>
                  <span className="text-slate-900 font-mono text-[10px]">{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="2"
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>

              {/* Grayscale */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-500">
                  <span>Grayscale (Monochrome)</span>
                  <span className="text-slate-900 font-mono text-[10px]">{grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={grayscale}
                  onChange={(e) => setGrayscale(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={handleReset}
              className="px-4 py-3 border border-gray-150 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-650 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              Reset
            </button>
            <div className="flex-1 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl text-xs font-bold text-gray-650 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                Save Photo
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
