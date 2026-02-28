"use client";

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface ImporterProps {
  onComplete: () => void;
  onClose: () => void;
}

export default function Importer({ onComplete, onClose }: ImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Waiting for file...");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, processed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // BULLETPROOF CSV PARSER
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    const results = [];
    
    // We assume row 0 is header, start at 1
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const rowData: string[] = [];
        let currentField = '';
        let inQuote = false;
        let quoteChar = '';

        for (let char of line) {
            if (inQuote) {
                if (char === quoteChar) {
                    inQuote = false;
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"' || char === "'") {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === ',') {
                    rowData.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
        }
        rowData.push(currentField.trim()); 

        // Check if we captured valid data
        // Index 0: Const (tt...), Index 1: Rating, Index 2: Date
        if (rowData.length >= 2) {
            const tconst = rowData[0];
            const scoreStr = rowData[1];
            const dateStr = rowData[2] || null; // Date is optional

            // Basic validation: Must look like an IMDb ID
            if (tconst.startsWith('tt') && scoreStr) {
                const score = parseFloat(scoreStr);
                if (!isNaN(score)) {
                    results.push({ tconst, score, date_rated: dateStr });
                }
            }
        }
    }
    return results;
  };

  const handleClearFile = () => {
      setFile(null);
      setError("");
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  };

  const startUpload = async () => {
    if (!file) return;
    setError(""); 
    setIsProcessing(true);
    setStatus("Analyzing file structure...");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const allRatings = parseCSV(text);
            
            setStats({ total: allRatings.length, processed: 0 });
            
            if (allRatings.length === 0) {
                setError("No valid ratings found. Ensure CSV has 'Const' and 'Your Rating' columns.");
                setIsProcessing(false); 
                return;
            }

            // Chunking Logic
            const BATCH_SIZE = 50;
            const totalBatches = Math.ceil(allRatings.length / BATCH_SIZE);
            
            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const chunk = allRatings.slice(start, end);

                try {
                    setStatus(`Assimilating batch ${i + 1} of ${totalBatches}...`);
                    await api.post('/rate/batch', { ratings: chunk });
                    
                    const currentProcessed = Math.min(end, allRatings.length);
                    setStats(prev => ({ ...prev, processed: currentProcessed }));
                    setProgress((currentProcessed / allRatings.length) * 100);
                    
                    await new Promise(r => setTimeout(r, 50));

                } catch (err) {
                    console.error("Batch failed", err);
                }
            }

            setStatus("Calibration Complete.");
            setTimeout(() => {
                onComplete(); 
                onClose();
            }, 1000);

        } catch (err) {
            setError("Failed to parse file.");
            setIsProcessing(false);
        }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl">
        
        {!isProcessing && (
            <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white">
                Cancel
            </button>
        )}

        <div className="w-full max-w-lg p-8 text-center">
            
            {/* FILE SELECT */}
            {!isProcessing ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="mx-auto w-20 h-20 bg-ekko-highlight/20 rounded-full flex items-center justify-center mb-6 text-ekko-highlight border border-ekko-highlight/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <Upload size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">IMPORT DATA</h2>
                    <p className="text-gray-400 mb-8">
                        Upload your IMDb ratings (CSV) to instantly calibrate your Profile.
                    </p>

                    <input 
                        type="file" 
                        accept=".csv"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                            setFile(e.target.files ? e.target.files[0] : null);
                            setError("");
                        }}
                    />

                    {file ? (
                        <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg flex items-center gap-3">
                            <FileText className="text-ekko-highlight" />
                            <span className="text-white font-bold truncate flex-1">{file.name}</span>
                            <button onClick={handleClearFile} className="text-gray-500 hover:text-red-400"><AlertCircle size={20}/></button>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="mb-8 p-8 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/5 hover:border-ekko-highlight transition-all group"
                        >
                            <span className="text-gray-500 group-hover:text-white font-bold">Click to select CSV</span>
                        </div>
                    )}
                    
                    {/* ERROR MESSAGE DISPLAY */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm font-bold flex items-center justify-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button 
                        onClick={startUpload}
                        disabled={!file}
                        className={`w-full py-4 font-bold rounded-lg transition-all ${
                            file 
                            ? "bg-ekko-highlight text-white hover:scale-105 shadow-lg" 
                            : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        INITIALIZE TRANSFER
                    </button>
                </motion.div>
            ) : (
                /* PROCESSING */
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                    
                    <div className="relative mb-8">
                        <div className="w-24 h-24 border-4 border-white/10 rounded-full" />
                        <div 
                            className="absolute inset-0 border-4 border-ekko-highlight border-t-transparent rounded-full animate-spin" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-ekko-highlight text-lg">
                            {Math.round(progress)}%
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white tracking-widest animate-pulse mb-2">
                        ASSIMILATING DATA
                    </h2>
                    <p className="text-gray-400 font-mono text-sm mb-6">
                        {status}
                    </p>

                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                        <motion.div 
                            className="h-full bg-ekko-highlight shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <div className="flex justify-between w-full text-xs text-gray-500 font-bold uppercase tracking-widest">
                        <span>Processed</span>
                        <span>{stats.processed} / {stats.total} Titles</span>
                    </div>

                </motion.div>
            )}
        </div>
    </div>
  );
}