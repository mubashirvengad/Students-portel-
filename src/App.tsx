import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Download, GraduationCap, UserPlus, Calculator, FileText, LogIn, LogOut, User, Award, CheckCircle2, XCircle, Settings, BookOpen } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StudentMarks, CalculatedMarks, SubjectConfig } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SUBJECTS: SubjectConfig[] = [
  { id: '1', name: 'English', maxMarks: 100, passMarks: 35 },
  { id: '2', name: 'Maths', maxMarks: 100, passMarks: 35 },
  { id: '3', name: 'Science', maxMarks: 100, passMarks: 35 },
  { id: '4', name: 'Social', maxMarks: 100, passMarks: 35 },
  { id: '5', name: 'Computer', maxMarks: 100, passMarks: 35 },
];

export default function App() {
  const [view, setView] = useState<'landing' | 'admin' | 'portal-login' | 'student-portal' | 'settings' | 'admin-login' | 'admin-setup'>('landing');
  const [adminPassword, setAdminPassword] = useState<string>(() => localStorage.getItem('admin_password') || '');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminLoginInput, setAdminLoginInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');

  const [subjects, setSubjects] = useState<SubjectConfig[]>(DEFAULT_SUBJECTS);
  const [students, setStudents] = useState<StudentMarks[]>([]);
  const [newStudent, setNewStudent] = useState<StudentMarks>({ id: '', name: '', class: '', marks: {} });
  const [loginId, setLoginId] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loggedInStudent, setLoggedInStudent] = useState<CalculatedMarks | null>(null);
  const [loginError, setLoginError] = useState('');

  // Settings State
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectMax, setNewSubjectMax] = useState(100);
  const [newSubjectPass, setNewSubjectPass] = useState(35);

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const calculatedStudents: CalculatedMarks[] = useMemo(() => {
    return students.map((s) => {
      let total = 0;
      Object.keys(s.marks).forEach(key => {
        total += s.marks[key] || 0;
      });
      const maxPossibleTotal = subjects.reduce((acc: number, sub: SubjectConfig) => acc + sub.maxMarks, 0);
      const percentage = maxPossibleTotal > 0 ? (total / maxPossibleTotal) * 100 : 0;
      const grade = calculateGrade(percentage);
      
      // Pass if all subjects are >= their pass marks
      const result = subjects.every((sub) => {
        const score = s.marks[sub.id] || 0;
        return score >= sub.passMarks;
      }) ? 'Pass' : 'Fail';

      return { ...s, total, maxPossibleTotal, percentage, grade, result };
    });
  }, [students, subjects]);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.id || !newStudent.name) return;
    if (students.find(s => s.id === newStudent.id)) {
      alert("Student ID already exists!");
      return;
    }
    setStudents([...students, { ...newStudent }]);
    setNewStudent({ id: '', name: '', class: '', marks: {} });
  };

  const removeStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
  };

  const addSubject = () => {
    if (!newSubjectName) return;
    const newSub: SubjectConfig = {
      id: Date.now().toString(),
      name: newSubjectName,
      maxMarks: newSubjectMax,
      passMarks: newSubjectPass,
    };
    setSubjects([...subjects, newSub]);
    setNewSubjectName('');
    setNewSubjectMax(100);
    setNewSubjectPass(35);
  };

  const removeSubject = (id: string) => {
    if (subjects.length <= 1) {
      alert("At least one subject is required.");
      return;
    }
    setSubjects(subjects.filter(s => s.id !== id));
    // Also clean up student marks
    setStudents(students.map(s => {
      const newMarks = { ...s.marks };
      delete newMarks[id];
      return { ...s, marks: newMarks };
    }));
  };

  const handleAdminSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminLoginError('Passwords do not match!');
      return;
    }
    if (newAdminPassword.length < 4) {
      setAdminLoginError('Password must be at least 4 characters.');
      return;
    }
    localStorage.setItem('admin_password', newAdminPassword);
    setAdminPassword(newAdminPassword);
    setIsAdminLoggedIn(true);
    setAdminLoginError('');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLoginInput === adminPassword) {
      setIsAdminLoggedIn(true);
      setAdminLoginError('');
      setAdminLoginInput('');
    } else {
      setAdminLoginError('Incorrect password.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setView('landing');
  };

  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const student = calculatedStudents.find(
      (s) => s.id.toLowerCase() === loginId.toLowerCase() && s.name.toLowerCase() === loginName.toLowerCase()
    );

    if (student) {
      setLoggedInStudent(student);
      setView('student-portal');
      setLoginError('');
    } else {
      setLoginError('Invalid Student ID or Name. Please check and try again.');
    }
  };

  const handleLogout = () => {
    setLoggedInStudent(null);
    setLoginId('');
    setLoginName('');
    setView('landing');
  };

  const exportToPDF = (studentData?: CalculatedMarks) => {
    const doc = new jsPDF('landscape');
    const isSingle = !!studentData;
    const data = studentData ? [studentData] : calculatedStudents;
    
    doc.setFontSize(22);
    doc.setTextColor(0);
    doc.text('MANSHAU CAMPUS', 14, 15);
    
    doc.setFontSize(14);
    doc.text(isSingle ? `Report Card: ${studentData.name}` : 'Student Marks Sheet', 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 32);

    const head = [
      'ID', 
      'Name', 
      'Class',
      ...subjects.map(s => s.name), 
      'Total', 
      'Max', 
      '%', 
      'Grade', 
      'Result'
    ];

    const tableData = data.map((s) => [
      s.id,
      s.name,
      s.class,
      ...subjects.map(sub => s.marks[sub.id] || 0),
      s.total,
      s.maxPossibleTotal,
      s.percentage.toFixed(1),
      s.grade,
      s.result,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [head],
      body: tableData,
      headStyles: { fillColor: [20, 20, 20] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 40 },
    });

    doc.save(isSingle ? `report_${studentData.id}.pdf` : 'student_marks_sheet.pdf');
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2">MANSHAU CAMPUS</h1>
          <p className="text-gray-500 font-medium uppercase tracking-[0.3em] text-sm md:text-base">Academic Performance Portal</p>
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Admin Card */}
          <button
            onClick={() => setView('admin')}
            className="group bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 text-left hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <div className="inline-flex p-5 bg-black text-white rounded-[2rem] mb-8 group-hover:scale-110 transition-transform">
              <Settings size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4">Admin Dashboard</h2>
            <p className="text-gray-500 text-lg leading-relaxed">
              Manage students, configure subjects, set marks, and export comprehensive reports.
            </p>
            <div className="mt-8 flex items-center gap-2 text-black font-bold uppercase tracking-widest text-sm">
              Enter Dashboard <Award size={20} />
            </div>
          </button>

          {/* Student Card */}
          <button
            onClick={() => setView('portal-login')}
            className="group bg-black p-10 rounded-[3rem] shadow-2xl text-left hover:scale-[1.02] transition-all"
          >
            <div className="inline-flex p-5 bg-white text-black rounded-[2rem] mb-8 group-hover:scale-110 transition-transform">
              <User size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-white">Student Portal</h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Access your personalized report card, view subject-wise performance, and download results.
            </p>
            <div className="mt-8 flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
              View My Results <Award size={20} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  if ((view === 'admin' || view === 'settings') && !isAdminLoggedIn) {
    if (!adminPassword) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gray-100 rounded-3xl mb-4">
                <GraduationCap size={32} className="text-black" />
              </div>
              <h1 className="text-2xl font-bold">Admin Setup</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">MANSHAU CAMPUS</p>
            </div>

            <form onSubmit={handleAdminSetup} className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                />
              </div>

              {adminLoginError && (
                <p className="text-rose-500 text-xs font-medium text-center bg-rose-50 py-2 rounded-lg">{adminLoginError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/20"
              >
                Set Password & Enter
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-gray-100 rounded-3xl mb-4">
              <GraduationCap size={32} className="text-black" />
            </div>
            <h1 className="text-2xl font-bold">Admin Login</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">MANSHAU CAMPUS</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                required
                autoFocus
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                value={adminLoginInput}
                onChange={(e) => setAdminLoginInput(e.target.value)}
              />
            </div>

            {adminLoginError && (
              <p className="text-rose-500 text-xs font-medium text-center bg-rose-50 py-2 rounded-lg">{adminLoginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/20"
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => setView('landing')}
              className="w-full text-gray-400 text-sm font-medium hover:text-black transition-colors"
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-[#f5f5f5] p-4 md:p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView('admin')}
              className="flex items-center gap-2 text-gray-500 hover:text-black font-medium transition-colors"
            >
              <Settings size={20} />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold">Configuration</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Add Subject */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Plus size={24} className="text-gray-400" />
                Add Subject
              </h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Subject Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Physics"
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Max Marks</label>
                  <input
                    type="number"
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                    value={newSubjectMax}
                    onChange={(e) => setNewSubjectMax(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Pass Marks</label>
                  <input
                    type="number"
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                    value={newSubjectPass}
                    onChange={(e) => setNewSubjectPass(parseInt(e.target.value) || 0)}
                  />
                </div>
                <button
                  onClick={addSubject}
                  className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Add Subject
                </button>
              </div>
            </div>

            {/* Current Subjects */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BookOpen size={24} className="text-gray-400" />
                Current Subjects
              </h2>
              <div className="space-y-3">
                {subjects.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="font-bold">{sub.name}</p>
                      <div className="flex gap-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Max: {sub.maxMarks}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Pass: {sub.passMarks}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSubject(sub.id)}
                      className="p-2 text-gray-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Password Management */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 md:col-span-2">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Award size={24} className="text-gray-400" />
                Admin Password
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                  <input
                    type="password"
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
                  <input
                    type="password"
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    if (newAdminPassword !== confirmAdminPassword) {
                      alert('Passwords do not match!');
                      return;
                    }
                    if (newAdminPassword.length < 4) {
                      alert('Password must be at least 4 characters.');
                      return;
                    }
                    localStorage.setItem('admin_password', newAdminPassword);
                    setAdminPassword(newAdminPassword);
                    setNewAdminPassword('');
                    setConfirmAdminPassword('');
                    alert('Password updated successfully!');
                  }}
                  className="bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'portal-login') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-gray-100 rounded-3xl mb-4">
              <LogIn size={32} className="text-black" />
            </div>
            <h1 className="text-2xl font-bold">Student Portal</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">MANSHAU CAMPUS</p>
          </div>

          <form onSubmit={handlePortalLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student ID</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                placeholder="e.g. S101"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-black transition-all"
                placeholder="As registered in sheet"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
              />
            </div>

            {loginError && (
              <p className="text-rose-500 text-xs font-medium text-center bg-rose-50 py-2 rounded-lg">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/20"
            >
              Access My Portal
            </button>

            <button
              type="button"
              onClick={() => setView('landing')}
              className="w-full text-gray-400 text-sm font-medium hover:text-black transition-colors"
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'student-portal' && loggedInStudent) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-4 md:p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 hover:text-black font-medium transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
            <button
              onClick={() => exportToPDF(loggedInStudent)}
              className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-3 rounded-2xl font-semibold shadow-sm hover:bg-gray-50 transition-all"
            >
              <Download size={20} />
              Download Report
            </button>
          </div>

          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] ml-1 mb-2">MANSHAU CAMPUS</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                    <User size={32} />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight">{loggedInStudent.name}</h1>
                </div>
                <div className="flex flex-wrap gap-4 ml-1">
                  <p className="text-gray-400 font-mono text-lg">Student ID: {loggedInStudent.id}</p>
                  <p className="text-gray-400 font-mono text-lg">Class: {loggedInStudent.class}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Overall Result</p>
                <div className={cn(
                  "inline-flex items-center gap-2 px-6 py-2 rounded-full text-lg font-bold",
                  loggedInStudent.result === 'Pass' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {loggedInStudent.result === 'Pass' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                  {loggedInStudent.result.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-gray-50 p-6 rounded-3xl">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Total Marks</p>
                <p className="text-3xl font-bold">{loggedInStudent.total} <span className="text-sm text-gray-400 font-normal">/ {loggedInStudent.maxPossibleTotal}</span></p>
              </div>
              <div className="bg-gray-50 p-6 rounded-3xl">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Percentage</p>
                <p className="text-3xl font-bold">{loggedInStudent.percentage.toFixed(1)}%</p>
              </div>
              <div className="bg-black text-white p-6 rounded-3xl flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Grade</p>
                  <p className="text-4xl font-bold">{loggedInStudent.grade}</p>
                </div>
                <Award size={48} className="text-emerald-400 opacity-50" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Award size={24} className="text-gray-400" />
                Subject-wise Performance
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {subjects.map((sub) => {
                  const score = loggedInStudent.marks[sub.id] || 0;
                  const isPass = score >= sub.passMarks;
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                      <div>
                        <span className="text-lg font-medium block">{sub.name}</span>
                        <div className="flex gap-2">
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Max: {sub.maxMarks}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Pass: {sub.passMarks}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden hidden md:block">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              isPass ? "bg-emerald-500" : "bg-rose-500"
                            )}
                            style={{ width: `${(score / sub.maxMarks) * 100}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-2xl font-bold w-12 text-right",
                          isPass ? "text-black" : "text-rose-600"
                        )}>
                          {score}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-black text-white rounded-2xl">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">MANSHAU CAMPUS</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Academic Performance System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdminLogout}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-rose-600 transition-all shadow-sm"
              title="Logout Admin"
            >
              <LogOut size={24} />
            </button>
            <button
              onClick={() => setView('settings')}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-black transition-all shadow-sm"
              title="Configuration"
            >
              <Settings size={24} />
            </button>
            <button
              onClick={() => exportToPDF()}
              disabled={students.length === 0}
              className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-black/10 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              Export All
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Section */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <UserPlus size={20} className="text-gray-400" />
                <h2 className="text-lg font-bold">Add New Student</h2>
              </div>
              
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S101"
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black transition-all"
                    value={newStudent.id}
                    onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black transition-all"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Class</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10th Grade"
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black transition-all"
                    value={newStudent.class}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {subjects.map((sub) => (
                    <div key={sub.id} className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{sub.name}</label>
                      <input
                        type="number"
                        min="0"
                        max={sub.maxMarks}
                        required
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black transition-all"
                        value={newStudent.marks[sub.id] || ''}
                        onChange={(e) => setNewStudent({ 
                          ...newStudent, 
                          marks: { ...newStudent.marks, [sub.id]: parseInt(e.target.value) || 0 } 
                        })}
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Add to Sheet
                </button>
              </form>
            </div>

            {/* Stats Card */}
            <div className="bg-black text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Students</p>
                <h3 className="text-5xl font-light mb-4">{students.length}</h3>
                <div className="flex gap-4">
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Pass</p>
                    <p className="text-xl font-medium">{calculatedStudents.filter(s => s.result === 'Pass').length}</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Fail</p>
                    <p className="text-xl font-medium">{calculatedStudents.filter(s => s.result === 'Fail').length}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <Calculator size={160} />
              </div>
            </div>
          </aside>

          {/* Table Section */}
          <main className="lg:col-span-8">
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-bottom border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-gray-400" />
                  <h2 className="text-lg font-bold">Marklist Data</h2>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Class</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Marks</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Total</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">%</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Grade</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Result</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {calculatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">
                          No student records found. Add a student to begin.
                        </td>
                      </tr>
                    ) : (
                      calculatedStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs">{student.id}</td>
                          <td className="px-6 py-4 font-bold">{student.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{student.class}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {subjects.map(sub => (
                                <span key={sub.id} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded uppercase font-medium text-gray-500">
                                  {sub.name.slice(0, 3)}: {student.marks[sub.id] || 0}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold">{student.total} <span className="text-[10px] text-gray-400">/ {student.maxPossibleTotal}</span></td>
                          <td className="px-6 py-4 text-center text-gray-500">{student.percentage.toFixed(1)}%</td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold",
                              student.grade === 'A+' ? "bg-emerald-100 text-emerald-700" :
                              student.grade === 'A' ? "bg-blue-100 text-blue-700" :
                              student.grade === 'F' ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-700"
                            )}>
                              {student.grade}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-widest",
                              student.result === 'Pass' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {student.result}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeStudent(student.id)}
                              className="p-2 text-gray-300 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
