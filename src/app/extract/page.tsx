"use client";

import { useState, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { Upload, Download, Loader2, Edit2, Check, Folder, Crop as CropIcon, Search, Trash2, FileText, CheckCircle, AlertCircle, XCircle, TrendingUp, RefreshCw } from 'lucide-react';
import styles from './extract.module.css';
import CropModal from '../../components/CropModal';
import EditModal from '../../components/EditModal';
import { db, Extraction } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line } from 'recharts';

type FilterType = 'original' | 'high_contrast' | 'binary_threshold' | 'enlarged_sharpened';

// ----- Image Processing Utilities -----
const compressImage = async (file: File | Blob, maxWidth = 1200): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = maxWidth / img.width;
      const finalWidth = img.width > maxWidth ? maxWidth : img.width;
      const finalHeight = img.width > maxWidth ? img.height * scale : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
      canvas.toBlob((blob) => {
        resolve(blob || file);
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
};

const cropImageBlob = async (blob: Blob, rect: { x: number, y: number, w: number, h: number }): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sx = img.width * rect.x;
      const sy = img.height * rect.y;
      const sWidth = img.width * rect.w;
      const sHeight = img.height * rect.h;

      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(url);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

const processImage = (dataUrl: string, filter: FilterType): Promise<string> => {
  return new Promise((resolve) => {
    if (filter === 'original') return resolve(dataUrl);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = filter === 'enlarged_sharpened' ? 3 : (filter === 'binary_threshold' ? 2 : 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(dataUrl);

      if (filter === 'high_contrast') {
        ctx.filter = 'grayscale(100%) contrast(300%) brightness(110%)';
      } else if (filter === 'enlarged_sharpened' || filter === 'binary_threshold') {
        ctx.filter = 'grayscale(100%) contrast(200%)';
      }
      
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      if (filter === 'binary_threshold') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i+1] + data[i+2]) / 3;
          const val = avg > 120 ? 255 : 0;
          data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
};

// ----- Extraction Logic -----
const extractOrderIdOnly = (text: string) => {
  let orderId = '';
  const exactOrderMatch = text.match(/ORDER\s*ID[\s\S]{0,15}?#?\s*(\d{3,8})/i) ||
                          text.match(/ORDERID[\s\S]{0,10}?#?\s*(\d{3,8})/i) ||
                          text.match(/ORDER[\s\S]{0,10}?#?\s*(\d{3,8})/i) ||
                          text.match(/#\s*(\d{3,8})/i);
  
  if (exactOrderMatch && exactOrderMatch[1]) {
     orderId = exactOrderMatch[1];
  } else {
     const allNums = Array.from(text.matchAll(/\b(\d{3,8})\b/g)).map(m => m[1]);
     const validOrderId = allNums.find(num => num !== '606203' && num !== '1' && num.length !== 6);
     if (validOrderId) orderId = validOrderId;
  }
  return orderId;
};

const extractAwbWithProximity = (words: Tesseract.Word[]): { awb: string, confidence: number } | null => {
  const stWords = words.filter(w => w.text.toLowerCase().includes('st') || w.text.toLowerCase().includes('courier'));
  let lowestStY = 0;
  if (stWords.length > 0) {
    lowestStY = Math.max(...stWords.map(w => w.bbox.y1));
  }

  const ignoreKeywords = ['ph', 'phone', 'mob', 'mobile', 'call', 'contact', 'm:', 'ph:'];
  let bestCandidate = null;

  for (const word of words) {
    const text = word.text.replace(/[^0-9]/g, '');
    if (text.length >= 10 && text.length <= 12) {
      if (text === '9626198278' || text === '8438819400') continue;
      if (text.length === 6) continue;
      if (lowestStY > 0 && word.bbox.y0 < lowestStY - 20) continue; 
      
      const wordIndex = words.indexOf(word);
      const prevWords = words.slice(Math.max(0, wordIndex - 6), wordIndex);
      const nearIgnore = prevWords.some(pw => ignoreKeywords.some(ik => pw.text.toLowerCase().includes(ik)));
      if (nearIgnore) continue;

      if (!bestCandidate || word.confidence > bestCandidate.confidence) {
        bestCandidate = { awb: text, confidence: word.confidence };
      }
    }
  }

  return bestCandidate;
};

const runAwbMultiPass = async (baseCropUrl: string) => {
  const passes: FilterType[] = ['original', 'high_contrast', 'binary_threshold', 'enlarged_sharpened'];
  let bestAwb = '';
  let highestConfidence = 0;

  for (const pass of passes) {
    const processedUrl = await processImage(baseCropUrl, pass);
    const result = await Tesseract.recognize(processedUrl, 'eng');
    const match = extractAwbWithProximity(result.data.words);
    if (match) {
      if (match.confidence > highestConfidence) {
        highestConfidence = match.confidence;
        bestAwb = match.awb;
      }
      if (match.confidence > 95) break; 
    }
  }
  return { awb: bestAwb, confidence: highestConfidence };
};

const getValidationStatus = (awb: string, orderId: string, awbConf: number = 0): Extraction['status'] => {
  const isAwbValid = awb && awb.length >= 10 && awb.length <= 12;
  const isOrderIdValid = orderId && orderId.length > 0;
  
  if (isAwbValid && isOrderIdValid) {
    return awbConf >= 95 ? 'Success' : 'Needs Review';
  }
  if (awb || orderId) return 'Needs Review';
  return 'Failed';
};

// ----- Main Component -----
export default function ExtractPage() {
  const allExtractions = useLiveQuery(() => db.extractions.orderBy('uploadedAt').reverse().toArray()) || [];
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState('');
  const [editAwb, setEditAwb] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [confidenceFilter, setConfidenceFilter] = useState('All Confidence');

  // Manual Crop
  const [manualCropId, setManualCropId] = useState<string | null>(null);
  const [manualCropImageUrl, setManualCropImageUrl] = useState<string | null>(null);

  // Computed Analytics
  const stats = useMemo(() => {
    const total = allExtractions.length;
    const success = allExtractions.filter(e => e.status === 'Success').length;
    const needsReview = allExtractions.filter(e => e.status === 'Needs Review' || e.status === 'Pending' || e.status === 'Extracting').length;
    const failed = allExtractions.filter(e => e.status === 'Failed').length;
    
    const successesWithConf = allExtractions.filter(e => e.status === 'Success' && e.awbConfidence > 0);
    const avgConf = successesWithConf.length ? (successesWithConf.reduce((acc, e) => acc + e.awbConfidence, 0) / successesWithConf.length) : 0;

    return { total, success, needsReview, failed, avgConf };
  }, [allExtractions]);

  // Computed Charts Data
  const pieData = [
    { name: 'Success', value: stats.success, color: 'var(--success)' },
    { name: 'Needs Review', value: stats.needsReview, color: 'var(--warning)' },
    { name: 'Failed', value: stats.failed, color: 'var(--danger)' },
  ];

  const barData = useMemo(() => {
    const buckets = { '< 70%': 0, '70-80%': 0, '80-90%': 0, '90-95%': 0, '> 95%': 0 };
    allExtractions.filter(e => e.awbConfidence > 0).forEach(e => {
      if (e.awbConfidence < 70) buckets['< 70%']++;
      else if (e.awbConfidence < 80) buckets['70-80%']++;
      else if (e.awbConfidence < 90) buckets['80-90%']++;
      else if (e.awbConfidence < 95) buckets['90-95%']++;
      else buckets['> 95%']++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [allExtractions]);

  const lineData = useMemo(() => {
    const dates: Record<string, number> = {};
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }).reverse();
    
    last7Days.forEach(d => dates[d] = 0);
    
    allExtractions.forEach(e => {
      const d = new Date(e.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (dates[d] !== undefined) dates[d]++;
    });
    
    return Object.entries(dates).map(([date, uploads]) => ({ date, uploads }));
  }, [allExtractions]);

  // Apply Filters
  const filteredExtractions = useMemo(() => {
    return allExtractions.filter(item => {
      const matchesSearch = item.imageName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.orderId.includes(searchQuery) || 
                            item.awb.includes(searchQuery);
      
      const matchesStatus = statusFilter === 'All Status' || item.status === statusFilter;
      
      let matchesConf = true;
      if (confidenceFilter === '< 90%') matchesConf = item.awbConfidence < 90;
      if (confidenceFilter === '> 90%') matchesConf = item.awbConfidence >= 90;

      return matchesSearch && matchesStatus && matchesConf;
    });
  }, [allExtractions, searchQuery, statusFilter, confidenceFilter]);

  const checkStorageLimit = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        const usagePercent = (estimate.usage / estimate.quota) * 100;
        if (usagePercent > 80) {
          alert('Storage limit almost reached. Please export or clear old data.');
        }
      }
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await checkStorageLimit();

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsProcessing(true);

    for (const file of imageFiles) {
      const id = Math.random().toString(36).substring(7);
      
      // Save pending state
      await db.extractions.put({
        id,
        imageName: file.name,
        orderId: '',
        awb: '',
        awbConfidence: 0,
        status: 'Extracting',
        uploadedAt: Date.now(),
      });

      try {
        const fullBlobUrl = URL.createObjectURL(file);
        const fullResult = await Tesseract.recognize(fullBlobUrl, 'eng');
        
        const cropTopRightDataUrl = await cropImageBlob(file, { x: 0.5, y: 0, w: 0.5, h: 0.4 });
        const cropTopRightResult = await Tesseract.recognize(cropTopRightDataUrl, 'eng');
        const orderIdText = fullResult.data.text + "\n" + cropTopRightResult.data.text;
        const orderId = extractOrderIdOnly(orderIdText);

        const cropBottomDataUrl = await cropImageBlob(file, { x: 0, y: 0.60, w: 1.0, h: 0.40 });
        const { awb, confidence } = await runAwbMultiPass(cropBottomDataUrl);

        const status = getValidationStatus(awb, orderId, confidence);
        
        // Compress image before saving blob permanently
        const compressedBlob = await compressImage(file);

        // Deduplication Check
        const existingByAwb = awb ? await db.extractions.where('awb').equals(awb).first() : undefined;

        if (existingByAwb && existingByAwb.id !== id) {
          // AWB already exists, update the older row and delete the temporary one
          await db.extractions.update(existingByAwb.id, {
            imageName: file.name,
            orderId,
            awbConfidence: Math.max(confidence, existingByAwb.awbConfidence || 0),
            status: confidence > (existingByAwb.awbConfidence || 0) ? status : existingByAwb.status,
            uploadedAt: Date.now(),
            fileBlob: compressedBlob
          });
          await db.extractions.delete(id);
        } else {
          // Normal save (update the temporary Extracting row)
          await db.extractions.update(id, {
            orderId,
            awb,
            awbConfidence: confidence,
            status,
            fileBlob: compressedBlob
          });
        }
        
        URL.revokeObjectURL(fullBlobUrl);
      } catch (error) {
        await db.extractions.update(id, { status: 'Failed' });
      }
    }
    setIsProcessing(false);
  };

  const handleCropOcr = async (croppedDataUrl: string) => {
    return await runAwbMultiPass(croppedDataUrl);
  };

  const handleCropSave = async (orderId: string, awb: string, confidence: number) => {
    if (!manualCropId) return;
    const status = getValidationStatus(awb, orderId, confidence);
    
    console.log("Saving manual edit:");
    console.log("Record ID:", manualCropId);
    console.log("New values:", { orderId, awb, confidence, status });

    const updated = await db.extractions.update(manualCropId, { 
      orderId,
      awb, 
      awbConfidence: confidence, 
      status,
      updatedAt: new Date().toISOString(),
      manualEdited: true
    });

    console.log("Dexie update result:", updated);

    if (updated === 0) {
      alert("Save failed: record not found.");
    }
  };

  const openManualCrop = async (id: string) => {
    const item = await db.extractions.get(id);
    if (item && item.fileBlob) {
      setManualCropId(id);
      setManualCropImageUrl(URL.createObjectURL(item.fileBlob));
    } else {
      alert("Original image data not found. It may have been cleared.");
    }
  };

  const startEdit = async (e: Extraction) => {
    setEditingId(e.id);
    setEditOrderId(e.orderId);
    setEditAwb(e.awb);
    
    const item = await db.extractions.get(e.id);
    if (item && item.fileBlob) {
      setEditImageUrl(URL.createObjectURL(item.fileBlob));
    } else {
      setEditImageUrl(null);
    }
  };

  const closeEdit = () => {
    setEditingId(null);
    if (editImageUrl) {
      URL.revokeObjectURL(editImageUrl);
      setEditImageUrl(null);
    }
  };

  const handleEditModalSave = async (orderId: string, awb: string) => {
    if (!editingId) return;
    const status = getValidationStatus(awb, orderId, 100);
    
    console.log("Saving manual edit:");
    console.log("Record ID:", editingId);
    console.log("New values:", { orderId, awb, confidence: 100, status });

    const updated = await db.extractions.update(editingId, {
      orderId,
      awb,
      awbConfidence: 100, // manual edit assumes 100% conf
      status,
      updatedAt: new Date().toISOString(),
      manualEdited: true
    });

    console.log("Dexie update result:", updated);

    if (updated === 0) {
      alert("Save failed: record not found.");
    }
    
    closeEdit();
  };

  const deleteRow = async (id: string) => {
    if (confirm('Delete this row?')) {
      await db.extractions.delete(id);
    }
  };

  const clearAllData = async () => {
    if (confirm('Are you sure you want to completely erase all saved extraction data?')) {
      await db.extractions.clear();
    }
  };

  const downloadCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Image Name,Order ID,AWB Number,Confidence,Status,Uploaded At\n" + 
      filteredExtractions.map(i => {
        const date = new Date(i.uploadedAt).toLocaleString();
        return `"${i.imageName}","${i.orderId}","${i.awb}","${i.awbConfidence.toFixed(1)}%","${i.status}","${date}"`
      }).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "st_courier_extractions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p>{`${payload[0].name || payload[0].payload.date} : ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Image Upload & Extract</h1>
          <p>Select a folder of parcel images. We will automatically parse all of them sequentially.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn" onClick={downloadCsv} disabled={filteredExtractions.length === 0}>
            <Download size={18} />
            Download CSV
          </button>
        </div>
      </header>

      {/* Top Upload Section */}
      <div className={styles.topSection}>
        <div className={`glass-panel ${styles.uploadZone}`}>
          <input 
            type="file" 
            multiple 
            {...({ webkitdirectory: "true", directory: "true" } as any)}
            accept="image/*"
            id="folder-upload" 
            className={styles.fileInput}
            onChange={handleFolderUpload}
            disabled={isProcessing}
          />
          <div className={styles.uploadLabel}>
            {isProcessing ? <Loader2 size={32} className={`spin ${styles.uploadIcon}`} /> : <Folder size={32} className={styles.uploadIcon} />}
            <h3>Upload Folder / Multiple Images</h3>
            <span className={styles.uploadButton}>
              {isProcessing ? 'Processing...' : 'Browse Folder'}
            </span>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <FileText size={24} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statTitle}>Total Images</div>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statSubtext}>All uploaded images</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <CheckCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statTitle}>Success</div>
              <div className={styles.statValue}>{stats.success}</div>
              <div className={styles.statSubtext}>{stats.total ? ((stats.success / stats.total) * 100).toFixed(1) : 0}% of total</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
              <AlertCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statTitle}>Needs Review</div>
              <div className={styles.statValue}>{stats.needsReview}</div>
              <div className={styles.statSubtext}>{stats.total ? ((stats.needsReview / stats.total) * 100).toFixed(1) : 0}% of total</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
              <XCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statTitle}>Failed</div>
              <div className={styles.statValue}>{stats.failed}</div>
              <div className={styles.statSubtext}>{stats.total ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}% of total</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)' }}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statTitle}>Avg. Confidence</div>
              <div className={styles.statValue}>{stats.avgConf.toFixed(1)}%</div>
              <div className={styles.statSubtext}>Across all success</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>Status Overview</div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>Confidence Distribution</div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>Uploads Over Time</div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="uploads" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className={`glass-panel ${styles.tableWrapper}`}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by Order ID, AWB, or Image Name..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All Status">All Status</option>
            <option value="Success">Success</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Failed">Failed</option>
          </select>
          <select className={styles.filterSelect} value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
            <option value="All Confidence">All Confidence</option>
            <option value="> 90%">&gt; 90% Confidence</option>
            <option value="< 90%">&lt; 90% Confidence</option>
          </select>
          <button className={styles.resetBtn} onClick={() => { setSearchQuery(''); setStatusFilter('All Status'); setConfidenceFilter('All Confidence'); }}>
            <RefreshCw size={16} /> Reset
          </button>
          
          <button className={styles.clearAllBtn} onClick={clearAllData} disabled={allExtractions.length === 0}>
            <Trash2 size={16} /> Clear All Data
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Image Name</th>
                <th>Order ID</th>
                <th>AWB Number</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Uploaded At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExtractions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No extracted images found.
                  </td>
                </tr>
              ) : filteredExtractions.map((item) => (
                <tr key={item.id}>
                  <td>{item.imageName}</td>
                  <td>{item.orderId || '-'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{item.awb || '-'}</td>
                  <td>
                    {item.awbConfidence ? (
                      <span style={{ color: item.awbConfidence >= 95 ? 'var(--success)' : 'var(--warning)' }}>
                        {item.awbConfidence === 100 ? 'Manual (100%)' : `${item.awbConfidence.toFixed(1)}%`}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${
                      item.status === 'Success' ? 'badge-success' : 
                      item.status === 'Extracting' || item.status === 'Needs Review' ? 'badge-warning' : 
                      item.status === 'Failed' ? 'badge-danger' : 'badge-neutral'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className={styles.timestamp}>{new Date(item.uploadedAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.actionBtn} onClick={() => startEdit(item)} title="Edit Row">
                        <Edit2 size={16} />
                      </button>
                      {(item.status === 'Needs Review' || item.status === 'Failed') && !isProcessing && (
                        <button 
                          className={`${styles.actionBtn} ${styles.actionWarning}`} 
                          onClick={() => openManualCrop(item.id)}
                          title="Select AWB Sticker"
                        >
                          <CropIcon size={16} />
                        </button>
                      )}
                      <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => deleteRow(item.id)} title="Delete Row">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {manualCropImageUrl && (
        <CropModal
          isOpen={true}
          imageUrl={manualCropImageUrl}
          initialOrderId={allExtractions.find(e => e.id === manualCropId)?.orderId || ''}
          onClose={() => {
            setManualCropImageUrl(null);
            setManualCropId(null);
          }}
          onConfirm={handleCropOcr}
          onSave={handleCropSave}
        />
      )}

      <EditModal
        isOpen={!!editingId}
        onClose={closeEdit}
        initialOrderId={editOrderId}
        initialAwb={editAwb}
        imageUrl={editImageUrl}
        onSave={handleEditModalSave}
      />
    </div>
  );
}
