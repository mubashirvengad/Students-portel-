export interface SubjectConfig {
  id: string;
  name: string;
  maxMarks: number;
  passMarks: number;
  type?: 'Theory' | 'Practical' | 'Internal' | 'Other';
  examDate?: string;
  examTime?: string;
  classTime?: string; // e.g. "09:00 AM - 10:00 AM" for lectures
  room?: string;
  class?: string;
  day?: string; // e.g. "Monday", "Tuesday"
}

export interface StudentMarks {
  docId?: string; // Unique ID for the document (e.g. studentId_examType)
  id: string; // Student's Roll No / ID
  studentId?: string; // Extra field for explicit association if needed
  name: string;
  class: string;
  section?: string;
  examType?: string; // e.g. "Monthly Test", "Midterm", "Final Exam"
  marks: Record<string, number | 'A'>; // subjectId -> score or 'A' for Absent
  image?: string; // base64 string
  hallTicketAvailable?: boolean;
}

export interface CalculatedMarks extends StudentMarks {
  total: number;
  maxPossibleTotal: number;
  percentage: number;
  grade: string;
  result: 'Pass' | 'Fail';
}

export interface ExamNotification {
  id: string;
  title: string;
  content: string;
  date: string;
  important?: boolean;
  audience?: 'all' | 'students' | 'parents';
}
