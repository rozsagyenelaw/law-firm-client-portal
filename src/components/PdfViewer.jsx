import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PdfViewer = ({ pdfUrl, pageNumber, onPageClick, signaturePlacements }) => {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);

  useEffect(() => {
    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdf) {
      renderPage(pageNumber);
    }
  }, [pdf, pageNumber]);

  const loadPdf = async () => {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const renderPage = async (num) => {
    if (!pdf || pageRendering) return;
    
    setPageRendering(true);
    
    try {
      const page = await pdf.getPage(num);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
    
    setPageRendering(false);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    onPageClick({
      x: x,
      y: y,
      page: pageNumber
    });
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="border border-gray-300 cursor-crosshair"
      />
      
      {/* Show existing signature placements */}
      {signaturePlacements
        .filter(p => p.page === pageNumber)
        .map((placement) => (
          <div
            key={placement.id}
            className="absolute border-2 border-green-500 bg-green-100 bg-opacity-30"
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              width: '150px',
              height: '50px',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="text-xs text-green-700 text-center mt-1">
              Signature
            </div>
          </div>
        ))}
    </div>
  );
};

export default PdfViewer;