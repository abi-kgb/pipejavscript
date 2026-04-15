/**
 * Applies a Professional Technical Drawing filter to an image data URL.
 * Algorithm: Turbo Bitwise (v1.0.1)
 * Optimized for high-speed report generation.
 */
export async function applyTechnicalDrawing(imageDataURL) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const w = img.width; const h = img.height;
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0);
            
            const iD = ctx.getImageData(0, 0, w, h);
            const data32 = new Uint32Array(iD.data.buffer);
            const out32 = new Uint32Array(data32.length);
            
            for (let y = 1; y < h - 1; y++) {
                const rowBase = y * w;
                const prevRowBase = (y - 1) * w;
                const nextRowBase = (y + 1) * w;
                for (let x = 1; x < w - 1; x++) {
                    const idx = rowBase + x;
                    
                    // 🎯 Optimized Sensitivity for High DPI + Antialiasing
                    // Check luma differences between neighbors (Fast Sobel Approximation)
                    const p = data32[idx];
                    const pr = data32[idx + 1]; const pl = data32[idx - 1];
                    const pt = data32[prevRowBase + x]; const pb = data32[nextRowBase + x];
                    
                    const l = ((p & 0xFF) + ((p >> 8) & 0xFF) + ((p >> 16) & 0xFF)) / 3;
                    const lr = ((pr & 0xFF) + ((pr >> 8) & 0xFF) + ((pr >> 16) & 0xFF)) / 3;
                    const ll = ((pl & 0xFF) + ((pl >> 8) & 0xFF) + ((pl >> 16) & 0xFF)) / 3;
                    const lt = ((pt & 0xFF) + ((pt >> 8) & 0xFF) + ((pt >> 16) & 0xFF)) / 3;
                    const lb = ((pb & 0xFF) + ((pb >> 8) & 0xFF) + ((pb >> 16) & 0xFF)) / 3;
                    
                    const deltaX = Math.abs(lr - ll);
                    const deltaY = Math.abs(lt - lb);
                    const deltaCenter = Math.abs(l - lr) + Math.abs(l - lt);
                    
                    // 🎯 Lower threshold (12) and much higher sensitivity (15x) for smoother lines
                    const edgeStrength = deltaX + deltaY + deltaCenter;
                    let finalG = 255;
                    
                    if (edgeStrength > 12) {
                        finalG = Math.max(30, 255 - (edgeStrength * 8)); 
                    } else if (l < 225) {
                        finalG = Math.max(170, l); 
                    }
                    
                    out32[idx] = (0xFF << 24) | (finalG << 16) | (finalG << 8) | finalG;
                }
            }
            
            ctx.putImageData(new ImageData(new Uint8ClampedArray(out32.buffer), w, h), 0, 0);
            resolve(canvas.toDataURL("image/png", 0.7));
        };
        img.src = imageDataURL;
    });
}
