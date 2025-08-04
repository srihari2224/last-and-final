import React, { useState, useEffect, useRef } from 'react';
import './PDFPreviewWindow.css';

const PDFPreviewWindow = ({ file, onClose, onAddToQueue }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [printOptions, setPrintOptions] = useState({
    color: true,
    doubleSided: false,
    pageRange: '',
    copies: 1,
    printMode: 'color' // 'color' or 'bw'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (file && file.localPath) {
      setIsLoading(false);
      
      // Try to get PDF page count if available
      if (window.electronAPI) {
        window.electronAPI.getPdfPageCount(file.localPath)
          .then(result => {
            if (result.success && result.pageCount) {
              setTotalPages(result.pageCount);
            }
          })
          .catch(err => console.log('Could not get page count:', err));
      }
    }
  }, [file]);

  const handlePrint = async () => {
    try {
      console.log('🖨️ Opening PDF viewer for silent printing...');
      console.log('📁 File:', file);
      console.log('⚙️ Print options:', printOptions);
      
      if (window.electronAPI) {
        // Open PDF viewer window with the file
        const result = await window.electronAPI.openPdfViewer(file.localPath);
        
        if (result.success) {
          console.log('✅ PDF viewer opened successfully');
          // Close the preview window
          onClose();
        } else {
          throw new Error(result.error || 'Failed to open PDF viewer');
        }
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('❌ Error opening PDF viewer:', error);
      alert('Error opening PDF viewer: ' + error.message);
    }
  };

  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleScaleChange = (newScale) => {
    setScale(Math.max(0.5, Math.min(2, newScale)));
  };

  const handlePrintOptionsChange = (option, value) => {
    setPrintOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!file) {
    return (
      <div className="pdf-preview-overlay">
        <div className="pdf-preview-window">
          <div className="pdf-preview-header">
            <h3>PDF Preview</h3>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
          <div className="pdf-preview-content">
            <p>No file selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-preview-overlay">
      <div className="pdf-preview-window">
        <div className="pdf-preview-header">
          <h3>{file.name}</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="pdf-preview-toolbar">
          <div className="page-controls">
            <button 
              onClick={() => handlePageChange('prev')}
              disabled={currentPage <= 1}
            >
              ‹
            </button>
            <span>{currentPage} of {totalPages || '?'}</span>
            <button 
              onClick={() => handlePageChange('next')}
              disabled={currentPage >= totalPages}
            >
              ›
            </button>
          </div>
          
          <div className="zoom-controls">
            <button onClick={() => handleScaleChange(scale - 0.1)}>-</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => handleScaleChange(scale + 0.1)}>+</button>
          </div>
        </div>

        <div className="pdf-preview-content">
          {isLoading ? (
            <div className="loading">Loading PDF...</div>
          ) : (
            <iframe
              ref={iframeRef}
              src={`file://${file.localPath.replace(/\\/g, '/')}`}
              title="PDF Preview"
              className="pdf-iframe"
              style={{ transform: `scale(${scale})` }}
              onLoad={() => {
                console.log('PDF iframe loaded');
                setIsLoading(false);
              }}
              onError={() => {
                console.log('PDF iframe failed to load, showing fallback');
                setIsLoading(false);
              }}
            />
          )}
        </div>

        <div className="print-options-panel">
          <h4>Print Options</h4>
          
          <div className="print-option-group">
            <label>
              <input
                type="radio"
                name="printMode"
                value="color"
                checked={printOptions.printMode === 'color'}
                onChange={(e) => handlePrintOptionsChange('printMode', e.target.value)}
              />
              Color
            </label>
            <label>
              <input
                type="radio"
                name="printMode"
                value="bw"
                checked={printOptions.printMode === 'bw'}
                onChange={(e) => handlePrintOptionsChange('printMode', e.target.value)}
              />
              Black & White
            </label>
          </div>

          <div className="print-option-group">
            <label>
              <input
                type="radio"
                name="doubleSided"
                value="single"
                checked={!printOptions.doubleSided}
                onChange={() => handlePrintOptionsChange('doubleSided', false)}
              />
              Single Sided
            </label>
            <label>
              <input
                type="radio"
                name="doubleSided"
                value="double"
                checked={printOptions.doubleSided}
                onChange={() => handlePrintOptionsChange('doubleSided', true)}
              />
              Double Sided
            </label>
          </div>

          <div className="print-option-group">
            <label>
              Page Range:
              <input
                type="text"
                placeholder="e.g., 1-3, 5, 7-9"
                value={printOptions.pageRange}
                onChange={(e) => handlePrintOptionsChange('pageRange', e.target.value)}
              />
            </label>
          </div>

          <div className="print-option-group">
            <label>
              Copies:
              <input
                type="number"
                min="1"
                max="10"
                value={printOptions.copies}
                onChange={(e) => handlePrintOptionsChange('copies', parseInt(e.target.value))}
              />
            </label>
          </div>

          <div className="print-actions">
            <button onClick={handlePrint} className="print-btn">
              🖨️ Open PDF Viewer
            </button>
            <button onClick={onClose} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewWindow; 