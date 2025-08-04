import React, { useState, useEffect } from 'react';
import './PrintQueue.css';

const PrintQueue = ({ isVisible, onClose }) => {
  const [printJobs, setPrintJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadPrintQueue();
    }
  }, [isVisible]);

  const loadPrintQueue = async () => {
    try {
      console.log('📋 Loading print queue...');
      setLoading(true);
      if (window.electronAPI) {
        const queue = await window.electronAPI.getPrintQueue();
        console.log('📋 Queue result:', queue);
        setPrintJobs(queue.jobs || []);
        console.log('📋 Jobs loaded:', queue.jobs || []);
      } else {
        console.error('❌ Electron API not available');
      }
    } catch (error) {
      console.error('❌ Error loading print queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteJob = async (jobId) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.executePrintJob(jobId);
        await loadPrintQueue(); // Refresh the queue
      }
    } catch (error) {
      console.error('Error executing print job:', error);
      alert('Error executing print job: ' + error.message);
    }
  };

  const handleRemoveJob = async (jobId) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.removeFromPrintQueue(jobId);
        await loadPrintQueue(); // Refresh the queue
      }
    } catch (error) {
      console.error('Error removing print job:', error);
      alert('Error removing print job: ' + error.message);
    }
  };

  const handleClearQueue = async () => {
    if (confirm('Are you sure you want to clear all print jobs?')) {
      try {
        if (window.electronAPI) {
          await window.electronAPI.clearPrintQueue();
          await loadPrintQueue(); // Refresh the queue
        }
      } catch (error) {
        console.error('Error clearing print queue:', error);
        alert('Error clearing print queue: ' + error.message);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'printing': return '#007bff';
      case 'completed': return '#28a745';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatPrintOptions = (options) => {
    const parts = [];
    if (options.printMode) parts.push(options.printMode === 'color' ? 'Color' : 'B&W');
    if (options.doubleSided) parts.push('Double-sided');
    if (options.copies > 1) parts.push(`${options.copies} copies`);
    if (options.pageRange) parts.push(`Pages: ${options.pageRange}`);
    return parts.join(', ') || 'Default settings';
  };

  if (!isVisible) return null;

  return (
    <div className="print-queue-overlay">
      <div className="print-queue-window">
        <div className="print-queue-header">
          <h3>Print Queue</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="print-queue-toolbar">
          <button onClick={loadPrintQueue} className="refresh-btn">
            Refresh
          </button>
          <button onClick={handleClearQueue} className="clear-btn">
            Clear All
          </button>
        </div>

        <div className="print-queue-content">
          {loading ? (
            <div className="loading">Loading print queue...</div>
          ) : printJobs.length === 0 ? (
            <div className="empty-queue">
              <p>No print jobs in queue</p>
            </div>
          ) : (
            <div className="print-jobs-list">
              {printJobs.map((job) => (
                <div key={job.id} className="print-job-item">
                  <div className="job-header">
                    <h4>{job.fileName}</h4>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(job.status) }}
                    >
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="job-details">
                    <p><strong>Added:</strong> {formatTimestamp(job.timestamp)}</p>
                    <p><strong>Options:</strong> {formatPrintOptions(job.printOptions)}</p>
                  </div>

                  <div className="job-actions">
                    {job.status === 'pending' && (
                      <button 
                        onClick={() => handleExecuteJob(job.id)}
                        className="execute-btn"
                      >
                        Print Now
                      </button>
                    )}
                    <button 
                      onClick={() => handleRemoveJob(job.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintQueue; 