import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, FileSpreadsheet, Trash2, Calendar, User, FileText, Heart, Pencil, Save, X, Printer, ChevronDown, ExternalLink, PlusCircle, MoveVertical, ClipboardCheck } from 'lucide-react';
import { ThyroidEntry, MedicationPeriod, PatientInfo, MedicationMark } from './types';
import ThyroidChart from './components/ThyroidChart';
import { cn, formatDate } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const getInitialPatients = () => {
    const saved = localStorage.getItem('patients');
    if (saved) return JSON.parse(saved);
    const defaultPatient: PatientInfo = { 
      id: 'p1', 
      name: 'Patienten Name', 
      birthDate: '', 
      diagnosisDate: '' 
    };
    return [defaultPatient];
  };

  const [patients, setPatients] = useState<PatientInfo[]>(getInitialPatients);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const pId = params.get('p');
    if (pId) return pId;
    const pts = getInitialPatients();
    return localStorage.getItem('selectedPatientId') || pts[0]?.id || 'p1';
  });

  const [entries, setEntries] = useState<ThyroidEntry[]>(() => {
    const saved = localStorage.getItem('thyroidEntries');
    const parsed: ThyroidEntry[] = saved ? JSON.parse(saved) : [];
    return parsed.map(e => ({ ...e, patientId: e.patientId || 'p1' }));
  });

  const currentPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  useEffect(() => {
    if (currentPatient) {
      document.title = `Butterfly Thyroid Journal - ${currentPatient.name}`;
    }
  }, [currentPatient]);

  useEffect(() => {
    // Migration check: ensure selected patient exists
    if (patients.length > 0 && !patients.find(p => p.id === selectedPatientId)) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'patients' && e.newValue) {
        setPatients(JSON.parse(e.newValue));
      }
      if (e.key === 'selectedPatientId' && e.newValue) {
        setSelectedPatientId(e.newValue);
      }
      if (e.key === 'thyroidEntries' && e.newValue) {
        const parsed: ThyroidEntry[] = JSON.parse(e.newValue);
        setEntries(parsed.map(e => ({ ...e, patientId: e.patientId || 'p1' })));
      }
      if (e.key === 'medicationMarks' && e.newValue) {
        const parsed: MedicationMark[] = JSON.parse(e.newValue);
        setMedicationMarks(parsed.map(m => ({ ...m, patientId: m.patientId || 'p1' })));
      }
      if (e.key === 'globalRefs' && e.newValue) {
        setGlobalRefs(JSON.parse(e.newValue));
      }
      if (e.key === 'chartSpacing' && e.newValue) {
        setChartSpacing(parseInt(e.newValue));
      }
      if (e.key === 'printOrientation' && e.newValue) {
        setPrintOrientation(e.newValue as 'portrait' | 'landscape');
      }
      if (e.key === 'activeTab' && e.newValue) {
        setActiveTab(e.newValue as 'list' | 'charts');
      }
      if (e.key === 'timeRange' && e.newValue) {
        setTimeRange(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ThyroidEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>(() => localStorage.getItem('timeRange') || 'Gesamt');
  const [showMedPeriod, setShowMedPeriod] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'charts'>(() => (localStorage.getItem('activeTab') as 'list' | 'charts') || 'list');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>(() => {
    return (localStorage.getItem('printOrientation') as 'portrait' | 'landscape') || 'landscape';
  });
  const [chartSpacing, setChartSpacing] = useState(() => {
    return parseInt(localStorage.getItem('chartSpacing') || '20');
  });
  const [globalRefs, setGlobalRefs] = useState(() => {
    const saved = localStorage.getItem('globalRefs');
    if (saved) return JSON.parse(saved);
    return {
      tsh: [0.27, 4.20],
      t4: [9.30, 17.0],
      t3: [2.00, 4.40],
      trak: [0, 1.75],
    };
  });
  const [isEditingRefs, setIsEditingRefs] = useState(false);
  const [medicationMarks, setMedicationMarks] = useState<MedicationMark[]>(() => {
    const saved = localStorage.getItem('medicationMarks');
    if (saved) {
      const parsed: MedicationMark[] = JSON.parse(saved);
      return parsed.map(m => ({ ...m, patientId: m.patientId || 'p1' }));
    }
    return [];
  });
  const [isEditingMedications, setIsEditingMedications] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const currentMedicationMarks = medicationMarks.filter(m => m.patientId === selectedPatientId);

  // Helper for backfilling zero values
  const backfill = (entryList: ThyroidEntry[]) => {
    const sorted = [...entryList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const keys: (keyof ThyroidEntry)[] = ['tsh', 't4', 't3', 'trak', 'thyroxin', 'pulse'];
    
    return sorted.map((entry, index) => {
      const updated = { ...entry };
      keys.forEach(key => {
        if (typeof updated[key] === 'number' && updated[key] === 0) {
          // Look back
          for (let i = index - 1; i >= 0; i--) {
            const prevVal = sorted[i][key];
            if (typeof prevVal === 'number' && prevVal > 0) {
              (updated as any)[key] = prevVal;
              break;
            }
          }
        }
      });
      return updated;
    });
  };

  const patientEntries = entries.filter(e => e.patientId === selectedPatientId);
  const interpolatedEntries = backfill(patientEntries);

  const filteredEntries = patientEntries.filter(e => {
    if (timeRange === 'Gesamt') return true;
    const year = parseInt(timeRange);
    if (!isNaN(year)) {
      return new Date(e.date).getFullYear() === year;
    }
    return true;
  });

  const chartDataFiltered = interpolatedEntries.filter(e => {
    if (timeRange === 'Gesamt') return true;
    const year = parseInt(timeRange);
    if (!isNaN(year)) {
      return new Date(e.date).getFullYear() === year;
    }
    return true;
  });

  const [tempDate, setTempDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    localStorage.setItem('patients', JSON.stringify(patients));
    localStorage.setItem('selectedPatientId', selectedPatientId);
    localStorage.setItem('thyroidEntries', JSON.stringify(entries));
    localStorage.setItem('medicationMarks', JSON.stringify(medicationMarks));
    localStorage.setItem('globalRefs', JSON.stringify(globalRefs));
    localStorage.setItem('chartSpacing', chartSpacing.toString());
    localStorage.setItem('printOrientation', printOrientation);
    localStorage.setItem('activeTab', activeTab);
    localStorage.setItem('timeRange', timeRange);

    const url = new URL(window.location.href);
    if (url.searchParams.get('p') !== selectedPatientId) {
      url.searchParams.set('p', selectedPatientId);
      window.history.replaceState({}, '', url);
    }
  }, [patients, selectedPatientId, entries, medicationMarks, globalRefs, chartSpacing, printOrientation, activeTab, timeRange]);

  // Migration: Update Ref values from 15.07.2025 onwards
  useEffect(() => {
    const thresholdDate = new Date('2025-07-15').getTime();
    setEntries(prev => {
      let changed = false;
      const next = prev.map(entry => {
        if (new Date(entry.date).getTime() >= thresholdDate) {
          let entryChanged = false;
          const updated = { ...entry };
          
          if (entry.t4Ref[0] !== 12 || entry.t4Ref[1] !== 22) {
            updated.t4Ref = [12, 22];
            entryChanged = true;
          }
          if (entry.t3Ref[0] !== 3.95 || entry.t3Ref[1] !== 6.80) {
            updated.t3Ref = [3.95, 6.80];
            entryChanged = true;
          }
          if (entry.trakRef[0] !== 1.75 || entry.trakRef[1] !== 1.85) {
            updated.trakRef = [1.75, 1.85];
            entryChanged = true;
          }

          if (entryChanged) {
            changed = true;
            return updated;
          }
        }
        return entry;
      });
      return changed ? next : prev;
    });
  }, []);

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  const executePrint = () => {
    setShowPrintModal(false);
    try {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (e) {
      console.error("Print attempt failed", e);
      window.print();
    }
  };

  const handleJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.patient && data.entries) {
          // Import single patient backup
          setPatients(prev => {
            if (prev.find(p => p.id === data.patient.id)) {
               return prev.map(p => p.id === data.patient.id ? data.patient : p);
            }
            return [...prev, data.patient];
          });
          setEntries(prev => {
            const others = prev.filter(e => e.patientId !== data.patient.id);
            return [...others, ...data.entries];
          });
          if (data.medicationMarks) {
            setMedicationMarks(prev => {
              const others = prev.filter(m => m.patientId !== data.patient.id);
              return [...others, ...data.medicationMarks];
            });
          }
          setSelectedPatientId(data.patient.id);
        } else if (Array.isArray(data.patients) && Array.isArray(data.entries)) {
          // Multi-patient import
          setPatients(data.patients);
          setEntries(data.entries);
          if (data.medicationMarks) setMedicationMarks(data.medicationMarks);
          if (data.globalRefs) setGlobalRefs(data.globalRefs);
          if (data.chartSpacing) setChartSpacing(data.chartSpacing);
          if (data.printOrientation) setPrintOrientation(data.printOrientation);
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
        alert("Ungültige JSON Datei");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveAs = async () => {
    const data = {
      patients,
      entries,
      medicationMarks,
      globalRefs,
      chartSpacing,
      printOrientation,
      exportDate: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    
    // Attempt System Save Picker
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `Butterfly_Full_Backup_${new Date().toISOString().split('T')[0]}.json`,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (err) {
        console.error("Save picker failed or cancelled", err);
      }
    }
    
    // Fallback to standard download for EVERYTHING
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Butterfly_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPatientData = () => {
    const data = {
      patient: currentPatient,
      entries: patientEntries,
      medicationMarks: medicationMarks.filter(m => m.patientId === selectedPatientId),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PatientenDaten_${currentPatient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addPatient = () => {
    const newId = `p${Date.now()}`;
    const newPatient: PatientInfo = {
      id: newId,
      name: `Patient ${patients.length + 1}`,
      birthDate: '1980-01-01',
      diagnosisDate: ''
    };
    setPatients([...patients, newPatient]);
    setSelectedPatientId(newId);
  };

  const deletePatient = (id: string) => {
    const filteredPatients = patients.filter(p => p.id !== id);
    if (filteredPatients.length === 0) return; // Should not happen with UI guard

    setPatients(filteredPatients);
    setEntries(entries.filter(e => e.patientId !== id));
    setMedicationMarks(medicationMarks.filter(m => m.patientId !== id));
    
    if (selectedPatientId === id) {
      setSelectedPatientId(filteredPatients[0].id);
    }
    setPatientToDelete(null);
  };

  const deleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    setEntryToDelete(null);
  };

  const startEditEntry = (entry: ThyroidEntry) => {
    setEditingEntry(entry);
    setTempDate(entry.date.split('T')[0]);
    setShowMedPeriod(!!(entry.medication?.from || entry.medication?.to));
    setIsAddingEntry(true);
  };

  return (
    <>
    <style>
{`
  @media print {
    @page {
      size: A4 ${printOrientation};
      margin: 15mm;
    }
    body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-size: 10pt;
    }
    .print\:hidden {
      display: none !important;
    }
    /* Layout Reset for Print */
    .min-h-screen, main, .max-w-5xl {
      min-height: auto !important;
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      max-width: none !important;
      width: 100% !important;
      display: block !important;
    }
    header {
      margin-top: 0 !important;
      margin-bottom: 15mm !important;
      text-align: left !important;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 5mm;
      page-break-after: avoid;
    }
    /* Better spacing for components */
    .lg:col-span-3, section, .recharts-responsive-container, .bg-white {
      page-break-inside: avoid;
      margin-bottom: 12mm !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    /* Specific Table Styling for Print */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    th, td {
      border-bottom: 1px solid #f1f5f9 !important;
      padding: 4pt 2pt !important;
    }
    /* Chart Adjustments */
    .recharts-responsive-container {
      min-height: 250px !important;
      width: 100% !important;
      margin: 5mm 0 !important;
    }
  }
  /* Ensure backgrounds and colors are printed */
  * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
`}
</style>
    <div className="min-h-screen bg-natural-50 pb-20 max-w-5xl mx-auto px-6 pt-1 print:bg-white print:px-0 print:pt-4 print:max-w-none">
      <header className="mb-8 w-full border-b border-natural-200 pb-4 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-md border border-slate-100 transform -rotate-2 hover:rotate-0 transition-all duration-500 cursor-pointer group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-purple-50 opacity-40"></div>
              {/* Abstract Suggested Butterfly SVG */}
              <svg viewBox="0 0 100 100" className="w-11 h-11 relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-500">
                {/* Upper Wings (Stroke based) */}
                <path 
                  d="M50 50 C 50 30, 20 15, 12 30 C 8 40, 18 60, 48 55" 
                  fill="none" 
                  stroke="#8B7ED4" 
                  strokeWidth="10" 
                  strokeLinecap="round" 
                  strokeOpacity="0.9"
                />
                <path 
                  d="M50 50 C 50 30, 80 15, 88 30 C 92 40, 82 60, 52 55" 
                  fill="none" 
                  stroke="#8B7ED4" 
                  strokeWidth="10" 
                  strokeLinecap="round" 
                  strokeOpacity="0.9"
                />
                {/* Lower Wings (Stroke based) */}
                <path 
                  d="M50 50 C 45 65, 30 85, 18 82 C 10 78, 18 68, 48 58" 
                  fill="none" 
                  stroke="#2dd4bf" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  strokeOpacity="0.8"
                />
                <path 
                  d="M50 50 C 55 65, 70 85, 82 82 C 90 78, 82 68, 52 58" 
                  fill="none" 
                  stroke="#2dd4bf" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  strokeOpacity="0.8"
                />
                {/* Center accent */}
                <circle cx="50" cy="50" r="3.5" fill="#334155" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-light font-display text-natural-900 tracking-tight uppercase leading-tight group-hover:text-emerald-600 transition-colors">Butterfly</h1>
              <p className="text-[11px] text-natural-400 font-black uppercase tracking-[0.3em] leading-tight">Thyroid Journal</p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3">
             <div className="flex flex-wrap justify-center md:justify-end gap-1.5 bg-white p-1.5 rounded-[22px] border border-natural-200 shadow-sm">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      const url = new URL(window.location.href);
                      url.searchParams.set('p', p.id);
                      window.history.replaceState({}, '', url);
                    }}
                    className={cn(
                      "px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 relative",
                      selectedPatientId === p.id 
                        ? "bg-slate-900 text-white shadow-xl scale-105 z-10 -translate-y-0.5" 
                        : "text-natural-400 hover:text-natural-900 hover:bg-natural-50"
                    )}
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      selectedPatientId === p.id ? "bg-emerald-400 animate-pulse" : "bg-natural-200"
                    )} />
                    {p.name}
                    {patients.length > 1 && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPatientToDelete(p.id);
                        }}
                        className={cn(
                          "ml-2 p-1 rounded-lg transition-all z-20 hover:scale-110 active:scale-90",
                          selectedPatientId === p.id 
                            ? "bg-white/10 text-white/40 hover:text-white hover:bg-white/20" 
                            : "bg-natural-50 text-natural-300 hover:text-red-500 hover:bg-red-50"
                        )}
                        title="Patient löschen"
                      >
                        <X size={10} strokeWidth={3} />
                      </div>
                    )}
                    {selectedPatientId === p.id && (
                      <motion.div 
                        layoutId="activePatient"
                        className="absolute inset-0 border-2 border-emerald-400/30 rounded-[18px]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                ))}
                <button 
                  onClick={addPatient}
                  className="w-11 h-11 flex items-center justify-center text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-[18px] transition-all bg-emerald-50 ml-1 group"
                  title="Neuer Patient"
                >
                  <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Patient Profile Header Details */}
      <header className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4 w-full">
        <div className="space-y-1 w-full md:w-auto">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input 
                type="text"
                autoFocus
                value={currentPatient?.name}
                onChange={e => setPatients(patients.map(p => p.id === selectedPatientId ? {...p, name: e.target.value} : p))}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                className="text-4xl font-light font-display text-natural-900 tracking-tight italic bg-white border-b-2 border-natural-300 focus:outline-none w-full"
              />
              <button onClick={() => setIsEditingName(false)} className="p-2 bg-emerald-500 text-white rounded-full"><Save size={16}/></button>
            </div>
          ) : (
            <h1 
              onClick={() => setIsEditingName(true)}
              className="text-4xl font-light font-display text-natural-900 tracking-tight italic cursor-pointer hover:opacity-70 flex items-center gap-3 decoration-natural-200 decoration-1 underline-offset-8"
            >
              {currentPatient?.name}
              <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-natural-400 uppercase tracking-[0.2em] font-bold">
            <span className="flex items-center gap-2">
              Geb: <span className="hidden print:inline font-bold text-natural-900">{currentPatient?.birthDate}</span>
              <input 
                type="date"
                value={currentPatient?.birthDate}
                onChange={e => setPatients(patients.map(p => p.id === selectedPatientId ? {...p, birthDate: e.target.value} : p))}
                className="bg-transparent border-b border-natural-200 focus:border-natural-900 focus:outline-none transition-colors print:hidden"
              />
            </span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-2">
              Diagnose: <span className="hidden print:inline font-bold text-natural-900">{currentPatient?.diagnosisDate}</span>
              <input 
                type="date"
                value={currentPatient?.diagnosisDate}
                onChange={e => setPatients(patients.map(p => p.id === selectedPatientId ? {...p, diagnosisDate: e.target.value} : p))}
                className="bg-transparent border-b border-natural-200 focus:border-natural-900 focus:outline-none transition-colors print:hidden"
              />
            </span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-2">
              Zeitraum: <span className="hidden print:inline font-bold text-natural-900">{timeRange}</span>
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent border-b border-natural-200 focus:border-natural-900 focus:outline-none font-bold cursor-pointer print:hidden p-0"
              >
                <option value="Gesamt">Gesamt</option>
                {Array.from(new Set(entries.map(e => new Date(e.date).getFullYear()))).sort((a: number, b: number) => b - a).map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  setTempDate(new Date().toISOString().split('T')[0]);
                  setIsAddingEntry(true);
                }}
                className="ml-4 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all active:scale-95 print:hidden border border-emerald-100 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Neuer Eintrag
              </button>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 items-end ml-auto print:hidden">
          <button 
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md hover:bg-slate-800 transition-all active:scale-95 cursor-pointer w-32 justify-center"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            Drucken
          </button>
          
          <div className="relative group">
            <button 
              className="flex items-center gap-2 text-slate-400 hover:text-black py-1 px-2 text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Aktionen <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl py-2 min-w-[200px] hidden group-hover:block z-50 overflow-hidden">
              <button 
                type="button"
                onClick={handleSaveAs}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all"
              >
                <Save className="w-3 h-3" />
                Speichern unter...
              </button>
              <button 
                type="button"
                onClick={handleExportPatientData}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-all"
              >
                <Download className="w-3 h-3" />
                Export JSON
              </button>
              <label className="flex items-center gap-2 w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 cursor-pointer transition-all">
                <Download className="w-3 h-3 rotate-180" />
                Import JSON
                <input type="file" accept=".json" onChange={handleJSONImport} className="hidden" />
              </label>
              <a 
                href={`${window.location.origin}${window.location.pathname}?p=${selectedPatientId}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-900 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Neuer Tab
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="mb-4 print:hidden">
        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex bg-natural-100 p-1 rounded-full w-full">
          <button 
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'list' ? "bg-white text-natural-900 shadow-sm" : "text-natural-400"
            )}
          >
            Tabellarisch
          </button>
          <button 
            onClick={() => setActiveTab('charts')}
            className={cn(
              "flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'charts' ? "bg-white text-natural-900 shadow-sm" : "text-natural-400"
            )}
          >
            Diagramme
          </button>
        </div>
      </div>

      <main className="relative overflow-hidden md:overflow-visible">
        <div className="hidden md:block print:block space-y-4">
          {/* Desktop view is the same as before */}
          <LegendSection entries={patientEntries} />
            <div className="lg:col-span-3 bg-white rounded-[24px] border border-natural-200 shadow-sm overflow-hidden">
            <ListHeader 
              selectedPatientId={selectedPatientId}
              globalRefs={globalRefs} 
              setGlobalRefs={setGlobalRefs} 
              isEditingRefs={isEditingRefs}
              setIsEditingRefs={setIsEditingRefs}
              medicationMarks={medicationMarks} // Full list
              setMedicationMarks={setMedicationMarks}
              isEditingMedications={isEditingMedications}
              setIsEditingMedications={setIsEditingMedications}
              formatDate={formatDate}
            />
            <EntriesTable 
              entries={filteredEntries} 
              medicationMarks={currentMedicationMarks}
              formatDate={formatDate} 
              startEditEntry={startEditEntry} 
              setEntryToDelete={setEntryToDelete}
            />
          </div>

          <div className="print:hidden flex items-center gap-4 mt-12 mb-4 px-4 py-3 bg-white/30 rounded-2xl border border-dashed border-natural-200">
            <div className="flex items-center gap-2 shrink-0">
              <MoveVertical className="w-3.5 h-3.5 text-natural-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-natural-500">Abstand Diagramme</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="200" 
              step="5"
              value={chartSpacing}
              onChange={(e) => setChartSpacing(Number(e.target.value))}
              className="flex-1 h-1 bg-natural-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] font-bold text-natural-700 bg-white px-2 py-0.5 rounded-md border border-natural-100 shadow-sm">{(chartSpacing / 10).toFixed(1)} cm</span>
          </div>

          <style>
            {`
              @media print { 
                .print-chart-margin { margin-top: ${chartSpacing}mm !important; } 
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .bg-white { background-color: #ffffff !important; }
                tr { border-bottom: 1px solid #e2e8f0 !important; page-break-inside: avoid; }
                thead { display: table-header-group; }
                .medication-print-label { font-weight: 900 !important; color: #000000 !important; }
              }
            `}
          </style>
          <div className="print-chart-margin" style={{ marginTop: `${chartSpacing}mm` }}>
            <ChartSection 
              chartRef={chartRef} 
              filteredEntries={chartDataFiltered} 
              spacing={0} 
              globalRefs={globalRefs} 
              medicationMarks={currentMedicationMarks}
            />
          </div>
        </div>

        {/* Mobile Swipable Gallery */}
        <div className="md:hidden print:hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'list' ? (
              <motion.div
                key="list"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="space-y-6"
              >
                <LegendSection entries={patientEntries} />
                <div className="bg-white rounded-[24px] border border-natural-200 shadow-sm overflow-hidden">
                  <ListHeader 
                    selectedPatientId={selectedPatientId}
                    globalRefs={globalRefs} 
                    setGlobalRefs={setGlobalRefs} 
                    isEditingRefs={isEditingRefs}
                    setIsEditingRefs={setIsEditingRefs}
                    medicationMarks={medicationMarks} // Full list
                    setMedicationMarks={setMedicationMarks}
                    isEditingMedications={isEditingMedications}
                    setIsEditingMedications={setIsEditingMedications}
                    formatDate={formatDate}
                  />
                  <EntriesMobileList 
                    entries={filteredEntries} 
                    medicationMarks={currentMedicationMarks}
                    formatDate={formatDate} 
                    startEditEntry={startEditEntry} 
                    setEntryToDelete={setEntryToDelete} 
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="charts"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <div className="p-2 mb-4">
                  <h3 className="text-[10px] font-bold text-natural-400 uppercase tracking-[0.2em]">Verlaufsdiagramme</h3>
                </div>
                <ThyroidChart data={chartDataFiltered} globalRefs={globalRefs} medicationMarks={currentMedicationMarks} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-20 py-10 border-t border-natural-100 print:hidden text-center">
        <p className="text-sm font-light text-natural-400">© 2026 Butterfly Thyroid Journal - Alle Patientendaten werden lokal gespeichert.</p>
      </footer>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingEntry(false);
                setEditingEntry(null);
              }}
              className="absolute inset-0 bg-slate-900 bg-opacity-60"
            />
            <motion.div 
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl p-6 md:p-8 w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black font-display text-slate-900 leading-none mb-2">
                    {editingEntry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {editingEntry ? 'Werte anpassen' : 'Laboranalyse erfassen'}
                  </p>
                </div>
                <button onClick={() => { setIsAddingEntry(false); setEditingEntry(null); setShowMedPeriod(false); }} className="p-2 bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const entryData = {
                  patientId: selectedPatientId,
                  date: formData.get('date') as string,
                  tsh: parseFloat(formData.get('tsh') as string) || 0,
                  tshRef: [
                    parseFloat(formData.get('tshRefMin') as string) || null,
                    parseFloat(formData.get('tshRefMax') as string) || null
                  ] as [number | null, number | null],
                  t4: parseFloat(formData.get('t4') as string) || 0,
                  t4Ref: [
                    parseFloat(formData.get('t4RefMin') as string) || null,
                    parseFloat(formData.get('t4RefMax') as string) || null
                  ] as [number | null, number | null],
                  t3: parseFloat(formData.get('t3') as string) || 0,
                  t3Ref: [
                    parseFloat(formData.get('t3RefMin') as string) || null,
                    parseFloat(formData.get('t3RefMax') as string) || null
                  ] as [number | null, number | null],
                  trak: parseFloat(formData.get('trak') as string) || 0,
                  trakRef: [
                    parseFloat(formData.get('trakRefMin') as string) || null,
                    parseFloat(formData.get('trakRefMax') as string) || null
                  ] as [number | null, number | null],
                  thyroxin: parseFloat(formData.get('thyroxin') as string) || 0,
                  pulse: parseFloat(formData.get('pulse') as string) || 0,
                  sonderanalysen: formData.get('sonderanalysen') as string || '',
                  medication: {
                    label: formData.get('medication') as string || '',
                    from: formData.get('medicationFrom') as string || '',
                    to: formData.get('medicationTo') as string || '',
                  },
                  notes: formData.get('notes') as string || '',
                  isSurgery: formData.get('isSurgery') === 'on',
                  isRowMarked: formData.get('isRowMarked') === 'on',
                  rowColor: formData.get('rowColor') as string || '#FEF9C3',
                };
                
                if (editingEntry) {
                  setEntries(entries.map(ent => ent.id === editingEntry.id ? { ...ent, ...entryData } : ent));
                } else {
                  const newEntry: ThyroidEntry = {
                    id: Math.random().toString(36).substr(2, 9),
                    patientId: selectedPatientId,
                    ...entryData
                  };
                  setEntries([...entries, newEntry]);
                }
                setIsAddingEntry(false);
                setEditingEntry(null);
                if (entryData.isRowMarked) {
                  setTimeout(() => {
                    chartRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }
              }} className="space-y-6">
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Datum der Entnahme</label>
                      <input 
                        type="date" 
                        name="date" 
                        required 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold text-slate-700" 
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-4">
                      {/* Lab Values Grid */}
                      <div className="space-y-4 bg-slate-100 p-4 rounded-2xl border border-slate-100">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">TSH (µU/ml)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input 
                              type="number" 
                              step="0.001" 
                              name="tsh" 
                              placeholder="Wert" 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                              defaultValue={editingEntry?.tsh}
                            />
                            <div className="flex gap-2">
                              <input type="number" step="0.01" name="tshRefMin" placeholder="Min" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.tshRef[0] ?? globalRefs.tsh[0]} />
                              <input type="number" step="0.01" name="tshRefMax" placeholder="Max" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.tshRef[1] ?? globalRefs.tsh[1]} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">fT4 (ng/l)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input 
                              type="number" 
                              step="0.001" 
                              name="t4" 
                              placeholder="Wert" 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                              defaultValue={editingEntry?.t4}
                            />
                            <div className="flex gap-2">
                              <input type="number" step="0.01" name="t4RefMin" placeholder="Min" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.t4Ref[0] ?? globalRefs.t4[0]} key={`t4min-${tempDate}-${editingEntry?.id}`} />
                              <input type="number" step="0.01" name="t4RefMax" placeholder="Max" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.t4Ref[1] ?? globalRefs.t4[1]} key={`t4max-${tempDate}-${editingEntry?.id}`} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">fT3 (pg/ml)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input 
                              type="number" 
                              step="0.001" 
                              name="t3" 
                              placeholder="Wert" 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                              defaultValue={editingEntry?.t3}
                            />
                            <div className="flex gap-2">
                              <input type="number" step="0.01" name="t3RefMin" placeholder="Min" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.t3Ref[0] ?? globalRefs.t3[0]} key={`t3min-${tempDate}-${editingEntry?.id}`} />
                              <input type="number" step="0.01" name="t3RefMax" placeholder="Max" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.t3Ref[1] ?? globalRefs.t3[1]} key={`t3max-${tempDate}-${editingEntry?.id}`} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-violet-500 uppercase tracking-widest ml-1">TRAK</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input 
                              type="number" 
                              step="0.001" 
                              name="trak" 
                              placeholder="Wert" 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                              defaultValue={editingEntry?.trak}
                            />
                            <div className="flex gap-2">
                              <input type="number" step="0.01" name="trakRefMin" placeholder="Min" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.trakRef[0] ?? globalRefs.trak[0]} key={`trakmin-${tempDate}-${editingEntry?.id}`} />
                              <input type="number" step="0.01" name="trakRefMax" placeholder="Max" className="flex-1 text-[10px] p-3 bg-white border border-slate-200 rounded-xl font-bold" defaultValue={editingEntry?.trakRef[1] ?? globalRefs.trak[1]} key={`trakmax-${tempDate}-${editingEntry?.id}`} />
                            </div>
                          </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">L-Thyroxin (µg)</label>
                      <input 
                        type="number" 
                        step="1" 
                        name="thyroxin" 
                        placeholder="0" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                        defaultValue={editingEntry?.thyroxin}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Heart className="w-2.5 h-2.5" /> Puls (Ruhe)
                      </label>
                      <input 
                        type="number" 
                        name="pulse" 
                        placeholder="z.B. 65" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-400 focus:outline-none font-bold" 
                        defaultValue={editingEntry?.pulse}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest ml-1">MEDIKATION / THERAPIE</label>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          name="medication" 
                          placeholder="Präparat (z.B. Neomercazol 5mg)" 
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:outline-none font-bold italic text-sm" 
                          defaultValue={editingEntry?.medication?.label}
                        />
                        <div className="flex items-center gap-2 px-1">
                          <input 
                            type="checkbox" 
                            id="toggle-period" 
                            checked={showMedPeriod}
                            onChange={(e) => setShowMedPeriod(e.target.checked)}
                            className="w-4 h-4 accent-yellow-400 rounded cursor-pointer"
                          />
                          <label htmlFor="toggle-period" className="text-[10px] font-bold text-natural-500 uppercase tracking-wider cursor-pointer">Zeitraum festlegen (von - bis)</label>
                        </div>
                        {showMedPeriod && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="grid grid-cols-2 gap-2 overflow-hidden"
                          >
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-natural-400 uppercase tracking-widest ml-1">Von</label>
                              <input 
                                type="date" 
                                name="medicationFrom" 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-yellow-400 text-[10px] font-bold" 
                                defaultValue={editingEntry?.medication?.from}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-natural-400 uppercase tracking-widest ml-1">Bis</label>
                              <input 
                                type="date" 
                                name="medicationTo" 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-yellow-400 text-[10px] font-bold" 
                                defaultValue={editingEntry?.medication?.to}
                              />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Sonderanalysen / US</label>
                      <input 
                        type="text" 
                        name="sonderanalysen" 
                        placeholder="z.B. Cortisol, Szinti..." 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none font-bold" 
                        defaultValue={editingEntry?.sonderanalysen}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          name="isRowMarked" 
                          id="mark-entry" 
                          defaultChecked={editingEntry?.isRowMarked} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setShowMedPeriod(true);
                            }
                          }}
                          className="w-5 h-5 accent-slate-900 rounded" 
                        />
                        <label htmlFor="mark-entry" className="text-xs font-bold text-slate-700 cursor-pointer">Zeile hervorheben & Zeitraum</label>
                      </div>
                      <input type="color" name="rowColor" defaultValue={editingEntry?.rowColor || "#FEF9C3"} className="w-10 h-10 p-0 border-0 bg-transparent rounded cursor-pointer" />
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <input 
                        type="checkbox" 
                        name="isSurgery" 
                        id="isSurgery" 
                        className="w-5 h-5 accent-red-600 rounded" 
                        defaultChecked={editingEntry?.isSurgery}
                      />
                      <label htmlFor="isSurgery" className="text-xs font-bold text-red-600 cursor-pointer uppercase tracking-tighter">Markierung als OP / Spezial</label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bemerkungen</label>
                    <textarea 
                      name="notes" 
                      placeholder="Besonderheiten, Befinden, etc." 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-400 focus:outline-none font-medium text-sm" 
                      defaultValue={editingEntry?.notes}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddingEntry(false);
                      setEditingEntry(null);
                    }}
                    className="flex-1 bg-slate-100 text-slate-500 px-6 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center"
                  >
                    Abbrechen
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#32CD32] text-white px-6 py-4 rounded-2xl font-bold hover:bg-[#2dbb2d] transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Save className="w-5 h-5" />
                    {editingEntry ? 'Aktualisieren' : 'Speichern'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        {/* Confirm Delete Modal */}
      <AnimatePresence>
        {entryToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEntryToDelete(null)}
              className="absolute inset-0 bg-slate-900 bg-opacity-60"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Eintrag löschen?</h3>
              <p className="text-sm text-slate-500 mb-8">
                Möchtest du diesen Messwert wirklich unwiderruflich löschen?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setEntryToDelete(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={() => deleteEntry(entryToDelete)}
                  className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Patient Delete Modal */}
      <AnimatePresence>
        {patientToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPatientToDelete(null)}
              className="absolute inset-0 bg-slate-900 bg-opacity-60"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Patient löschen?</h3>
              <p className="text-sm text-slate-500 mb-8">
                Möchtest du <strong>{patients.find(p => p.id === patientToDelete)?.name}</strong> und alle zugehörigen Daten wirklich löschen?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setPatientToDelete(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={() => deletePatient(patientToDelete)}
                  className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Settings Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrintModal(false)}
              className="absolute inset-0 bg-slate-900 bg-opacity-60"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-sm relative z-10"
            >
              <div className="mb-6">
                <h2 className="text-xl font-black font-display text-slate-900 mb-1">Druck-Einstellungen</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Layout für den Export anpassen</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Patient</label>
                  <select 
                    value={selectedPatientId}
                    onChange={(e) => {
                      setSelectedPatientId(e.target.value);
                      const url = new URL(window.location.href);
                      url.searchParams.set('p', e.target.value);
                      window.history.replaceState({}, '', url);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:outline-none font-bold text-slate-700"
                  >
                    {patients.map((p, idx) => (
                      <option key={p.id} value={p.id}>#{idx + 1} {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Format</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setPrintOrientation('portrait')}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                        printOrientation === 'portrait' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                      )}
                    >
                      A4 Hoch
                    </button>
                    <button 
                      onClick={() => setPrintOrientation('landscape')}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                        printOrientation === 'landscape' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                      )}
                    >
                      A4 Quer
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Abstand zu Diagrammen</label>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{(chartSpacing / 10).toFixed(1)} cm</span>
                  </div>
                  <div className="px-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="150" 
                      step="5"
                      value={chartSpacing}
                      onChange={(e) => setChartSpacing(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 mt-1 font-bold">
                      <span>0 CM</span>
                      <span>15 CM</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowPrintModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all text-[11px] uppercase tracking-widest"
                  >
                    Abbrechen
                  </button>
                  <button 
                    onClick={executePrint}
                    className="flex-1 py-4 bg-black text-white font-bold rounded-2xl hover:bg-slate-800 transition-all text-[11px] uppercase tracking-widest shadow-lg shadow-slate-100 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Drucken
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

// Helper Components
function LegendSection({ entries }: { entries: ThyroidEntry[] }) {
  const getLatestNonZero = (key: string) => {
    const sorted = [...entries].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const entry of sorted) {
      const val = (entry as any)[key];
      if (typeof val === 'number' && val !== 0) {
        return val;
      }
    }
    return '-';
  };

  return (
    <section className="flex flex-wrap gap-2 md:gap-3 p-3 bg-white/50 rounded-3xl border border-natural-200 print:bg-white print:border-none print:p-0 print:mb-6">
      {[
        { label: 'TSH', color: 'bg-slate-900', unit: 'mU/l', key: 'tsh' },
        { label: 'fT4', color: 'bg-slate-600', unit: 'ng/l', key: 't4' },
        { label: 'fT3', color: 'bg-emerald-600', unit: 'pg/ml', key: 't3' },
        { label: 'TRAK', color: 'bg-violet-600', unit: 'IU/ml', key: 'trak' },
        { label: 'L-THYROXIN', color: 'bg-natural-900', unit: 'µg', key: 'thyroxin' },
        { label: 'PULS', color: 'bg-[#F9844A]', unit: 'bpm', key: 'pulse' },
      ].map(stat => {
        const value = getLatestNonZero(stat.key);
        
        return (
          <div key={stat.label} className="flex-1 min-w-[100px] bg-white px-4 py-2.5 rounded-2xl border border-natural-100 flex items-center gap-3 shadow-sm transition-transform hover:scale-105">
            <div className={cn("w-2 h-2 rounded-full shrink-0", stat.color)} />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-natural-900 text-sm leading-none">{value}</span>
                <span className="font-bold text-natural-400 text-[8px] uppercase tracking-tighter">{stat.label}</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ListHeader({ 
  selectedPatientId,
  globalRefs, 
  setGlobalRefs, 
  isEditingRefs, 
  setIsEditingRefs,
  medicationMarks,
  setMedicationMarks,
  isEditingMedications,
  setIsEditingMedications,
  formatDate
}: { 
  selectedPatientId: string,
  globalRefs: any, 
  setGlobalRefs: (r: any) => void,
  isEditingRefs: boolean,
  setIsEditingRefs: (b: boolean) => void,
  medicationMarks: MedicationMark[],
  setMedicationMarks: (m: MedicationMark[]) => void,
  isEditingMedications: boolean,
  setIsEditingMedications: (b: boolean) => void,
  formatDate: (d: string) => string
}) {
  return (
    <div className="px-6 py-4 border-b border-natural-100 bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-light font-display text-natural-900 uppercase tracking-tight">LABORDATEN HISTORIE</h3>
          <p className="text-[10px] text-natural-600 font-bold uppercase tracking-[0.2em] mt-1">VOLLSTÄNDIGES PROTOKOLL</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditingMedications(!isEditingMedications)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all print:hidden",
              isEditingMedications ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-100"
            )}
          >
            {isEditingMedications ? <Save size={10} /> : <ClipboardCheck size={10} />}
            {isEditingMedications ? "Fertig" : "MEDIKAMENTE & SONDEREINTRÄGE"}
          </button>
          <button 
            onClick={() => setIsEditingRefs(!isEditingRefs)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all print:hidden",
              isEditingRefs ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-100"
            )}
          >
            {isEditingRefs ? <Save size={10} /> : <Pencil size={10} />}
            {isEditingRefs ? "Speichern" : "Referenzwerte ändern"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Reference Values Row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            { label: 'TSH', key: 'tsh', unit: 'mU/l' },
            { label: 'fT4', key: 't4', unit: 'ng/l' },
            { label: 'fT3', key: 't3', unit: 'pg/ml' },
            { label: 'TRAK', key: 'trak', unit: 'IU/ml' },
          ].map(ref => (
            <div key={ref.key} className="flex items-center gap-2">
              <span className="text-[10px] font-black text-natural-400 uppercase tracking-widest">{ref.label}:</span>
              {isEditingRefs ? (
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
                  <input 
                    type="number" 
                    step="0.01"
                    value={globalRefs[ref.key][0]}
                    onChange={e => setGlobalRefs({...globalRefs, [ref.key]: [parseFloat(e.target.value) || 0, globalRefs[ref.key][1]]})}
                    className="w-10 text-[10px] font-bold bg-transparent text-center focus:outline-none"
                  />
                  <span className="text-[8px] text-slate-300">-</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={globalRefs[ref.key][1]}
                    onChange={e => setGlobalRefs({...globalRefs, [ref.key]: [globalRefs[ref.key][0], parseFloat(e.target.value) || 0]})}
                    className="w-10 text-[10px] font-bold bg-transparent text-center focus:outline-none"
                  />
                </div>
              ) : (
                <span className="text-xs font-bold text-natural-900">
                  {globalRefs[ref.key][0]} - {globalRefs[ref.key][1]}
                  <span className="text-[8px] text-natural-300 ml-1 font-normal italic">({ref.unit})</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Medication Row */}
        <div className="pt-2 border-t border-natural-50">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-[9px] font-black text-natural-400 uppercase tracking-widest">Medikamente:</span>
            {isEditingMedications && (
              <button 
                onClick={() => {
                  const newMark: MedicationMark = {
                    id: Math.random().toString(36).substr(2, 9),
                    patientId: selectedPatientId,
                    label: '',
                    from: new Date().toISOString().split('T')[0],
                    to: new Date().toISOString().split('T')[0],
                    color: '#fde68a'
                  };
                  setMedicationMarks([...medicationMarks, newMark]);
                }}
                className="flex items-center gap-1 text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100 hover:bg-emerald-100"
              >
                + Hinzufügen
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {medicationMarks.filter(m => m.patientId === selectedPatientId).map(mark => (
              <div key={mark.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 p-1 shadow-sm transition-all hover:border-slate-300">
                {isEditingMedications ? (
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      value={mark.label}
                      onChange={e => setMedicationMarks(medicationMarks.map(m => m.id === mark.id ? {...m, label: e.target.value} : m))}
                      placeholder="Medikament"
                      className="text-[10px] font-bold px-2 py-1 bg-slate-50 border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 w-24"
                    />
                    <input 
                      type="text" 
                      value={mark.notes || ''}
                      onChange={e => setMedicationMarks(medicationMarks.map(m => m.id === mark.id ? {...m, notes: e.target.value} : m))}
                      placeholder="Bemerkung"
                      className="text-[10px] font-bold px-2 py-1 bg-slate-50 border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 w-24"
                    />
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-md border border-slate-100">
                      <input 
                        type="date" 
                        value={mark.from}
                        onChange={e => setMedicationMarks(medicationMarks.map(m => m.id === mark.id ? {...m, from: e.target.value} : m))}
                        className="text-[9px] font-bold bg-transparent focus:outline-none"
                      />
                      <span className="text-[8px] text-slate-300">-</span>
                      <input 
                        type="date" 
                        value={mark.to}
                        onChange={e => setMedicationMarks(medicationMarks.map(m => m.id === mark.id ? {...m, to: e.target.value} : m))}
                        className="text-[9px] font-bold bg-transparent focus:outline-none"
                      />
                    </div>
                    <input 
                      type="color" 
                      value={mark.color}
                      onChange={e => setMedicationMarks(medicationMarks.map(m => m.id === mark.id ? {...m, color: e.target.value} : m))}
                      className="w-5 h-5 p-0 bg-transparent border-none cursor-pointer"
                    />
                    <button 
                      onClick={() => setMedicationMarks(medicationMarks.filter(m => m.id !== mark.id))}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mark.color }} />
                    <span className="text-[9px] font-bold text-slate-800 uppercase">{mark.label || 'Unbenannt'}</span>
                    <span className="text-[7px] text-slate-400 italic">({formatDate(mark.from)} - {formatDate(mark.to)})</span>
                  </div>
                )}
              </div>
            ))}
            {!isEditingMedications && medicationMarks.length === 0 && (
              <span className="text-[9px] text-natural-300 italic">Keine aktiven Markierungen</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const markToLightColor = (color: string) => {
  return color + '20';
};

function EntriesTable({ entries, medicationMarks = [], formatDate, startEditEntry, setEntryToDelete }: { 
  entries: ThyroidEntry[], 
  medicationMarks?: MedicationMark[],
  formatDate: (d: string) => string, 
  startEditEntry: (e: ThyroidEntry) => void, 
  setEntryToDelete: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-natural-50 text-natural-600 uppercase text-[9px] font-black tracking-widest border-b border-natural-100">
          <tr>
            <th className="px-3 py-2">Datum</th>
            <th className="px-1 py-1 text-center">TSH</th>
            <th className="px-1 py-1 text-center">fT4</th>
            <th className="px-1 py-1 text-center">fT3</th>
            <th className="px-1 py-1 text-center">TRAK</th>
            <th className="px-1 py-1 text-center">Thyroxin</th>
            <th className="px-1 py-1 text-center">Puls</th>
            <th className="px-3 py-2">Medikation & Notizen</th>
            <th className="px-3 py-2 text-right print:hidden">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-natural-100 text-natural-800">
          {[...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry) => {
            // Highlight row if date overlaps with any global medication mark
            const medicationMark = medicationMarks.find(m => {
              const d = new Date(entry.date);
              const start = new Date(m.from);
              const end = new Date(m.to);
              return d >= start && d <= end;
            });

            return (
              <tr key={entry.id}
                className={cn(
                  "hover:bg-natural-100 transition-colors group",
                )}
                style={medicationMark 
                  ? { backgroundColor: markToLightColor(medicationMark.color) } 
                  : entry.isRowMarked ? { backgroundColor: entry.rowColor || '#FEF9C3' } : {}}
              >
                <td className="px-3 py-1 font-bold whitespace-nowrap text-[11px]">
                  {formatDate(entry.date)}
                  {entry.isSurgery && <span className="ml-1 text-[7px] bg-red-100 text-red-600 px-0.5 rounded uppercase tracking-tighter">OP</span>}
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="font-bold text-black block text-xs leading-none">{entry.tsh}</span>
                  <span className="text-[8px] text-natural-400 block mt-0.5 font-normal">({entry.tshRef[0]}-{entry.tshRef[1]})</span>
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="font-bold text-black block text-xs leading-none">{entry.t4}</span>
                  <span className="text-[8px] text-natural-400 block mt-0.5 font-normal">({entry.t4Ref[0]}-{entry.t4Ref[1]})</span>
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="font-bold text-black block text-xs leading-none">{entry.t3}</span>
                  <span className="text-[8px] text-natural-400 block mt-0.5 font-normal">({entry.t3Ref[0]}-{entry.t3Ref[1]})</span>
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="font-bold text-black block text-xs leading-none">{entry.trak}</span>
                  <span className="text-[8px] text-natural-400 block mt-0.5 font-normal">({entry.trakRef[0]}-{entry.trakRef[1]})</span>
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="font-bold text-natural-900 block text-xs leading-none">{entry.thyroxin || 0}</span>
                </td>
                <td className="px-1 py-1 text-center">
                  <span className="block font-medium text-xs leading-none">{entry.pulse}</span>
                </td>
                <td className="px-3 py-1 text-[9px] leading-tight max-w-xs">
                  {entry.medication && entry.medication.label && (
                    <span className="bg-[#FEF9C3] px-1 py-0.5 rounded border border-yellow-300 font-bold inline-block mr-1">
                      {entry.medication.label.toUpperCase()}
                    </span>
                  )}
                  {medicationMark && (
                    <div className="inline-block mr-1 p-0.5 px-1 rounded border border-black/10 mb-1" style={{ backgroundColor: medicationMark.color }}>
                      <span className="font-black text-[8px] uppercase tracking-tighter text-slate-900">
                        {medicationMark.label || 'MARK'}
                      </span>
                    </div>
                  )}
                  {entry.notes && <span className="text-natural-500 italic">{entry.notes}</span>}
                </td>
                <td className="px-2 py-1 text-right print:hidden">
                  <div className="flex justify-end gap-0 w-max ml-auto items-center">
                    <button onClick={() => startEditEntry(entry)} className="p-1 text-natural-300 hover:text-slate-900 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEntryToDelete(entry.id)} className="p-1 text-natural-300 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntriesMobileList({ entries, medicationMarks = [], formatDate, startEditEntry, setEntryToDelete }: { 
  entries: ThyroidEntry[], 
  medicationMarks?: MedicationMark[],
  formatDate: (d: string) => string, 
  startEditEntry: (e: ThyroidEntry) => void, 
  setEntryToDelete: (id: string) => void 
}) {
  return (
    <div className="divide-y divide-natural-100">
      {[...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry) => {
        const medicationMark = medicationMarks.find(m => {
          const d = new Date(entry.date);
          const start = new Date(m.from);
          const end = new Date(m.to);
          return d >= start && d <= end;
        });

        return (
          <div 
            key={entry.id} 
            className="p-4"
            style={medicationMark 
              ? { backgroundColor: markToLightColor(medicationMark.color) } 
              : entry.isRowMarked ? { backgroundColor: (entry.rowColor || '#FEF9C3') + '20' } : {}}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="font-medium text-natural-900 font-display flex items-center gap-2">
                  {formatDate(entry.date)}
                  {medicationMark && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: medicationMark.color }} />}
                </p>
                {entry.medication && entry.medication.label && (
                  <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wide">
                    {entry.medication.label.toUpperCase()}
                    {(entry.medication.from || entry.medication.to) && (
                      <span className="block opacity-60 font-normal">
                        ({entry.medication.from ? formatDate(entry.medication.from) : ''} 
                        {entry.medication.to ? ` - ${formatDate(entry.medication.to)}` : entry.medication.from ? ' - heute' : ''})
                      </span>
                    )}
                  </p>
                )}
                {medicationMark && (
                  <div className="mt-1 inline-block px-1 rounded border border-black/10" style={{ backgroundColor: medicationMark.color }}>
                    <p className="text-[7px] font-black uppercase tracking-tighter text-slate-900">
                      {medicationMark.label || 'MARK'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEditEntry(entry)} className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEntryToDelete(entry.id)} className="p-2 bg-slate-100 rounded-lg text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <p className="text-[8px] text-natural-400 uppercase font-black mb-0.5">TSH</p>
                <p className="text-xs font-bold text-slate-900">{entry.tsh}</p>
                <p className="text-[7px] text-natural-300">({entry.tshRef[0]}-{entry.tshRef[1]})</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <p className="text-[8px] text-natural-400 uppercase font-black mb-0.5">fT4</p>
                <p className="text-xs font-bold text-slate-600">{entry.t4}</p>
                <p className="text-[7px] text-natural-300">({entry.t4Ref[0]}-{entry.t4Ref[1]})</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <p className="text-[8px] text-natural-400 uppercase font-black mb-0.5">fT3</p>
                <p className="text-xs font-bold text-emerald-600">{entry.t3}</p>
                <p className="text-[7px] text-natural-300">({entry.t3Ref[0]}-{entry.t3Ref[1]})</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <p className="text-[8px] text-natural-400 uppercase font-black mb-0.5">LT</p>
                <p className="text-xs font-bold">{entry.thyroxin || 0}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartSection({ chartRef, filteredEntries, spacing, globalRefs, medicationMarks }: { 
  chartRef: React.RefObject<HTMLDivElement | null>, 
  filteredEntries: ThyroidEntry[],
  spacing: number,
  globalRefs: any,
  medicationMarks: MedicationMark[]
}) {
  return (
    <div 
      ref={chartRef} 
      style={{ marginTop: `${spacing}mm` }}
      className="scroll-mt-4 print:overflow-visible print:mt-0"
    >
      <div className="p-2 mb-4 print:hidden">
          <h3 className="text-[10px] font-bold text-natural-400 uppercase tracking-[0.2em]">DIAGRAMME VERLAUF <span className="text-[10px] lowercase font-normal text-natural-300 ml-2 italic">/ Zum Navigieren wischen</span></h3>
      </div>
      <ThyroidChart data={filteredEntries} globalRefs={globalRefs} medicationMarks={medicationMarks} />
    </div>
  );
}
