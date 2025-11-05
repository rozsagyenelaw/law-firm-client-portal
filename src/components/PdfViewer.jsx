import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker - use local copy from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PdfViewer = ({ pdfUrl, onPageClick, signaturePlacements, onLoadSuccess }) => {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);
  const canvasRefs = useRef([]);

  useEffect(() => {
    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdf) {
      renderAllPages();
    }
  }, [pdf]);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      if (onLoadSuccess) {
        onLoadSuccess(pdfDoc.numPages);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const renderAllPages = async () => {
    if (!pdf) return;

    const numPages = pdf.numPages;
    const pages = [];

    // Initialize canvas refs
    canvasRefs.current = Array(numPages).fill(null).map(() => React.createRef());

    for (let i = 1; i <= numPages; i++) {
      pages.push({ pageNum: i });
    }

    setRenderedPages(pages);

    // Render each page
    setTimeout(async () => {
      for (let i = 1; i <= numPages; i++) {
        await renderPage(i);
      }
    }, 100);
  };

  const renderPage = async (pageNum) => {
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRefs.current[pageNum - 1];
      if (!canvas) return;

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
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  };

  const handleCanvasClick = (e, pageNum) => {
    const canvas = canvasRefs.current[pageNum - 1];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (onPageClick) {
      onPageClick({
        x: x,
        y: y,
        page: pageNum
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 border border-gray-300 rounded">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 border border-red-300 bg-red-50 rounded">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error loading PDF</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {renderedPages.map((pageInfo, index) => {
        const pageNum = pageInfo.pageNum;
        const pageSignatures = signaturePlacements.filter(p => p.page === pageNum);

        return (
          <div key={pageNum} className="relative inline-block">
            {/* Page number label */}
            <div className="absolute top-2 left-2 bg-blue-900 text-white px-2 py-1 rounded text-xs font-medium z-10">
              Page {pageNum}
            </div>

            <canvas
              ref={el => canvasRefs.current[index] = el}
              onClick={(e) => handleCanvasClick(e, pageNum)}
              className="border border-gray-300 cursor-crosshair block"
            />

            {/* Show existing signature placements */}
            {pageSignatures.map((placement) => (
              <div
                key={placement.id}
                className="absolute border-2 border-green-500 bg-green-100 bg-opacity-30 pointer-events-none"
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  width: '150px',
                  height: '50px',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="text-xs text-green-700 text-center mt-3 font-medium">
                  ✍️ Signature
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default PdfViewer;
