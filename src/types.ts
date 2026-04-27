export interface ThyroidEntry {
  id: string;
  patientId: string;
  date: string; // ISO string
  tsh: number;
  tshRef: [number | null, number | null];
  t4: number;
  t4Ref: [number | null, number | null];
  t3: number;
  t3Ref: [number | null, number | null];
  trak: number;
  trakRef: [number | null, number | null];
  thyroxin?: number;
  pulse: number;
  isSurgery?: boolean;
  sonderanalysen?: string;
  medication?: {
    label: string;
    from?: string;
    to?: string;
  };
  isMarkedPeriod?: boolean;
  markLabel?: string;
  markFrom?: string;
  markTo?: string;
  markColor?: string;
  notes?: string;
  rowColor?: string;
  isRowMarked?: boolean;
  printBreakAfter?: boolean;
}

export interface MedicationMark {
  id: string;
  patientId: string;
  label: string;
  from: string;
  to: string;
  color: string;
  notes?: string;
}

export interface MedicationPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate?: string; // Optional if ongoing
}

export interface PatientInfo {
  id: string;
  name: string;
  birthDate: string;
  diagnosisDate: string;
}
