export interface SubjectConfig {
  id: string;
  name: string;
  maxMarks: number;
  passMarks: number;
}

export interface StudentMarks {
  id: string;
  name: string;
  class: string;
  marks: Record<string, number>; // subjectId -> score
}

export interface CalculatedMarks extends StudentMarks {
  total: number;
  maxPossibleTotal: number;
  percentage: number;
  grade: string;
  result: 'Pass' | 'Fail';
}
