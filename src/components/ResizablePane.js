import { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------
// COMPONENT: ResizablePane (Modular)
// ---------------------------------------------------------
const ResizablePane = ({ first, second, vertical = false, initialSize = 66, minSize = 15, maxSize = 85, padding = "p-3", gap = "gap-0" }) => {
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            let newSize;
            if (vertical) {
                newSize = ((e.clientY - rect.top) / rect.height) * 100;
            } else {
                newSize = ((e.clientX - rect.left) / rect.width) * 100;
            }
            if (newSize > minSize && newSize < maxSize) setSize(newSize);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, vertical, minSize, maxSize]);

    return (
        <div ref={containerRef} className={`w-full h-full flex ${vertical ? 'flex-col' : 'flex-row'} ${padding} ${gap} overflow-hidden box-border bg-slate-50`}>
            <div style={{ [vertical ? 'height' : 'width']: `${size}%` }} className={`h-full ${vertical ? 'pb-1.5' : 'pr-1.5'}`}>
                {first}
            </div>

            <div
                className={`${vertical ? 'h-3 -mt-1.5 cursor-row-resize' : 'w-3 -ml-1.5 cursor-col-resize'} z-40 flex items-center justify-center group hover:scale-110 transition-transform`}
                onMouseDown={handleMouseDown}
            >
                <div className={`${vertical ? 'w-12 h-1' : 'w-1 h-12'} rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400'}`} />
            </div>

            <div style={{ [vertical ? 'height' : 'width']: `${100 - size}%` }} className={`h-full ${vertical ? 'pt-1.5' : 'pl-1.5'}`}>
                {second}
            </div>
        </div>
    );
};

export default ResizablePane;
