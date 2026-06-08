import { Toaster, toast } from 'sonner';
import React, { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend
} from 'recharts';
import { Plus, PlusCircle, Trash2, Download, GraduationCap, UserPlus, Calculator, FileText, LogIn, LogOut, User, Award, CheckCircle2, XCircle, Settings, BookOpen, Image as ImageIcon, AlertTriangle, ShieldCheck, Search, Pencil, X, Calendar, Check, Clock, Users, TrendingUp, CheckSquare, Square, Ticket, Sparkles, Sliders, Bell, Megaphone, Database, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StudentMarks, CalculatedMarks, SubjectConfig, ExamNotification } from './types';
import { PhotoAdjusterModal } from './components/PhotoAdjusterModal';
import { 
  checkSupabaseConnection, 
  fetchFromSupabase, 
  upsertToSupabase, 
  deleteFromSupabase, 
  SUPABASE_SQL_SETUP, 
  SUPABASE_URL, 
  SUPABASE_KEY 
} from './supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error('Database Error: ', errMessage, 'Op:', operationType, 'Path:', path);
  toast.error(`Database Error: ${errMessage}`);
}

const FIXED_CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '+1', '+2', 'Degree', 'PG'];
const FIXED_SECTIONS = ['A', 'B', 'C', 'D'];
const FIXED_EXAMS = ['Monthly Test', 'Midterm Exam', 'Final Exam', 'Unit Test 1', 'Unit Test 2'];
const FIXED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
}

export default function App() {
  const [view, setView] = useState<'landing' | 'admin' | 'portal-login' | 'student-portal' | 'admin-login' | 'attendance' | 'parent-portal'>('landing');
  const [portalType, setPortalType] = useState<'student' | 'parent'>('student');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminLoginInput, setAdminLoginInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('adminPassword') || '1234';
  });
  const [examCenter, setExamCenter] = useState<string>(() => {
    return localStorage.getItem('examCenter') || 'MANSHAU CAMPUS MAIN CENTER';
  });
  const [subjectTypes, setSubjectTypes] = useState<string[]>(() => {
    const local = localStorage.getItem('subjectTypes');
    return local ? JSON.parse(local) : ['Theory', 'Practical', 'Internal', 'Other'];
  });
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [subjects, setSubjects] = useState<SubjectConfig[]>(() => {
    const local = localStorage.getItem('subjects');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: '1', name: 'English', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Monday', classTime: '09:00 AM - 10:00 AM', examTime: '09:00 AM', room: '101' },
      { id: '2', name: 'Maths', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Tuesday', classTime: '10:00 AM - 11:00 AM', examTime: '10:30 AM', room: '102' },
      { id: '3', name: 'Science', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Wednesday', classTime: '11:15 AM - 12:15 PM', examTime: '01:00 PM', room: '103' },
      { id: '4', name: 'Social', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Thursday', classTime: '12:15 PM - 01:15 PM', examTime: '02:30 PM', room: '104' },
      { id: '5', name: 'Computer', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Friday', classTime: '02:00 PM - 03:00 PM', examTime: '04:00 PM', room: 'Lab 1' },
    ];
  });
  const [students, setStudents] = useState<StudentMarks[]>(() => {
    const local = localStorage.getItem('students');
    return local ? JSON.parse(local) : [];
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const local = localStorage.getItem('attendance');
    return local ? JSON.parse(local) : [];
  });
  const [notifications, setNotifications] = useState<ExamNotification[]>(() => {
    const local = localStorage.getItem('notifications');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'notif-1',
        title: 'Welcome to Exam Student Portal',
        content: 'All upcoming midterm schedule records and hall ticket release status updates will be published here.',
        date: '2026-06-04',
        important: true,
        audience: 'all'
      }
    ];
  });
  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifContent, setNewNotifContent] = useState('');
  const [newNotifImportant, setNewNotifImportant] = useState(false);
  const [newNotifAudience, setNewNotifAudience] = useState<'all' | 'students' | 'parents'>('all');
  const [editingNotification, setEditingNotification] = useState<ExamNotification | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceClass, setAttendanceClass] = useState(FIXED_CLASSES[0]);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [newStudent, setNewStudent] = useState<StudentMarks>({ 
    id: '', 
    name: '', 
    class: FIXED_CLASSES[0], 
    section: FIXED_SECTIONS[0],
    examType: FIXED_EXAMS[0],
    marks: {},
    image: undefined
  });
  const [classFilter, setClassFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [notifSearch, setNotifSearch] = useState('');
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginName, setLoginName] = useState('');
  const [showIdSuggestions, setShowIdSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [loggedInStudent, setLoggedInStudent] = useState<CalculatedMarks | null>(null);
  const [loginError, setLoginError] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentMarks | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [studentPortalTab, setStudentPortalTab] = useState<'marks' | 'attendance' | 'hall-ticket' | 'notifications' | 'timetable'>('marks');
  const [portalNotifFilter, setPortalNotifFilter] = useState<'all' | 'mine' | 'students' | 'parents'>('mine');
  const [adminTab, setAdminTab] = useState<'results' | 'students' | 'subjects' | 'settings' | 'hall-tickets' | 'notifications' | 'timetable'>('results');
  const [adminTimetableClassFilter, setAdminTimetableClassFilter] = useState('All');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  
  // Photo Adjustment state
  const [photoAdjustSrc, setPhotoAdjustSrc] = useState<string | null>(null);
  const [onPhotoAdjustSave, setOnPhotoAdjustSave] = useState<((adjusted: string) => void) | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, onSave: (adjusted: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoAdjustSrc(reader.result as string);
        setOnPhotoAdjustSave(() => onSave);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Results Entry State
  const [resultSearchId, setResultSearchId] = useState('');
  const [foundStudentProfile, setFoundStudentProfile] = useState<StudentMarks | null>(null);
  const [resultMarks, setResultMarks] = useState<{ [key: string]: number | 'A' }>({});
  const [resultExamType, setResultExamType] = useState(FIXED_EXAMS[0]);
  const [isUpdatingResults, setIsUpdatingResults] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showSubjectConfigPanel, setShowSubjectConfigPanel] = useState(false);

  // Supabase Sync States
  const [supabaseStatus, setSupabaseStatus] = useState<{
    isConnected: boolean;
    checkedAt: string;
    error: string | null;
    tablesVerified: {
      students: boolean;
      subjects: boolean;
      attendance: boolean;
      notifications: boolean;
      settings: boolean;
    };
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncFromSupabase = async (showSuccessToast = false) => {
    setIsSyncing(true);
    try {
      const conn = await checkSupabaseConnection();
      setSupabaseStatus(conn);

      if (!conn.isConnected) {
        console.warn("Supabase is offline or tables not initialized. Falling back safely to Local Offline DB.");
        if (showSuccessToast) {
          toast.error("Could not sync with Supabase tables. Please make sure the SQL setup is executed in the Supabase Dashboard!");
        }
        return;
      }

      // Sync and loader helper
      const loadTable = async (table: string, setter: (val: any) => void, localKey: string) => {
        try {
          const remoteRows = await fetchFromSupabase<any>(table);
          if (remoteRows && Array.isArray(remoteRows)) {
            if (table === 'settings') {
              const adminConf = remoteRows.find(s => s.id === 'admin');
              if (adminConf) {
                if (adminConf.adminPassword !== undefined) {
                  setAdminPassword(adminConf.adminPassword);
                  localStorage.setItem('adminPassword', adminConf.adminPassword);
                }
                if (adminConf.examCenter !== undefined) {
                  setExamCenter(adminConf.examCenter);
                  localStorage.setItem('examCenter', adminConf.examCenter);
                }
                if (adminConf.subjectTypes !== undefined) {
                  setSubjectTypes(adminConf.subjectTypes);
                  localStorage.setItem('subjectTypes', JSON.stringify(adminConf.subjectTypes));
                }
              }
            } else {
              // Convert fields appropriately if needed
              setter(remoteRows);
              localStorage.setItem(localKey, JSON.stringify(remoteRows));
            }
          }
        } catch (e: any) {
          console.error(`Error loading table ${table} from Supabase during sync:`, e.message || e);
        }
      };

      if (conn.tablesVerified.students) {
        await loadTable('students', setStudents, 'students');
      }
      if (conn.tablesVerified.subjects) {
        await loadTable('subjects', setSubjects, 'subjects');
      }
      if (conn.tablesVerified.attendance) {
        await loadTable('attendance', setAttendanceRecords, 'attendance');
      }
      if (conn.tablesVerified.notifications) {
        await loadTable('notifications', setNotifications, 'notifications');
      }
      if (conn.tablesVerified.settings) {
        await loadTable('settings', () => {}, 'settings');
      }

      if (showSuccessToast) {
        toast.success("Synchronized data with Supabase successfully!");
      }
    } catch (err: any) {
      console.error("Supabase general sync error:", err);
      if (showSuccessToast) {
        toast.error(`Sync error: ${err.message || err}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Perform initial load-sync on mount
  useEffect(() => {
    syncFromSupabase(false);
  }, []);

  // Hybrid Local DB + Supabase-backed Persistence Helpers
  const dbSave = async (collectionName: string, id: string, data: any, merge = false) => {
    try {
      // 1. Instantly write to LocalStorage & update React memory state
      if (collectionName === 'students') {
        setStudents(prev => {
          const index = prev.findIndex(s => s.id === id || s.docId === id);
          let updated;
          if (index > -1) {
            updated = prev.map((s, idx) => idx === index ? (merge ? { ...s, ...data } : data) : s);
          } else {
            updated = [...prev, data];
          }
          localStorage.setItem('students', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'subjects') {
        setSubjects(prev => {
          const index = prev.findIndex(s => s.id === id);
          let updated;
          if (index > -1) {
            updated = prev.map((s, idx) => idx === index ? (merge ? { ...s, ...data } : data) : s);
          } else {
            updated = [...prev, data];
          }
          localStorage.setItem('subjects', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'attendance') {
        setAttendanceRecords(prev => {
          const index = prev.findIndex(a => a.id === id);
          let updated;
          if (index > -1) {
            updated = prev.map((a, idx) => idx === index ? (merge ? { ...a, ...data } : data) : a);
          } else {
            updated = [...prev, data];
          }
          localStorage.setItem('attendance', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'notifications') {
        setNotifications(prev => {
          const index = prev.findIndex(n => n.id === id);
          let updated;
          if (index > -1) {
            updated = prev.map((n, idx) => idx === index ? (merge ? { ...n, ...data } : data) : n);
          } else {
            updated = [...prev, data];
          }
          localStorage.setItem('notifications', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'settings') {
        if (data.adminPassword !== undefined) {
          setAdminPassword(data.adminPassword);
          localStorage.setItem('adminPassword', data.adminPassword);
        }
        if (data.examCenter !== undefined) {
          setExamCenter(data.examCenter);
          localStorage.setItem('examCenter', data.examCenter);
        }
        if (data.subjectTypes !== undefined) {
          setSubjectTypes(data.subjectTypes);
          localStorage.setItem('subjectTypes', JSON.stringify(data.subjectTypes));
        }
      }

      // 2. Perform optimistic/background write to Supabase
      let payload = data;
      if (collectionName === 'settings') {
        payload = {
          id: 'admin',
          adminPassword: data.adminPassword !== undefined ? data.adminPassword : adminPassword,
          examCenter: data.examCenter !== undefined ? data.examCenter : examCenter,
          subjectTypes: data.subjectTypes !== undefined ? data.subjectTypes : subjectTypes
        };
      } else if (collectionName === 'students') {
        payload = {
          docId: id,
          id: data.id || id,
          studentId: data.studentId || null,
          name: data.name || '',
          class: data.class || '',
          section: data.section || null,
          examType: data.examType || null,
          marks: data.marks || {},
          image: data.image || null,
          hallTicketAvailable: data.hallTicketAvailable !== undefined ? data.hallTicketAvailable : false
        };
      } else if (collectionName === 'subjects') {
        payload = {
          id,
          name: data.name || '',
          maxMarks: data.maxMarks !== undefined ? Number(data.maxMarks) : 100,
          passMarks: data.passMarks !== undefined ? Number(data.passMarks) : 35,
          type: data.type || null,
          examDate: data.examDate || null,
          examTime: data.examTime || null,
          room: data.room || null,
          class: data.class || null,
          day: data.day || 'Monday',
          classTime: data.classTime || null
        };
      } else if (collectionName === 'notifications') {
        payload = {
          id,
          title: data.title || '',
          content: data.content || '',
          date: data.date || '',
          important: data.important !== undefined ? data.important : false,
          audience: data.audience || 'all'
        };
      } else if (collectionName === 'attendance') {
        payload = {
          id,
          studentId: data.studentId || '',
          studentName: data.studentName || '',
          studentClass: data.studentClass || '',
          date: data.date || '',
          status: data.status || ''
        };
      }

      // Spawn background upload
      upsertToSupabase(collectionName, collectionName === 'students' ? 'docId' : 'id', payload)
        .then(() => {
          console.log(`[Supabase Background Sync] Success for ${collectionName}: ${id}`);
        })
        .catch(err => {
          console.warn(`[Supabase Background Sync] Skipped/Offline for ${collectionName}:`, err.message || err);
        });

    } catch (error) {
      console.error('Error saving data to local storage:', error);
      toast.error('Local Storage Save Error');
    }
  };

  const dbUpdate = async (collectionName: string, id: string, data: any) => {
    await dbSave(collectionName, id, data, true);
  };

  const dbDelete = async (collectionName: string, id: string) => {
    try {
      if (collectionName === 'students') {
        setStudents(prev => {
          const updated = prev.filter(s => s.id !== id && s.docId !== id);
          localStorage.setItem('students', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'subjects') {
        setSubjects(prev => {
          const updated = prev.filter(s => s.id !== id);
          localStorage.setItem('subjects', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'attendance') {
        setAttendanceRecords(prev => {
          const updated = prev.filter(a => a.id !== id);
          localStorage.setItem('attendance', JSON.stringify(updated));
          return updated;
        });
      } else if (collectionName === 'notifications') {
        setNotifications(prev => {
          const updated = prev.filter(n => n.id !== id);
          localStorage.setItem('notifications', JSON.stringify(updated));
          return updated;
        });
      }

      // Synchronize deletion in background
      deleteFromSupabase(collectionName, collectionName === 'students' ? 'docId' : 'id', id)
        .then(() => {
          console.log(`[Supabase Background Sync] Delete Success for ${collectionName}: ${id}`);
        })
        .catch(err => {
          console.warn(`[Supabase Background Sync] Delete Skipped/Offline for ${collectionName}:`, err.message || err);
        });

    } catch (error) {
      console.error('Error deleting data from local storage:', error);
      toast.error('Local Storage Delete Error');
    }
  };

  const markAttendance = async (studentId: string, studentName: string, studentClass: string, status: AttendanceRecord['status']) => {
    const id = `${studentId}_${attendanceDate}`;
    const record: AttendanceRecord = {
      id,
      studentId,
      studentName,
      class: studentClass,
      date: attendanceDate,
      status
    };
    const path = `attendance/${id}`;
    try {
      await dbSave('attendance', id, record);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(r => r.studentId === studentId && r.date === attendanceDate);
    return record?.status;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhotoFileChange(e, (adjusted) => {
      setNewStudent(prev => ({ ...prev, image: adjusted }));
    });
  };

  // Settings State
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectMax, setNewSubjectMax] = useState(100);
  const [newSubjectPass, setNewSubjectPass] = useState(35);
  const [newSubjectType, setNewSubjectType] = useState('Theory');
  const [newSubjectDate, setNewSubjectDate] = useState('');
  const [newSubjectTime, setNewSubjectTime] = useState('');
  const [newSubjectDay, setNewSubjectDay] = useState('Monday');
  const [newSubjectRoom, setNewSubjectRoom] = useState('');
  const [newSubjectClass, setNewSubjectClass] = useState('All');
  const [newTypeInput, setNewTypeInput] = useState('');
  const [showAddTimeTableForm, setShowAddTimeTableForm] = useState(false);

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const allCalculatedStudents: CalculatedMarks[] = useMemo(() => {
    return students.map((s) => {
      let total = 0;
      let maxPossibleTotal = 0;
      const marks = s.marks || {};
      
      // Only include subjects that belong to the student's class and have a mark (number or 'A')
      const studentSubjects = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === s.class);
      studentSubjects.forEach((sub) => {
        const score = marks[sub.id];
        if (score !== undefined) {
          total += (typeof score === 'number' ? score : 0);
          maxPossibleTotal += sub.maxMarks;
        }
      });

      const percentage = maxPossibleTotal > 0 ? (total / maxPossibleTotal) * 100 : 0;
      const grade = calculateGrade(percentage);
      
      // Pass if all INCLUDED subjects are >= their pass marks AND not absent
      const includedSubjects = studentSubjects.filter(sub => marks[sub.id] !== undefined);
      const result = includedSubjects.length > 0 && includedSubjects.every((sub) => {
        const score = marks[sub.id];
        if (score === 'A') return false;
        return (score || 0) >= sub.passMarks;
      }) ? 'Pass' : (includedSubjects.length === 0 ? 'N/A' : 'Fail');

      return { ...s, total, maxPossibleTotal, percentage, grade, result };
    });
  }, [students, subjects]);

  const filteredStudents = useMemo(() => {
    let filtered = allCalculatedStudents;
    if (classFilter !== 'All') {
      filtered = filtered.filter(s => s.class === classFilter);
    }
    if (searchTerm) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'id'],
        threshold: 0.3,
        distance: 100,
      });
      filtered = fuse.search(searchTerm).map(result => result.item);
    }
    return filtered;
  }, [allCalculatedStudents, classFilter, searchTerm]);

  const uniqueStudentsList = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string; class: string }[] = [];
    students.forEach(s => {
      const key = (s.id || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: s.id,
          name: s.name,
          class: s.class || 'N/A'
        });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const filteredIdSuggestions = useMemo(() => {
    const query = loginId.trim().toLowerCase();
    if (!query) return [];
    return uniqueStudentsList.filter(s => 
      s.id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [loginId, uniqueStudentsList]);

  const filteredNameSuggestions = useMemo(() => {
    const query = loginName.trim().toLowerCase();
    if (!query) return [];
    return uniqueStudentsList.filter(s => 
      s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [loginName, uniqueStudentsList]);

  const uniqueRegistryStudents = useMemo(() => {
    const uniqueIds = Array.from(new Set(students.map(s => s.id)));
    const uniqueList = uniqueIds.map(id => students.find(s => s.id === id)!);
    
    if (!searchTerm) return uniqueList;
    
    const fuse = new Fuse(uniqueList, {
      keys: ['name', 'id', 'class'],
      threshold: 0.3
    });
    return fuse.search(searchTerm).map(r => r.item);
  }, [students, searchTerm]);

  const handleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(uniqueRegistryStudents.map(s => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const classDistribution = useMemo(() => {
    const dist: { [key: string]: number } = {};
    students.forEach(s => {
      const className = s.class || 'Unassigned';
      dist[className] = (dist[className] || 0) + 1;
    });
    return dist;
  }, [students]);

  const filteredAttendanceStudents = useMemo(() => {
    let filtered = students.filter(s => s.class === attendanceClass);
    if (attendanceSearch) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'id'],
        threshold: 0.3,
        distance: 100,
      });
      filtered = fuse.search(attendanceSearch).map(result => result.item);
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [students, attendanceClass, attendanceSearch]);

  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    // Sort so important notifications are always on top, and then by id or date descending
    const sorted = [...notifications].sort((a, b) => {
      if (a.important && !b.important) return -1;
      if (!a.important && b.important) return 1;
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
    if (!notifSearch) return sorted;
    const term = notifSearch.toLowerCase();
    return sorted.filter(n => n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term));
  }, [notifications, notifSearch]);

  const frontPageNotifications = useMemo(() => {
    return filteredNotifications.filter(n => n.audience !== 'parents');
  }, [filteredNotifications]);

  const generateNextStudentId = () => {
    // Find all IDs that match S followed by numbers
    const idNumbers = students
      .map(s => {
        const match = s.id.match(/^S(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const nextNum = idNumbers.length > 0 ? Math.max(...idNumbers) + 1 : 101;
    setNewStudent({ ...newStudent, id: `S${nextNum}` });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.id || !newStudent.name) return;
    
    // For general registration, we use the ID as the docId (Profile record)
    const docId = newStudent.id;
    
    if (students.find(s => s.docId === docId)) {
      toast.error("A student with this ID is already registered!");
      return;
    }
    setIsAddingStudent(true);
    const path = `students/${docId}`;
    try {
      // Create a profile record (empty marks, generic examType)
      await dbSave('students', docId, { 
        ...newStudent, 
        docId,
        examType: newStudent.examType || 'REGISTRATION',
        marks: {},
        hallTicketAvailable: false,
        image: newStudent.image || null
      });
      setNewStudent({ 
        id: '', 
        name: '', 
        class: FIXED_CLASSES[0], 
        section: FIXED_SECTIONS[0],
        examType: FIXED_EXAMS[0],
        marks: {},
        image: undefined
      });
      toast.success("Student registered successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsAddingStudent(false);
    }
  };

  const removeStudent = (id: string) => {
    setStudentToDelete(id);
  };

  const confirmDeleteStudent = async () => {
    if (studentToDelete) {
      const path = `students/${studentToDelete}`;
      try {
        const target = students.find(s => s.docId === studentToDelete || s.id === studentToDelete);
        if (target && target.examType === 'REGISTRATION') {
          // Cascade delete all records belonging to this student ID
          const affiliates = students.filter(s => s.id === target.id);
          for (const s of affiliates) {
            if (s.docId) {
              await dbDelete('students', s.docId);
            }
          }
        } else {
          // Just delete this specific exam/result record
          await dbDelete('students', studentToDelete);
        }
        setStudentToDelete(null);
        toast.success(target && target.examType !== 'REGISTRATION' ? "Exam result removed successfully!" : "Student profile and exam records deleted successfully!");
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const handleClearAllStudentData = async () => {
    setIsClearingAll(true);
    try {
      const deleteStudentPromises = students.map((s) => {
        const idToDelete = s.docId || s.id;
        if (idToDelete) {
          return dbDelete('students', idToDelete);
        }
        return Promise.resolve();
      });

      const deleteAttendancePromises = attendanceRecords.map((a) => {
        if (a.id) {
          return dbDelete('attendance', a.id);
        }
        return Promise.resolve();
      });

      await Promise.all([...deleteStudentPromises, ...deleteAttendancePromises]);

      setStudents([]);
      setAttendanceRecords([]);
      
      toast.success("All student records and attendance data have been removed.");
      setShowClearAllModal(false);
    } catch (error) {
      console.error("Error clearing student data:", error);
      toast.error("Failed to remove some student data or attendance records.");
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleRecordResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundStudentProfile) {
      toast.error("Please search and find a student first!");
      return;
    }

    const docId = `${foundStudentProfile.id}_${resultExamType.replace(/\s+/g, '_')}`;
    
    // Check if result already exists
    if (students.find(s => s.docId === docId)) {
      toast.error("This exam result already exists for this student!");
      return;
    }

    setIsUpdatingResults(true);
    const path = `students/${docId}`;
    try {
      const resultData: any = {
        ...foundStudentProfile,
        studentId: foundStudentProfile.id,
        examType: resultExamType,
        marks: resultMarks,
        docId,
        image: foundStudentProfile.image || null
      };
      
      await dbSave('students', docId, resultData);
      
      // Reset
      setResultSearchId('');
      setFoundStudentProfile(null);
      setResultMarks({});
      toast.success("Exam results recorded successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsUpdatingResults(false);
    }
  };

  const findStudentById = () => {
    if (!resultSearchId) return;
    
    // Use fuzzy search even for lookup to help with typos
    const fuse = new Fuse<StudentMarks>(students, {
      keys: ['id', 'name'],
      threshold: 0.3,
    });
    
    const results = fuse.search(resultSearchId);
    
    if (results.length > 0) {
      const student = results[0].item;
      setFoundStudentProfile({
        id: student.id,
        name: student.name,
        class: student.class,
        section: student.section,
        image: student.image || null,
        examType: FIXED_EXAMS[0],
        marks: {}
      });
      toast.success(`Found student: ${student.name}`);
    } else {
      setFoundStudentProfile(null);
      toast.error("No student found matching this ID! Ensure they are registered.");
    }
  };

  const toggleHallTicket = async (studentId: string, currentStatus: boolean) => {
    // Find all records for this student (registration and exam records)
    const recordsToUpdate = students.filter(s => s.id === studentId);
    
    try {
      const promises = recordsToUpdate.map(record => {
        if (!record.docId) return Promise.resolve();
        return dbUpdate('students', record.docId, {
          hallTicketAvailable: !currentStatus
        });
      });
      
      await Promise.all(promises);
      toast.success(currentStatus ? "Hall Ticket Revoked" : "Hall Ticket Issued");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const bulkToggleHallTicket = async (issue: boolean) => {
    if (selectedStudentIds.length === 0) return;
    
    const toastId = toast.loading(`${issue ? 'Issuing' : 'Revoking'} ${selectedStudentIds.length} Hall Tickets...`);
    try {
      const promises = selectedStudentIds.flatMap(id => {
        const studentRecords = students.filter(s => s.id === id);
        return studentRecords.map(record => {
          if (!record.docId) return Promise.resolve();
          return dbUpdate('students', record.docId, {
            hallTicketAvailable: issue
          });
        });
      });
      
      await Promise.all(promises);
      toast.success(`${selectedStudentIds.length} Hall Tickets ${issue ? 'Issued' : 'Revoked'}`, { id: toastId });
      setSelectedStudentIds([]);
    } catch (error) {
      toast.error("Failed to update Hall Tickets", { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `students/bulk`);
    }
  };

  const bulkDownloadHallTickets = () => {
    if (selectedStudentIds.length === 0) return;
    
    const studentsToDownload = uniqueRegistryStudents
      .filter(s => selectedStudentIds.includes(s.id) && s.hallTicketAvailable);
      
    if (studentsToDownload.length === 0) {
      toast.error("No issued hall tickets found in selection");
      return;
    }
    
    studentsToDownload.forEach(s => generateHallTicket(s as any));
    toast.success(`Downloading ${studentsToDownload.length} Hall Tickets`);
    setSelectedStudentIds([]);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.docId) return;
    setIsUpdatingStudent(true);
    const path = `students/${editingStudent.docId}`;
    try {
      const updateData = { ...editingStudent };
      // Firestore does not allow undefined values
      Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);
      
      await dbUpdate('students', editingStudent.docId, updateData);
      setEditingStudent(null);
      toast.success("Student updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const addSubject = async () => {
    if (!newSubjectName) return;
    const id = newSubjectName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);
    const newSub: SubjectConfig = {
      id,
      name: newSubjectName,
      maxMarks: newSubjectMax,
      passMarks: newSubjectPass,
      type: newSubjectType as any,
      classTime: newSubjectTime,
      room: newSubjectRoom,
      class: newSubjectClass,
      day: newSubjectDay,
    };
    const path = `subjects/${id}`;
    try {
      await dbSave('subjects', id, newSub);
      setNewSubjectName('');
      setNewSubjectMax(100);
      setNewSubjectPass(35);
      setNewSubjectType('Theory');
      setNewSubjectDate('');
      setNewSubjectTime('');
      setNewSubjectDay('Monday');
      setNewSubjectRoom('');
      setNewSubjectClass('All');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const removeSubject = async (id: string) => {
    if (subjects.length <= 1) {
      toast.error("At least one subject is required.");
      return;
    }
    const path = `subjects/${id}`;
    try {
      await dbDelete('subjects', id);
      // Cleanup student marks in Firestore - this is complex, but we'll do it for each student
      for (const student of students) {
        if (student.marks[id] && student.docId) {
          const newMarks = { ...student.marks };
          delete newMarks[id];
          await dbUpdate('students', student.docId, { marks: newMarks });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateSubject = async (id: string, updates: Partial<SubjectConfig>) => {
    const path = `subjects/${id}`;
    try {
      await dbUpdate('subjects', id, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotifTitle || !newNotifContent) {
      toast.error('Title and content are required.');
      return;
    }
    const id = editingNotification ? editingNotification.id : 'notif-' + Date.now().toString();
    const payload: ExamNotification = {
      id,
      title: newNotifTitle,
      content: newNotifContent,
      date: editingNotification ? editingNotification.date : new Date().toISOString().split('T')[0],
      important: newNotifImportant,
      audience: newNotifAudience
    };

    try {
      await dbSave('notifications', id, payload);
      toast.success(editingNotification ? 'Notification updated!' : 'Notification published!');
      setNewNotifTitle('');
      setNewNotifContent('');
      setNewNotifImportant(false);
      setNewNotifAudience('all');
      setEditingNotification(null);
    } catch (error) {
      console.error('Error saving notification:', error);
      toast.error('Failed to save notification.');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await dbDelete('notifications', id);
      toast.success('Notification deleted!');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification.');
    }
  };

  const handleEditNotificationSelect = (notif: ExamNotification) => {
    setEditingNotification(notif);
    setNewNotifTitle(notif.title);
    setNewNotifContent(notif.content);
    setNewNotifImportant(!!notif.important);
    setNewNotifAudience(notif.audience || 'all');
  };
  
  const handleCancelEditNotification = () => {
    setEditingNotification(null);
    setNewNotifTitle('');
    setNewNotifContent('');
    setNewNotifImportant(false);
    setNewNotifAudience('all');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLoginInput === adminPassword) {
      setIsAdminLoggedIn(true);
      setAdminLoginError('');
      setAdminLoginInput('');
      toast.success("Admin Session Started");
    } else {
      setAdminLoginError('Incorrect password.');
    }
  };

  const updateSettings = async (updates: any) => {
    const path = 'settings/admin';
    try {
      // Use dbSave with merge for settings to ensure doc exists
      await dbSave('settings', 'admin', updates, true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput) return;
    setIsChangingPassword(true);
    try {
      await updateSettings({ adminPassword: newPasswordInput });
      setNewPasswordInput('');
      toast.success("Admin password updated successfully!");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const addSubjectType = async () => {
    if (!newTypeInput.trim()) return;
    if (subjectTypes.includes(newTypeInput.trim())) {
      toast.error("Type already exists!");
      return;
    }
    const newList = [...subjectTypes, newTypeInput.trim()];
    await updateSettings({ subjectTypes: newList });
    setNewTypeInput('');
    toast.success("Subject type added!");
  };

  const removeSubjectType = async (typeToRemove: string) => {
    if (subjectTypes.length <= 1) {
      toast.error("At least one type is required.");
      return;
    }
    const newList = subjectTypes.filter(t => t !== typeToRemove);
    await updateSettings({ subjectTypes: newList });
    toast.success("Subject type removed!");
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setView('landing');
  };

  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginId.trim().toLowerCase();
    const cleanName = loginName.trim().toLowerCase();
    const results = allCalculatedStudents.filter(
      (s) => (s.id || '').trim().toLowerCase() === cleanId && (s.name || '').trim().toLowerCase() === cleanName
    );

    if (results.length > 0) {
      // Sort results: Registration records last, then by percentage/exam type
      const sortedResults = [...results].sort((a, b) => {
        if (a.examType === 'REGISTRATION') return 1;
        if (b.examType === 'REGISTRATION') return -1;
        // If both are exams, show the one with more marks/better performance first
        return (b.percentage || 0) - (a.percentage || 0);
      });
      
      setLoggedInStudent(sortedResults[0]);
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

  const exportTimeTable = (studentData: CalculatedMarks) => {
    const doc = new jsPDF('landscape');
    
    // Draw header
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 297, 45, 'F');
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.line(14, 10, 14, 35);
    doc.line(14, 10, 25, 10);
    doc.line(14, 22.5, 20, 22.5);
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('MANSHAU', 30, 24);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text('CAMPUS ACADEMIC SYSTEM', 30, 32);
    
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('CLASS TIME TABLE', 283, 25, { align: 'right' });

    // Student Info
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(14, 55, 269, 25, 2, 2, 'FD');

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text((studentData.name || '').toUpperCase(), 20, 68);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`ID: ${studentData.id}  |  CLASS: ${studentData.class}`, 20, 75);

    // Timetable List
    const studentSubjects = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === studentData.class);
    
    const DAY_ORDER: Record<string, number> = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };
    
    const sortedSubjects = [...studentSubjects].sort((a, b) => {
      const orderA = DAY_ORDER[a.day || 'Monday'] || 99;
      const orderB = DAY_ORDER[b.day || 'Monday'] || 99;
      return orderA - orderB;
    });

    const head = [['DAY', 'SUBJECT', 'TYPE', 'TIME LOT/SLOT', 'ROOM']];
    const body = sortedSubjects.map(sub => [
      (sub.day || 'Monday').toUpperCase(),
      sub.name.toUpperCase(),
      (sub.type || 'Theory').toUpperCase(),
      sub.classTime || 'TBA',
      sub.room || 'TBA'
    ]);

    autoTable(doc, {
      startY: 90,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { fontStyle: 'bold', cellWidth: 90 },
        2: { cellWidth: 40 },
        3: { cellWidth: 50 },
        4: { cellWidth: 35 }
      }
    });

    // Signatures / footer
    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    doc.setDrawColor(200, 200, 200);
    doc.line(200, finalY + 25, 270, finalY + 25);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Authorized Signature', 235, finalY + 30, { align: 'center' });
    doc.text('Principal / Registrar', 235, finalY + 35, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Verification ID: ${Math.random().toString(36).substring(2, 10).toUpperCase()}`, 14, 196);
    doc.text(`© ${new Date().getFullYear()} Manshau Campus`, 283, 196, { align: 'right' });

    doc.save(`TimeTable_${studentData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToPDF = (studentData?: CalculatedMarks) => {
    const doc = new jsPDF('landscape');
    const isSingle = !!studentData && typeof studentData === 'object' && 'id' in studentData;
    
    // Helper for drawing header
    const drawHeader = (title: string) => {
      // Background header bar
      doc.setFillColor(20, 20, 20);
      doc.rect(0, 0, 297, 45, 'F');
      
      // Stylized Logo (Geometric)
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1);
      doc.line(14, 10, 14, 35); // Vertical line
      doc.line(14, 10, 25, 10); // Top horizontal
      doc.line(14, 22.5, 20, 22.5); // Middle horizontal
      
      // Logo text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('MANSHAU', 30, 24);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(180, 180, 180);
      doc.text('CAMPUS ACADEMIC SYSTEM', 30, 32);
      
      // Report Title
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 283, 25, { align: 'right' });
      
      // Watermark
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.03 }));
      doc.setFontSize(100);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('OFFICIAL', 148, 120, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    };

    // Helper for drawing footer
    const drawFooter = () => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.5);
        doc.line(14, 190, 283, 190);

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, 148, 196, { align: 'center' });
        doc.text(`Verification ID: ${Math.random().toString(36).substring(2, 10).toUpperCase()}`, 14, 196);
        doc.text(`© ${new Date().getFullYear()} Manshau Campus`, 283, 196, { align: 'right' });
      }
    };

    const drawSignature = (y: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(200, y, 270, y);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Authorized Signature', 235, y + 5, { align: 'center' });
      doc.text('Principal / Registrar', 235, y + 10, { align: 'center' });
    };

    if (isSingle && studentData) {
      drawHeader('STUDENT PERFORMANCE REPORT');
      
      // Student Info Section
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(14, 55, 269, 40, 2, 2, 'FD');
      
      // Student Photo if exists
      if (studentData.image) {
        try {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(200, 200, 200);
          doc.roundedRect(20, 58, 34, 34, 1, 1, 'FD');
          doc.addImage(studentData.image, 'JPEG', 21, 59, 32, 32);
        } catch (e) {
          console.error("Could not add image to PDF", e);
        }
      }

      const infoX = studentData.image ? 65 : 25;
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text((studentData.name || '').toUpperCase(), infoX, 72);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`ID: ${studentData.id}  |  CLASS: ${studentData.class}  |  SECTION: ${studentData.section || '-'}`, infoX, 80);
      
      // Summary Stats in Info Section
      const statsX = 220;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text('FINAL ASSESSMENT', statsX, 68);
      
      doc.setFontSize(32);
      const resultColor = studentData.result === 'Pass' ? [16, 185, 129] : [244, 63, 94];
      doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
      doc.text(studentData.grade, statsX, 85);
      
      doc.setFontSize(10);
      doc.text((studentData.result || '').toUpperCase(), statsX + 20, 85);
      
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${studentData.percentage.toFixed(1)}% Score`, statsX, 91);

      const includedSubjects = subjects.filter(sub => (studentData.marks || {})[sub.id] !== undefined);
      const head = [['SUBJECT NAME', 'MAX', 'PASS', 'OBTAINED', 'REMARKS']];
      const body = includedSubjects.map(sub => {
        const score = (studentData.marks || {})[sub.id];
        const isAbsent = score === 'A';
        const isPass = !isAbsent && (score || 0) >= sub.passMarks;
        return [
          (sub.name || '').toUpperCase(),
          sub.maxMarks,
          sub.passMarks,
          isAbsent ? 'ABSENT' : (score || 0),
          isAbsent ? 'FAIL' : (isPass ? 'PASS' : 'FAIL')
        ];
      });

      autoTable(doc, {
        startY: 105,
        head: head,
        body: body,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
        headStyles: { 
          fillColor: [40, 40, 40],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          halign: 'center',
          textColor: [60, 60, 60]
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 },
          4: { fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.raw;
            if (val === 'PASS') data.cell.styles.textColor = [16, 185, 129];
            if (val === 'FAIL') data.cell.styles.textColor = [244, 63, 94];
          }
        },
        margin: { left: 14, right: 14 }
      });

      // Final Summary Table
      // @ts-ignore
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      
      // Bottom Grid for Summary
      doc.setFillColor(252, 252, 252);
      doc.rect(14, finalY + 10, 120, 35, 'F');
      doc.setDrawColor(240, 240, 240);
      doc.rect(14, finalY + 10, 120, 35, 'D');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100);
      doc.text('ACADEMIC SUMMARY', 20, finalY + 18);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Marks: ${studentData.total} / ${studentData.maxPossibleTotal}`, 20, finalY + 26);
      doc.text(`Percentage: ${studentData.percentage.toFixed(1)}%`, 20, finalY + 32);
      doc.text(`Final Grade: ${studentData.grade}`, 20, finalY + 38);

      drawSignature(finalY + 35);
      drawFooter();
      doc.save(`Report_Card_${studentData.id}_${studentData.name.replace(/\s+/g, '_')}.pdf`);
    } else {
      // Multi-student report
      const classes = [...new Set(allCalculatedStudents.map(s => s.class || 'Unassigned'))].sort();
      
      classes.forEach((className, index) => {
        if (index > 0) doc.addPage('landscape');
        
        drawHeader(`CLASS PERFORMANCE SUMMARY: ${(className || '').toUpperCase()}`);
        
        const classStudents = allCalculatedStudents.filter(s => (s.class || 'Unassigned') === className);
        const head = [['ID', 'STUDENT NAME', ...subjects.map(s => `${(s.name || '').toUpperCase()}\n(${s.type?.toUpperCase() || 'THEORY'})`), 'TOTAL', '%', 'GRADE', 'RESULT']];
        const body = classStudents.map((s) => [
          s.id, 
          (s.name || '').toUpperCase(), 
          ...subjects.map(sub => {
            const score = (s.marks || {})[sub.id];
            if (score === undefined) return '-';
            return score === 'A' ? 'ABS' : (score || 0);
          }), 
          s.total, 
          s.percentage.toFixed(1), 
          s.grade, 
          (s.result || '').toUpperCase()
        ]);

        autoTable(doc, {
          startY: 55,
          head: head,
          body: body,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
          headStyles: { 
            fillColor: [40, 40, 40],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: {
            halign: 'center',
            textColor: [60, 60, 60]
          },
          columnStyles: {
            1: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
            [subjects.length + 5]: { fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === subjects.length + 5) {
              const val = data.cell.raw;
              if (val === 'PASS') data.cell.styles.textColor = [16, 185, 129];
              if (val === 'FAIL') data.cell.styles.textColor = [244, 63, 94];
            }
          }
        });

        // @ts-ignore
        const finalY = (doc as any).lastAutoTable?.finalY || 150;
        if (finalY < 170) {
          drawSignature(180);
        }
      });
      
      drawFooter();
      doc.save(`Consolidated_Marksheet_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    }
  };

  const generateHallTicket = (student: CalculatedMarks) => {
    const doc = new jsPDF('portrait');
    
    // Helper for drawing header
    const drawHeader = (title: string) => {
      // Elegant branding bar at very top
      doc.setFillColor(15, 23, 42); // Deep navy slate
      doc.rect(15, 12, 180, 2, 'F'); // Thin elegant top strip
      
      // School Name
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('MANSHAU CAMPUS', 15, 24);
      
      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Cool gray
      doc.text('EXAMINATION HALL TICKET', 15, 32);
      
      // Right side: Exam type badge
      // Rounded grey background for Exam Badge on the right
      doc.setFillColor(241, 245, 249); // light blue-gray
      doc.roundedRect(135, 18, 60, 12, 3, 3, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(title || 'SEMESTER EXAMS', 165, 26, { align: 'center' });

      // Clean bottom border below header
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 40, 195, 40);
    };

    drawHeader((student.examType || '').toUpperCase());

    // Student Info Section
    doc.setFillColor(248, 249, 250);
    doc.rect(15, 50, 180, 45, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.rect(15, 50, 180, 45, 'D');

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT INFORMATION', 20, 58);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    doc.text(`Name: ${student.name}`, 20, 68);
    doc.text(`Center: ${examCenter}`, 155, 68, { align: 'right' });

    // Make Student ID more prominent
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Roll No / ID: ${student.id}`, 20, 77);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    doc.text(`Class: ${student.class}  |  Section: ${student.section || '-'}`, 20, 86);
    doc.text(`Exam: ${student.examType}`, 20, 93);

    // Photo placeholder or actual photo if available
    if (student.image) {
      try {
        doc.addImage(student.image, 'JPEG', 155, 55, 30, 35);
      } catch (e) {
        doc.setDrawColor(200);
        doc.rect(155, 55, 30, 35, 'D');
        doc.setFontSize(8);
        doc.text('PHOTO', 165, 75);
      }
    } else {
      doc.setDrawColor(200);
      doc.rect(155, 55, 30, 35, 'D');
      doc.setFontSize(8);
      doc.text('PHOTO', 165, 75);
    }

    // Exam Schedule Table
    const head = [['SUBJECT', 'TIME', 'ROOM']];
    const studentSubjects = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === student.class);
    const body = studentSubjects.map(sub => [
      sub.name,
      sub.examTime || 'TBA',
      sub.room || 'TBA'
    ]);

    autoTable(doc, {
      startY: 105,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold' }
      }
    });

    // Instructions
    // @ts-ignore
    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('IMPORTANT INSTRUCTIONS:', 15, finalY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    const instructions = [
      '1. Please carry this hall ticket to the examination hall.',
      '2. Candidates should reach the exam center 30 minutes before the start time.',
      '3. Electronic gadgets like mobile phones, smartwatches are strictly prohibited.',
      '4. Valid ID proof must be carried along with this hall ticket.',
      '5. No candidate will be allowed to enter the hall after 15 minutes of exam start.'
    ];
    instructions.forEach((line, i) => {
      doc.text(line, 15, finalY + 25 + (i * 7));
    });

    // Signatures
    doc.setDrawColor(200);
    doc.line(15, 260, 75, 260);
    doc.line(135, 260, 195, 260);
    doc.setFontSize(8);
    doc.text('Student Signature', 35, 265);
    doc.text('Principal Signature', 155, 265);

    doc.save(`Hall_Ticket_${student.id}_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (view === 'landing') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-4 md:p-8 lg:p-12"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-10 md:mb-16 lg:mb-20"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-3 md:mb-4 leading-none">MANSHAU CAMPUS</h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] text-[10px] sm:text-xs md:text-base lg:text-lg">Academic Performance Portal</p>
        </motion.div>
        
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-10"
        >
          {/* Admin Card */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('admin')}
            className="group bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-gray-100 text-left hover:shadow-2xl transition-all duration-500"
          >
            <div className="inline-flex p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] mb-6 md:mb-8 group-hover:rotate-6 transition-all duration-500">
              <Settings size={28} className="md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 md:mb-4 tracking-tight">Admin Dashboard</h2>
            <p className="text-gray-500 text-sm md:text-lg leading-relaxed font-medium">
              Manage students, configure subjects, set marks, and export reports.
            </p>
            <div className="mt-6 md:mt-10 flex items-center gap-2 text-black font-bold uppercase tracking-widest text-[10px] md:text-sm">
              Enter Dashboard <Award size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Student Card */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setView('portal-login');
              setPortalType('student');
            }}
            className="group bg-black p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl text-left hover:shadow-black/30 transition-all duration-500"
          >
            <div className="inline-flex p-4 md:p-5 bg-white text-black rounded-[1.5rem] md:rounded-[2rem] mb-6 md:mb-8 group-hover:-rotate-6 transition-all duration-500">
              <User size={28} className="md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-white tracking-tight">Student Portal</h2>
            <p className="text-gray-400 text-sm md:text-lg leading-relaxed font-medium">
              Access your personalized report card, view performance, and download results.
            </p>
            <div className="mt-6 md:mt-10 flex items-center gap-2 text-white font-bold uppercase tracking-widest text-[10px] md:text-sm">
              View My Results <Award size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Parent Card */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setView('portal-login');
              setPortalType('parent');
            }}
            className="group bg-emerald-500 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl text-left hover:shadow-emerald-500/30 transition-all duration-500"
          >
            <div className="inline-flex p-4 md:p-5 bg-white text-emerald-500 rounded-[1.5rem] md:rounded-[2rem] mb-6 md:mb-8 group-hover:rotate-6 transition-all duration-500">
              <Users size={28} className="md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-white tracking-tight">Parent Portal</h2>
            <p className="text-emerald-50 text-sm md:text-lg leading-relaxed font-medium">
              Monitor your child's academic progress, attendance records, and exam schedules.
            </p>
            <div className="mt-6 md:mt-10 flex items-center gap-2 text-white font-bold uppercase tracking-widest text-[10px] md:text-sm">
              Check Progress <Award size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </motion.div>

        {/* Exam Announcements/Notifications Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-6xl w-full mt-12 md:mt-18 bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-gray-100"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 border-b border-gray-100 pb-5 md:pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                <Bell size={24} className="animate-bounce" />
              </div>
              <div className="text-left">
                <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Notifications & Announcements</h3>
                <p className="text-xs md:text-sm text-gray-400 font-semibold uppercase tracking-wider mt-0.5">Stay updated with latest schedules & releases</p>
              </div>
            </div>
            {frontPageNotifications.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search announcements..."
                  className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black transition-all"
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {frontPageNotifications.length === 0 ? (
            <div className="text-center py-12 md:py-16 text-gray-400">
              <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm md:text-base">No active announcements matching your filter.</p>
              <p className="text-xs mt-1">Please check back later for exam tables and grade listings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {frontPageNotifications.map((notif) => {
                const isExpanded = expandedNotifId === notif.id;
                return (
                  <div 
                    key={notif.id}
                    className={`p-5 md:p-6 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${
                      notif.important 
                        ? 'border-red-100 bg-red-[5px] hover:bg-red-50/40' 
                        : 'border-gray-100 bg-gray-50/30 hover:bg-gray-50'
                    }`}
                    onClick={() => setExpandedNotifId(isExpanded ? null : notif.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {notif.important && (
                            <span className="bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                              Urgent / Important
                            </span>
                          )}
                          <span className="text-gray-400 font-mono text-[10px]">{notif.date}</span>
                        </div>
                        <h4 className="font-extrabold text-sm md:text-lg text-gray-900 tracking-tight mt-1">{notif.title}</h4>
                      </div>
                      <span className="text-xs text-gray-400 font-bold uppercase self-center bg-white border border-gray-100 px-3 py-1 rounded-lg">
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </span>
                    </div>

                    <div className={`transition-all duration-350 overflow-hidden ${isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      <p className="text-xs md:text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-4">
                        {notif.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  if ((view === 'admin' || view === 'attendance') && !isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex p-5 bg-gray-100 rounded-[1.8rem] mb-6">
              <GraduationCap size={32} className="text-black md:w-10 md:h-10" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Login</h1>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">MANSHAU CAMPUS</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6 md:space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                required
                autoFocus
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 md:py-5 focus:ring-2 focus:ring-black transition-all text-sm md:text-base"
                value={adminLoginInput}
                onChange={(e) => setAdminLoginInput(e.target.value)}
              />
            </div>

            {adminLoginError && (
              <p className="text-rose-500 text-xs font-medium text-center bg-rose-50 py-3 rounded-xl animate-shake">{adminLoginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-4 md:py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/20 text-sm md:text-base"
            >
              Login with Password
            </button>

            <button
              type="button"
              onClick={() => setView('landing')}
              className="w-full text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest hover:text-black transition-colors"
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }


  if (view === 'portal-login') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-black flex items-center justify-center p-4 md:p-8"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md bg-white rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl"
        >
          <div className="text-center mb-8 md:mb-10">
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="inline-flex p-5 bg-gray-100 rounded-[1.8rem] mb-6"
            >
              {portalType === 'student' ? (
                <LogIn size={32} className="text-black md:w-10 md:h-10" />
              ) : (
                <Users size={32} className="text-emerald-600 md:w-10 md:h-10" />
              )}
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {portalType === 'student' ? 'Student Portal' : 'Parent Portal'}
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">MANSHAU CAMPUS</p>
          </div>

          <form onSubmit={handlePortalLogin} className="space-y-6 md:space-y-8">
            <motion.div 
              variants={{
                show: { transition: { staggerChildren: 0.1 } }
              }}
              initial="hidden"
              animate="show"
              className="space-y-4 md:space-y-5"
            >
               <motion.div variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }} className="space-y-2 relative">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student ID</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 md:py-5 focus:ring-2 focus:ring-black transition-all text-sm md:text-base pr-10"
                    placeholder="e.g. S101"
                    value={loginId}
                    onChange={(e) => {
                      setLoginId(e.target.value);
                      setShowIdSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowIdSuggestions(true);
                      setShowNameSuggestions(false);
                    }}
                    onBlur={() => setTimeout(() => setShowIdSuggestions(false), 250)}
                  />
                  {loginId && (
                    <button
                      type="button"
                      onClick={() => setLoginId('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showIdSuggestions && filteredIdSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {filteredIdSuggestions.map(stud => (
                      <button
                        key={stud.id}
                        type="button"
                        onClick={() => {
                          setLoginId(stud.id);
                          setLoginName(stud.name);
                          setLoginError('');
                          setShowIdSuggestions(false);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-black">{stud.id}</span>
                          <span className="text-[10px] text-gray-400">Class {stud.class}</span>
                        </div>
                        <span className="text-xs text-gray-700 font-semibold">{stud.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }} className="space-y-2 relative">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 md:py-5 focus:ring-2 focus:ring-black transition-all text-sm md:text-base pr-10"
                    placeholder="As registered in sheet"
                    value={loginName}
                    onChange={(e) => {
                      setLoginName(e.target.value);
                      setShowNameSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowNameSuggestions(true);
                      setShowIdSuggestions(false);
                    }}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 250)}
                  />
                  {loginName && (
                    <button
                      type="button"
                      onClick={() => setLoginName('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {filteredNameSuggestions.map(stud => (
                      <button
                        key={stud.id}
                        type="button"
                        onClick={() => {
                          setLoginId(stud.id);
                          setLoginName(stud.name);
                          setLoginError('');
                          setShowNameSuggestions(false);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-black">{stud.name}</span>
                          <span className="text-[10px] text-gray-400">Class {stud.class}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-400">{stud.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>

            {loginError && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-rose-500 text-xs font-medium text-center bg-rose-50 py-3 rounded-xl"
              >
                {loginError}
              </motion.p>
            )}

            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-black text-white font-bold py-4 md:py-5 rounded-2xl shadow-xl shadow-black/20 text-sm md:text-base"
              >
                {portalType === 'student' ? 'Access My Portal' : 'Access Parent Portal'}
              </motion.button>

              <button
                type="button"
                onClick={() => setView('landing')}
                className="w-full text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest hover:text-black transition-colors py-2"
              >
                Back to Home
              </button>
            </div>

            {uniqueStudentsList.length > 0 && (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  Registered Students Look-Up
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 max-h-28 overflow-y-auto p-2 bg-gray-50 rounded-2xl border border-gray-100">
                  {uniqueStudentsList.map((stud) => (
                    <button
                      key={stud.id}
                      type="button"
                      onClick={() => {
                        setLoginId(stud.id);
                        setLoginName(stud.name);
                        setLoginError('');
                      }}
                      className="px-2.5 py-1.5 bg-white text-[10px] text-gray-600 hover:text-black font-semibold rounded-xl border border-gray-100 hover:border-black/20 hover:bg-gray-100/50 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      {stud.id} • {stud.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </motion.div>
      </motion.div>
    );
  }

  if (view === 'student-portal' && loggedInStudent) {
    // Reactive lookup to ensure data is always fresh if database updates
    const currentStudent = allCalculatedStudents.find(s => s.docId === loggedInStudent.docId) || loggedInStudent;
    
    const studentResults = allCalculatedStudents
      .filter(s => s.id === currentStudent.id && s.name === currentStudent.name)
      .sort((a, b) => {
        if (a.examType === 'REGISTRATION') return 1;
        if (b.examType === 'REGISTRATION') return -1;
        return (b.percentage || 0) - (a.percentage || 0);
      });

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#f8f9fa] p-4 md:p-8 lg:p-12"
      >
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky top-0 z-40 bg-[#f8f9fa]/80 backdrop-blur-md py-4 -mt-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/50"
          >
            <div className="flex items-center gap-3 md:gap-4 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-500 hover:text-black font-medium transition-colors shrink-0"
              >
                <LogOut size={18} />
                <span className="text-sm">Logout</span>
              </button>
              <div className="h-6 w-px bg-gray-200 shrink-0" />
              
              {portalType === 'parent' && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0">
                  <Users size={12} />
                  Parent View
                </div>
              )}

              {studentResults.length > 1 && (
                <>
                  <select
                    className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-black transition-all appearance-none cursor-pointer"
                    value={currentStudent.docId}
                    onChange={(e) => {
                      const selected = studentResults.find(r => r.docId === e.target.value);
                      if (selected) setLoggedInStudent(selected);
                    }}
                  >
                    {studentResults.map(res => (
                      <option key={res.docId} value={res.docId}>{res.examType}</option>
                    ))}
                  </select>
                  <div className="h-6 w-px bg-gray-200 shrink-0" />
                </>
              )}

              <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setStudentPortalTab('marks')}
                  className={cn(
                    "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all relative",
                    studentPortalTab === 'marks' ? "text-black" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {studentPortalTab === 'marks' && (
                    <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" />
                  )}
                  <span className="relative z-10">Marklist</span>
                </button>
                <button
                  onClick={() => setStudentPortalTab('attendance')}
                  className={cn(
                    "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all relative",
                    studentPortalTab === 'attendance' ? "text-black" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {studentPortalTab === 'attendance' && (
                    <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" />
                  )}
                  <span className="relative z-10">Attendance</span>
                </button>
                {currentStudent.hallTicketAvailable && (
                  <button
                    onClick={() => setStudentPortalTab('hall-ticket')}
                    className={cn(
                      "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all relative",
                      studentPortalTab === 'hall-ticket' ? "text-black" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {studentPortalTab === 'hall-ticket' && (
                      <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" />
                    )}
                    <span className="relative z-10">Hall Ticket</span>
                  </button>
                )}
                {portalType === 'parent' && (
                  <button
                    onClick={() => setStudentPortalTab('notifications')}
                    className={cn(
                      "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all relative flex items-center gap-1",
                      studentPortalTab === 'notifications' ? "text-black" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {studentPortalTab === 'notifications' && (
                      <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" />
                    )}
                    <span className="relative z-10 flex items-center gap-1">
                      Notices
                      {notifications.some(n => n.important) && (
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setStudentPortalTab('timetable')}
                  className={cn(
                    "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all relative flex items-center gap-1",
                    studentPortalTab === 'timetable' ? "text-black" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {studentPortalTab === 'timetable' && (
                    <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" />
                  )}
                  <span className="relative z-10">Class Time Table</span>
                </button>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => studentPortalTab === 'hall-ticket' ? generateHallTicket(currentStudent) : studentPortalTab === 'timetable' ? exportTimeTable(currentStudent) : exportToPDF(currentStudent)}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-semibold shadow-sm hover:bg-gray-50 transition-all text-sm"
            >
              <Download size={18} />
              {studentPortalTab === 'hall-ticket' ? 'Hall Ticket' : studentPortalTab === 'timetable' ? 'Class Time Table' : 'Report'}
            </motion.button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 shadow-sm border border-gray-100"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8 md:mb-12">
              <div className="flex flex-col md:flex-row items-center md:items-center gap-6">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-24 h-24 md:w-32 md:h-32 bg-gray-100 rounded-3xl overflow-hidden border-4 border-white shadow-lg shrink-0"
                >
                  {currentStudent.image ? (
                    <img src={currentStudent.image} alt={currentStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                      <User size={48} />
                    </div>
                  )}
                </motion.div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-2">MANSHAU CAMPUS</p>
                  <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                    {portalType === 'parent' ? "Ward: " : ""}{currentStudent.name}
                  </h1>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4 mt-2">
                    <p className="text-gray-400 font-mono text-sm md:text-lg">ID: {currentStudent.id}</p>
                    <p className="text-gray-400 font-mono text-sm md:text-lg">Class: {currentStudent.class}</p>
                    <p className="text-emerald-600 font-bold text-sm md:text-lg uppercase tracking-wider">{currentStudent.examType}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-4">
                <div className="text-center md:text-right">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Overall Result</p>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-sm md:text-lg font-bold",
                      currentStudent.result === 'Pass' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}
                  >
                    {currentStudent.result === 'Pass' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    {(currentStudent.result || '').toUpperCase()}
                  </motion.div>
                </div>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {studentPortalTab === 'marks' ? (
                <motion.div 
                  key="marks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.1 }
                      }
                    }}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12"
                  >
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="bg-gray-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-gray-100">
                      <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 md:mb-2">Total Marks</p>
                      <p className="text-2xl md:text-3xl font-bold">{currentStudent.total} <span className="text-xs md:text-sm text-gray-400 font-normal">/ {currentStudent.maxPossibleTotal}</span></p>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="bg-gray-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-gray-100">
                      <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 md:mb-2">Percentage</p>
                      <p className="text-2xl md:text-3xl font-bold">{currentStudent.percentage.toFixed(1)}%</p>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="bg-black text-white p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl flex items-center justify-between col-span-1 sm:col-span-2 md:col-span-1">
                      <div>
                        <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 md:mb-2">Grade</p>
                        <p className="text-3xl md:text-4xl font-bold">{currentStudent.grade}</p>
                      </div>
                      <Award size={32} className="text-emerald-400 opacity-50 md:w-12 md:h-12" />
                    </motion.div>
                  </motion.div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Award size={24} className="text-gray-400" />
                    Subject-wise Performance
                  </h3>
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.05 }
                      }
                    }}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-3 md:gap-4"
                  >
                    {subjects.filter(sub => currentStudent.marks[sub.id] !== undefined).length > 0 ? (
                      subjects.filter(sub => currentStudent.marks[sub.id] !== undefined).map((sub) => {
                        const score = currentStudent.marks[sub.id];
                        const isAbsent = score === 'A';
                        const isPass = !isAbsent && (score || 0) >= sub.passMarks;
                        return (
                          <motion.div 
                            variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}
                            key={sub.id} 
                            className="flex items-center justify-between p-4 md:p-6 bg-gray-50 rounded-xl md:rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base md:text-lg font-medium truncate">{sub.name}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest">Max: {sub.maxMarks}</span>
                                <span className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest">Pass: {sub.passMarks}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 md:gap-6 shrink-0">
                              {!isAbsent && (
                                <div className="w-20 md:w-32 h-1.5 md:h-2 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((score as number || 0) / sub.maxMarks) * 100}%` }}
                                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                                    className={cn(
                                      "h-full rounded-full transition-colors",
                                      isPass ? "bg-emerald-500" : "bg-rose-500"
                                    )}
                                  />
                                </div>
                              )}
                              <span className={cn(
                                "text-xl md:text-2xl font-bold w-10 md:w-12 text-right",
                                isAbsent ? "text-rose-600" : isPass ? "text-black" : "text-rose-600"
                              )}>
                                {isAbsent ? 'A' : score || 0}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200"
                      >
                        <Award size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-medium">No marks recorded for this exam yet.</p>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>

              ) : studentPortalTab === 'attendance' ? (
                <motion.div 
                  key="attendance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                    {/* Stats Cards */}
                    <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 md:gap-4">
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-emerald-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-emerald-100">
                        <p className="text-emerald-600 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2">Present Days</p>
                        <p className="text-2xl md:text-3xl font-bold text-emerald-700">
                          {attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Present').length}
                        </p>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-rose-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-rose-100">
                        <p className="text-rose-600 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2">Absent Days</p>
                        <p className="text-2xl md:text-3xl font-bold text-rose-700">
                          {attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Absent').length}
                        </p>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-amber-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-amber-100">
                        <p className="text-amber-600 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2">Late Days</p>
                        <p className="text-2xl md:text-3xl font-bold text-amber-700">
                          {attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Late').length}
                        </p>
                      </motion.div>
                    </div>

                    {/* Attendance Graph */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="lg:col-span-2 bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm"
                    >
                      <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2">
                        <TrendingUp size={16} />
                        Attendance Distribution
                      </h3>
                      <div className="h-[200px] md:h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Present', value: attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Present').length },
                                { name: 'Absent', value: attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Absent').length },
                                { name: 'Late', value: attendanceRecords.filter(r => r.studentId === currentStudent.id && r.status === 'Late').length },
                              ].filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#f43f5e" />
                              <Cell fill="#f59e0b" />
                            </Pie>
                            <RechartsTooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                      <Calendar size={24} className="text-gray-400" />
                      Recent Attendance History
                    </h3>
                    <motion.div 
                      variants={{
                        show: { transition: { staggerChildren: 0.1 } }
                      }}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-1 gap-2 md:gap-3"
                    >
                      {attendanceRecords
                        .filter(r => r.studentId === currentStudent.id)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((record) => (
                          <motion.div 
                            variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                            key={record.id} 
                            className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center",
                                record.status === 'Present' ? "bg-emerald-100 text-emerald-700" :
                                record.status === 'Absent' ? "bg-rose-100 text-rose-700" :
                                "bg-amber-100 text-amber-700"
                              )}>
                                {record.status === 'Present' ? <Check size={16} className="md:w-5 md:h-5" /> :
                                 record.status === 'Absent' ? <X size={16} className="md:w-5 md:h-5" /> :
                                 <Clock size={16} className="md:w-5 md:h-5" />}
                              </div>
                              <div>
                                <p className="font-bold text-xs md:text-base">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                <p className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">{record.status}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      {attendanceRecords.filter(r => r.studentId === currentStudent.id).length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                          <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
                          <p className="text-gray-400 font-medium">No attendance records found yet.</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              ) : (studentPortalTab === 'notifications' && portalType === 'parent') ? (
                <motion.div 
                  key="notifications"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 text-left"
                >
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-50">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 leading-tight">
                          <Megaphone size={22} className="text-emerald-500 animate-pulse" />
                          Official Bulletins & Alerts
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">Stay up to date with notices released by Manshau Campus</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-6 p-1 bg-gray-50 rounded-xl max-w-max">
                      {[
                        { id: 'mine', label: portalType === 'student' ? 'My Alerts (Student)' : 'My Alerts (Parent)' },
                        { id: 'all', label: 'All Notices' },
                        { id: 'students', label: 'For Students' },
                        { id: 'parents', label: 'For Parents' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPortalNotifFilter(item.id as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                            portalNotifFilter === item.id
                              ? "bg-white text-black shadow-sm"
                              : "text-gray-400 hover:text-gray-700"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const portalFilteredNotifs = notifications.filter(notif => {
                        if (portalNotifFilter === 'all') return true;
                        if (portalNotifFilter === 'students') return notif.audience === 'students';
                        if (portalNotifFilter === 'parents') return notif.audience === 'parents';
                        // 'mine' filter options
                        if (portalType === 'student') {
                          return notif.audience === 'students' || notif.audience === 'all' || !notif.audience;
                        } else {
                          return notif.audience === 'parents' || notif.audience === 'all' || !notif.audience;
                        }
                      });

                      return portalFilteredNotifs.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-100 rounded-3xl">
                          <Bell size={40} className="mx-auto mb-3 opacity-30" />
                          <p className="font-bold text-sm">No notifications found under this filter.</p>
                          <p className="text-xs mt-0.5">New Announcements matching this criterion will appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {portalFilteredNotifs
                            .sort((a, b) => {
                              if (a.important && !b.important) return -1;
                              if (!a.important && b.important) return 1;
                              return b.date.localeCompare(a.date);
                            })
                            .map((notif) => (
                              <div 
                                key={notif.id}
                                className={`p-5 rounded-2xl border transition-all ${
                                  notif.important 
                                    ? 'border-red-100 bg-red-50/10' 
                                    : 'border-gray-50 bg-gray-50/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                                  {notif.important && (
                                    <span className="bg-red-505 text-red-650 font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-red-100">
                                      Urgent Notice
                                    </span>
                                  )}
                                  {notif.audience === 'students' && (
                                    <span className="bg-blue-100 text-blue-750 font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Students Only
                                    </span>
                                  )}
                                  {notif.audience === 'parents' && (
                                    <span className="bg-purple-100 text-purple-750 font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Parents Only
                                    </span>
                                  )}
                                  {(notif.audience === 'all' || !notif.audience) && (
                                    <span className="bg-gray-100 text-gray-500 font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      All Recipients
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-gray-400 font-semibold">{notif.date}</span>
                                </div>
                                <h4 className="font-bold text-base text-gray-900 tracking-tight leading-snug mb-2">{notif.title}</h4>
                                <p className="text-xs md:text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{notif.content}</p>
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              ) : (studentPortalTab === 'hall-ticket' && currentStudent.hallTicketAvailable) ? (
                <motion.div 
                  key="hall-ticket"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8"
                >
                  <div className="bg-gray-50 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-gray-100 text-center">
                    <motion.div 
                      initial={{ rotate: -15, scale: 0.5 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className="inline-flex p-6 bg-black text-white rounded-[2rem] mb-6"
                    >
                      <FileText size={48} />
                    </motion.div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">
                      {portalType === 'parent' ? "Ward's Exam Hall Ticket" : "Exam Hall Ticket"}
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                      {portalType === 'parent' 
                        ? `Your ward's hall ticket for the ${currentStudent.examType} is ready. Please download and print it for the examination.`
                        : `Your hall ticket for the ${currentStudent.examType} is ready. Please download and print it for the examination.`
                      }
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => generateHallTicket(currentStudent)}
                      className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-black/20"
                    >
                      <Download size={20} />
                      Download Hall Ticket (PDF)
                    </motion.button>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Calendar size={16} />
                      Exam Schedule
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Room</th>
                          </tr>
                        </thead>
                        <motion.tbody 
                          variants={{
                            show: { transition: { staggerChildren: 0.05 } }
                          }}
                          initial="hidden"
                          animate="show"
                          className="divide-y divide-gray-50"
                        >
                          {subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === currentStudent.class).map(sub => (
                            <motion.tr 
                              variants={{ hidden: { opacity: 0, y: 5 }, show: { opacity: 1, y: 0 } }}
                              key={sub.id}
                            >
                              <td className="py-4 font-bold text-sm">{sub.name}</td>
                              <td className="py-4 text-sm text-gray-600">{sub.examTime || 'TBA'}</td>
                              <td className="py-4 text-sm text-gray-600">{sub.room || 'TBA'}</td>
                            </motion.tr>
                          ))}
                        </motion.tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              ) : studentPortalTab === 'timetable' ? (
                <motion.div
                  key="timetable"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={16} />
                        Class Time Table
                      </h4>
                      <p className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl font-medium border border-gray-150">
                        Class: <span className="font-bold text-gray-800">{currentStudent.class}</span>
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-medium">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Day</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Time Slot</th>
                            <th className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Room No.</th>
                          </tr>
                        </thead>
                        <motion.tbody 
                          variants={{
                            show: { transition: { staggerChildren: 0.05 } }
                          }}
                          initial="hidden"
                          animate="show"
                          className="divide-y divide-gray-50"
                        >
                          {(() => {
                            const studentSubjects = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === currentStudent.class);
                            if (studentSubjects.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-gray-400 text-xs font-bold leading-normal">
                                    No class time tables scheduled for your class yet.
                                  </td>
                                </tr>
                              );
                            }
                            
                            const DAY_ORDER: Record<string, number> = {
                              'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7
                            };
                            
                            const sortedSubjects = [...studentSubjects].sort((a, b) => {
                              const orderA = DAY_ORDER[a.day || 'Monday'] || 99;
                              const orderB = DAY_ORDER[b.day || 'Monday'] || 99;
                              return orderA - orderB;
                            });

                            return sortedSubjects.map(sub => (
                              <motion.tr 
                                variants={{ hidden: { opacity: 0, y: 5 }, show: { opacity: 1, y: 0 } }}
                                key={sub.id}
                                className="group hover:bg-gray-50/50 transition-all font-medium"
                              >
                                <td className="py-4 font-bold text-sm text-gray-950 capitalize">{sub.day || 'Monday'}</td>
                                <td className="py-3 font-bold text-sm text-gray-950">{sub.name}</td>
                                <td className="py-4 text-xs font-bold">
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-bold border capitalize",
                                    sub.type === "Practical" 
                                      ? "bg-purple-50 text-purple-700 border-purple-100"
                                      : sub.type === "Internal"
                                      ? "bg-amber-50 text-amber-700 border-amber-100"
                                      : "bg-blue-50 text-blue-700 border-blue-100"
                                  )}>
                                    {sub.type || 'Theory'}
                                  </span>
                                </td>
                                <td className="py-4 text-sm text-gray-600 flex items-center gap-1.5 font-bold">
                                  <Clock size={13} className="text-gray-400" />
                                  {sub.classTime || 'TBA'}
                                </td>
                                <td className="py-4 text-sm text-gray-900 font-bold text-right text-gray-650">
                                  {sub.room ? `Room ${sub.room}` : 'TBA'}
                                </td>
                              </motion.tr>
                            ));
                          })()}
                        </motion.tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <AlertTriangle size={48} className="text-amber-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">Hall Ticket Restricted</h3>
                  <p className="text-gray-500">Your hall ticket is not yet issued by the administration.</p>
                  <button 
                    onClick={() => setStudentPortalTab('marks')}
                    className="mt-6 text-sm font-bold text-black border-b-2 border-black pb-1 hover:opacity-70 transition-opacity"
                  >
                    Return to Dashboard
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#f5f5f5]/80 backdrop-blur-md py-4 -mt-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-3 bg-black text-white rounded-xl md:rounded-2xl shrink-0">
              <GraduationCap size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tight">MANSHAU CAMPUS</h1>
              <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">Academic Performance System</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button
              onClick={() => setView(view === 'attendance' ? 'admin' : 'attendance')}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-semibold transition-all shadow-sm text-xs md:text-base",
                view === 'attendance' ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:text-black"
              )}
            >
              <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="whitespace-nowrap">{view === 'attendance' ? 'Back' : 'Attendance'}</span>
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => {
                  setIsAdminLoggedIn(false);
                  setView('landing');
                  toast.success("Logged out successfully");
                }}
                className="p-2.5 md:p-3 bg-white border border-rose-100 rounded-xl md:rounded-2xl text-rose-500 hover:bg-rose-50 transition-all shadow-sm flex items-center gap-2"
                title="Logout"
              >
                <LogOut size={16} className="md:w-[18px] md:h-[18px]" />
                <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-widest">Logout</span>
              </button>
              <button
                onClick={() => {
                  const settingsSection = document.getElementById('admin-settings');
                  settingsSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="p-2.5 md:p-3 bg-white border border-gray-200 rounded-xl md:rounded-2xl text-gray-500 hover:text-black transition-all shadow-sm"
                title="Admin Settings"
              >
                <Settings size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
            <button
              onClick={() => exportToPDF()}
              disabled={students.length === 0}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-black text-white px-3 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-semibold shadow-lg shadow-black/10 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-base"
            >
              <Download size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="whitespace-nowrap">Export</span>
            </button>
          </div>
        </header>

        {/* Admin Tabs */}
        {view === 'admin' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide animate-in fade-in slide-in-from-top-4 duration-500">
            {[
              { id: 'results', label: 'Exam Results', icon: FileText },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'subjects', label: 'Subjects', icon: BookOpen },
              { id: 'timetable', label: 'Class Time Table', icon: Calendar },
              { id: 'hall-tickets', label: 'Hall Tickets', icon: Ticket },
              { id: 'notifications', label: 'Announcements', icon: Megaphone },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all",
                  adminTab === tab.id 
                    ? "bg-black text-white shadow-lg shadow-black/10" 
                    : "bg-white text-gray-400 hover:text-black border border-gray-100"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
          <Toaster position="top-right" richColors />
          
          {view === 'attendance' ? (
            <div className="xl:col-span-12 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                      <Users size={24} className="text-emerald-500" />
                      Daily Attendance
                    </h2>
                    <p className="text-xs md:text-sm text-gray-500">Manage student attendance</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-end gap-2 md:gap-4">
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1 lg:col-auto">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Search Student</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 md:w-4 md:h-4" />
                        <input
                          type="text"
                          placeholder="Search..."
                          className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black transition-all font-medium text-xs md:text-sm"
                          value={attendanceSearch}
                          onChange={(e) => setAttendanceSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const studentsInClass = students.filter(s => s.class === attendanceClass);
                        if (studentsInClass.length === 0) return;
                        
                        setIsSavingAttendance(true);
                        try {
                          for (const student of studentsInClass) {
                            await markAttendance(student.id, student.name, student.class, 'Present');
                          }
                          toast.success(`Marked all ${studentsInClass.length} students as Present`);
                        } catch (error) {
                          console.error(error);
                        } finally {
                          setIsSavingAttendance(false);
                        }
                      }}
                      disabled={isSavingAttendance}
                      className="px-3 md:px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] md:text-xs hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 h-[38px] whitespace-nowrap"
                    >
                      <CheckSquare size={14} className="md:w-4 md:h-4" />
                      <span>Mark All</span>
                    </button>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Date</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 md:w-4 md:h-4" />
                        <input
                          type="date"
                          className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black transition-all font-medium text-[10px] md:text-sm"
                          value={attendanceDate}
                          onChange={(e) => setAttendanceDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Class</label>
                      <div className="relative">
                        <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 md:w-4 md:h-4" />
                        <select
                          className="w-full pl-9 pr-8 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black transition-all font-medium appearance-none text-[10px] md:text-sm"
                          value={attendanceClass}
                          onChange={(e) => setAttendanceClass(e.target.value)}
                        >
                          {FIXED_CLASSES.map(c => (
                            <option key={c} value={c}>Class {c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide -mx-4 md:mx-0">
                  <table className="w-full border-separate border-spacing-y-3 min-w-[700px] md:min-w-0">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-2 w-12">
                          <button 
                            onClick={async () => {
                              const studentsInClass = students.filter(s => s.class === attendanceClass);
                              const allPresent = studentsInClass.every(s => getAttendanceStatus(s.id) === 'Present');
                              
                              setIsSavingAttendance(true);
                              try {
                                for (const student of studentsInClass) {
                                  await markAttendance(student.id, student.name, student.class, allPresent ? 'Absent' : 'Present');
                                }
                                toast.success(allPresent ? "Marked all as Absent" : "Marked all as Present");
                              } catch (error) {
                                console.error(error);
                              } finally {
                                setIsSavingAttendance(false);
                              }
                            }}
                            className="p-1 rounded-md transition-all text-gray-300 hover:text-emerald-500"
                          >
                            <CheckSquare size={16} />
                          </button>
                        </th>
                        <th className="px-3 md:px-6 py-4 text-left">Student</th>
                        <th className="px-3 md:px-6 py-4 text-left">ID</th>
                        <th className="px-3 md:px-6 py-4 text-center">Section</th>
                        <th className="px-3 md:px-6 py-4 text-center">Status</th>
                        <th className="px-3 md:px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-gray-400 font-medium">
                            No students found matching your search in Class {attendanceClass}
                          </td>
                        </tr>
                      ) : (
                        filteredAttendanceStudents
                          .map((student) => {
                            const status = getAttendanceStatus(student.id);
                            return (
                              <tr key={student.id} className="bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group rounded-2xl">
                                <td className="px-3 md:px-6 py-4 rounded-l-2xl">
                                  <button
                                    onClick={() => markAttendance(student.id, student.name, student.class, status === 'Present' ? 'Absent' : 'Present')}
                                    className={cn(
                                      "p-1 rounded-md transition-all",
                                      status === 'Present' ? "text-emerald-500" : "text-gray-300 hover:text-gray-400"
                                    )}
                                  >
                                    {status === 'Present' ? <CheckSquare size={20} /> : <Square size={20} />}
                                  </button>
                                </td>
                                <td className="px-3 md:px-6 py-4">
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden shrink-0">
                                      {student.image ? (
                                        <img src={student.image} alt={student.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <User size={16} className="text-gray-300" />
                                      )}
                                    </div>
                                    <span className="font-bold text-xs md:text-sm truncate max-w-[80px] sm:max-w-none">{student.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 md:px-6 py-4">
                                  <span className="font-mono text-[10px] md:text-xs text-gray-400">{student.id}</span>
                                </td>
                                <td className="px-3 md:px-6 py-4">
                    <div className="flex justify-center">
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-gray-100/50 px-2 py-1 rounded-lg">Section {student.section || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-3 md:px-6 py-4">
                                  <div className="flex justify-center">
                                    {status ? (
                                      <div className={cn(
                                        "px-2 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-1.5",
                                        status === 'Present' ? "bg-emerald-100 text-emerald-700" :
                                        status === 'Absent' ? "bg-rose-100 text-rose-700" :
                                        "bg-amber-100 text-amber-700"
                                      )}>
                                        {status === 'Present' ? <Check size={10} /> :
                                         status === 'Absent' ? <X size={10} /> :
                                         <Clock size={10} />}
                                        <span className="hidden sm:inline">{status}</span>
                                      </div>
                                    ) : (
                                      <span className="text-[8px] md:text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">N/A</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 md:px-6 py-4 rounded-r-2xl text-right">
                                  <div className="flex items-center justify-end gap-1 md:gap-2">
                                    <button
                                      onClick={() => markAttendance(student.id, student.name, student.class, 'Present')}
                                      className={cn(
                                        "p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all",
                                        status === 'Present' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white border border-gray-100 text-gray-400 hover:text-emerald-500"
                                      )}
                                      title="Mark Present"
                                    >
                                      <Check size={14} className="md:w-[18px] md:h-[18px]" />
                                    </button>
                                    <button
                                      onClick={() => markAttendance(student.id, student.name, student.class, 'Late')}
                                      className={cn(
                                        "p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all",
                                        status === 'Late' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-white border border-gray-100 text-gray-400 hover:text-amber-500"
                                      )}
                                      title="Mark Late"
                                    >
                                      <Clock size={14} className="md:w-[18px] md:h-[18px]" />
                                    </button>
                                    <button
                                      onClick={() => markAttendance(student.id, student.name, student.class, 'Absent')}
                                      className={cn(
                                        "p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all",
                                        status === 'Absent' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-white border border-gray-100 text-gray-400 hover:text-rose-500"
                                      )}
                                      title="Mark Absent"
                                    >
                                      <X size={14} className="md:w-[18px] md:h-[18px]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Total Present</p>
                  <p className="text-2xl md:text-4xl font-black text-emerald-500">
                    {attendanceRecords.filter(r => r.date === attendanceDate && r.class === attendanceClass && r.status === 'Present').length}
                  </p>
                </div>
                <div className="bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Total Absent</p>
                  <p className="text-2xl md:text-4xl font-black text-rose-500">
                    {attendanceRecords.filter(r => r.date === attendanceDate && r.class === attendanceClass && r.status === 'Absent').length}
                  </p>
                </div>
                <div className="bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Total Late</p>
                  <p className="text-2xl md:text-4xl font-black text-amber-500">
                    {attendanceRecords.filter(r => r.date === attendanceDate && r.class === attendanceClass && r.status === 'Late').length}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="xl:col-span-12 space-y-6 md:space-y-8">
              {adminTab === 'students' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="xl:col-span-5">
                    <form onSubmit={handleAddStudent} className="space-y-6 md:space-y-8">
                      {/* Student Details Card */}
                      <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                          <UserPlus size={20} className="text-gray-400" />
                          <h2 className="text-base md:text-lg font-bold">New Student Registration</h2>
                        </div>
                        
                        <div className="space-y-3 md:space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 font-mono">
                            <div className="space-y-1">
                              <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student ID</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. S101"
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 pr-10 text-sm focus:ring-2 focus:ring-black transition-all"
                                  value={newStudent.id}
                                  onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                                />
                                <button
                                  type="button"
                                  onClick={generateNextStudentId}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-black transition-colors"
                                  title="Auto-generate ID"
                                >
                                  <Sparkles size={16} />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student Name</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. John Doe"
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-black transition-all"
                                value={newStudent.name}
                                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Class</label>
                              <select
                                required
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-black transition-all appearance-none"
                                value={newStudent.class}
                                onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                              >
                                {FIXED_CLASSES.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Section</label>
                              <select
                                required
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-black transition-all appearance-none"
                                value={newStudent.section}
                                onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                              >
                                {FIXED_SECTIONS.map(sec => (
                                  <option key={sec} value={sec}>Section {sec}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student Photo</label>
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 shrink-0">
                                {newStudent.image ? (
                                  <img src={newStudent.image} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon size={20} className="text-gray-300" />
                                )}
                              </div>
                              <div className="flex-1 flex gap-2">
                                <label className="flex-1 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-4 py-2.5 md:py-3 text-xs md:text-sm font-semibold text-gray-650 text-gray-500 border border-gray-200 flex items-center justify-center">
                                  <span>Choose Photo</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                  />
                                </label>
                                {newStudent.image && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPhotoAdjustSrc(newStudent.image!);
                                      setOnPhotoAdjustSave(() => (adjusted) => {
                                        setNewStudent(prev => ({ ...prev, image: adjusted }));
                                      });
                                    }}
                                    className="px-3.5 bg-black hover:bg-gray-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    title="Adjust Photo"
                                  >
                                    <Sliders size={13} />
                                    <span>Adjust</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                          <CheckCircle2 size={20} className="text-black" />
                          <h2 className="text-base md:text-lg font-bold">Action Center</h2>
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-400 mb-4 md:mb-6">Register this student to the central database.</p>
                        <button
                          type="submit"
                          disabled={isAddingStudent}
                          className="w-full bg-black text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl hover:bg-gray-900 active:scale-[0.98] transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-black/10 text-sm md:text-base"
                        >
                          {isAddingStudent ? (
                            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus size={18} className="md:w-5 md:h-5" />
                          )}
                          {isAddingStudent ? 'Adding...' : 'Add to Student Sheet'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="xl:col-span-7 space-y-6 md:space-y-8">
            {/* Stats Card */}
            <div className="bg-black text-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">Registered Students</p>
                <h3 className="text-4xl md:text-5xl font-light mb-3 md:mb-4">{new Set(students.map(s => s.id)).size}</h3>
                <div className="flex gap-4 mb-4 md:mb-6">
                  <div>
                    <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Passed Records</p>
                    <p className="text-lg md:text-xl font-medium">{allCalculatedStudents.filter(s => s.result === 'Pass').length}</p>
                  </div>
                  <div className="w-px h-6 md:h-8 bg-white/20" />
                  <div>
                    <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Failed Records</p>
                    <p className="text-lg md:text-xl font-medium">{allCalculatedStudents.filter(s => s.result === 'Fail').length}</p>
                  </div>
                </div>

                {Object.keys(classDistribution).length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Students by Class</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(classDistribution).map(([className, count]) => (
                        <div key={className} className="bg-white/5 rounded-xl p-2 md:p-3 flex justify-between items-center">
                          <span className="text-[10px] md:text-xs font-medium text-gray-300 truncate mr-2">{className}</span>
                          <span className="text-xs md:text-sm font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute -right-6 -bottom-6 md:-right-8 md:-bottom-8 opacity-10">
                <Calculator size={120} className="md:w-[160px] md:h-[160px]" />
              </div>
            </div>

            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden relative">
              <AnimatePresence>
                {selectedStudentIds.length > 0 && (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="absolute top-0 left-0 right-0 z-20 bg-black text-white p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedStudentIds([])} className="hover:text-gray-400">
                        <X size={18} />
                      </button>
                      <span className="text-sm font-bold">{selectedStudentIds.length} Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={bulkDownloadHallTickets}
                        className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors"
                      >
                        <Download size={14} />
                        Download All
                      </button>
                      <button 
                        onClick={() => bulkToggleHallTicket(true)}
                        className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                      >
                        <Ticket size={14} />
                        Issue Hall Tickets
                      </button>
                      <button 
                        onClick={() => bulkToggleHallTicket(false)}
                        className="bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-rose-600 transition-colors"
                      >
                        <XCircle size={14} />
                        Revoke Hall Tickets
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="p-4 md:p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={18} />
                  Registry List
                </h3>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search registry..."
                    className="pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded-lg text-xs focus:ring-1 focus:ring-black outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-black focus:ring-black"
                          checked={selectedStudentIds.length === uniqueRegistryStudents.length && uniqueRegistryStudents.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Class</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Hall Ticket</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {uniqueRegistryStudents.map(student => {
                      const id = student.id;
                      const isSelected = selectedStudentIds.includes(id);
                      
                      const studentResults = allCalculatedStudents.filter(s => s.id === id && s.examType !== 'REGISTRATION');
                      const latestPerf = studentResults.length > 0 
                        ? Math.round(studentResults.reduce((acc, curr) => acc + curr.percentage, 0) / studentResults.length) 
                        : null;

                      return (
                        <tr key={id} className={cn(
                          "hover:bg-gray-50 transition-colors group",
                          isSelected && "bg-black/5"
                        )}>
                          <td className="px-4 py-3 text-center">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-black focus:ring-black"
                              checked={isSelected}
                              onChange={() => handleSelectStudent(id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                {student.image ? (
                                  <img src={student.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <User size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{student.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{student.section ? `Section ${student.section}` : 'General'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] font-mono font-bold bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">{student.id}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-bold text-gray-600">{student.class}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              {student.hallTicketAvailable ? (
                                <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Issued</span>
                              ) : (
                                <span className="text-[8px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Locked</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => generateHallTicket(student as any)}
                                disabled={!student.hallTicketAvailable}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  student.hallTicketAvailable ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-200 cursor-not-allowed"
                                )}
                                title={student.hallTicketAvailable ? "Download Hall Ticket" : "Issuance Required"}
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => toggleHallTicket(student.id, student.hallTicketAvailable || false)}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  student.hallTicketAvailable ? "text-emerald-500 bg-emerald-50" : "text-gray-400 hover:text-black hover:bg-gray-100"
                                )}
                                title={student.hallTicketAvailable ? "Revoke Hall Ticket" : "Issue Hall Ticket"}
                              >
                                <Ticket size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setAdminTab('results');
                                  setResultSearchId(student.id);
                                  setTimeout(() => findStudentById(), 100);
                                }}
                                className="p-1.5 text-black hover:bg-gray-100 rounded-lg transition-all"
                                title="Enter Results"
                              >
                                <Award size={16} />
                              </button>
                              <button
                                onClick={() => setEditingStudent({...student, marks: {}, examType: ''} as any)}
                                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                                title="Settings"
                              >
                                <Settings size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'subjects' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Subject Configuration */}
          <div id="subject-settings" className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl shadow-black/5 border border-gray-100 animate-in fade-in zoom-in duration-700">
              <div className="flex items-center justify-between mb-6 md:mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-black text-white rounded-2xl">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight">Subject Configuration</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage academic curriculum</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-8 md:space-y-12">
                {/* Add Subject */}
                <div className="bg-gray-50/50 p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-inner">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Plus size={14} className="text-black" />
                    Register New Subject
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
                    <div className="space-y-1.5 focus-within:translate-x-1 transition-transform md:col-span-2">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Subject Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Physics"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Select Class</label>
                      <select
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                        value={newSubjectClass}
                        onChange={(e) => setNewSubjectClass(e.target.value)}
                      >
                        <option value="All">All Classes</option>
                        {FIXED_CLASSES.map(cls => (
                          <option key={cls} value={cls}>Class {cls}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Max Marks</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all shadow-sm font-bold"
                        value={newSubjectMax}
                        onChange={(e) => setNewSubjectMax(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Pass Marks</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all shadow-sm font-bold"
                        value={newSubjectPass}
                        onChange={(e) => setNewSubjectPass(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Subject Type</label>
                      <select
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                        value={newSubjectType}
                        onChange={(e) => setNewSubjectType(e.target.value)}
                      >
                        {subjectTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:gap-6 mb-8">
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Class Day</label>
                      <select
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                        value={newSubjectDay}
                        onChange={(e) => setNewSubjectDay(e.target.value)}
                      >
                        {FIXED_DAYS.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Class Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 09:00 AM - 10:00 AM"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all shadow-sm font-bold"
                        value={newSubjectTime}
                        onChange={(e) => setNewSubjectTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={addSubject}
                    className="w-full bg-black text-white font-black py-4 rounded-2xl hover:bg-gray-900 active:scale-[0.98] transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-3 text-sm md:text-base border border-black/10"
                  >
                    <div className="p-1 bg-white/20 rounded-lg">
                      <Plus size={20} />
                    </div>
                    Register Subject
                  </button>
                </div>

                {/* Current Subjects */}
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BookOpen size={14} />
                    Active Subjects
                  </h3>
                  <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="p-4 bg-white rounded-2xl space-y-3 border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-black group-hover:w-2 transition-all opacity-0 group-hover:opacity-100" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-xl group-hover:bg-black group-hover:text-white transition-colors">
                              <BookOpen size={16} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm md:text-base block">{sub.name}</span>
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border",
                                !sub.class || sub.class === 'All'
                                  ? "bg-gray-150 text-gray-600 border-gray-250 bg-gray-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}>
                                {!sub.class || sub.class === 'All' ? 'All Classes' : `Class ${sub.class}`}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${sub.name}?`)) {
                                removeSubject(sub.id);
                              }
                            }}
                            className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0"
                            title="Remove Subject"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-8 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div className="flex flex-col col-span-2">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Subject Name</span>
                            <input
                              type="text"
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold"
                              value={sub.name}
                              onChange={(e) => updateSubject(sub.id, { name: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Class</span>
                            <select
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold appearance-none cursor-pointer"
                              value={sub.class || 'All'}
                              onChange={(e) => updateSubject(sub.id, { class: e.target.value })}
                            >
                              <option value="All">All</option>
                              {FIXED_CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Max</span>
                            <input
                              type="number"
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold"
                              value={sub.maxMarks}
                              onChange={(e) => updateSubject(sub.id, { maxMarks: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Pass</span>
                            <input
                              type="number"
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold"
                              value={sub.passMarks}
                              onChange={(e) => updateSubject(sub.id, { passMarks: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Type</span>
                            <select
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold appearance-none cursor-pointer"
                              value={sub.type || 'Theory'}
                              onChange={(e) => updateSubject(sub.id, { type: e.target.value as any })}
                            >
                              {subjectTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Day</span>
                            <select
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold appearance-none cursor-pointer"
                              value={sub.day || 'Monday'}
                              onChange={(e) => updateSubject(sub.id, { day: e.target.value })}
                            >
                              {FIXED_DAYS.map(day => (
                                <option key={day} value={day}>{day}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Time</span>
                            <input
                              type="text"
                              className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black focus:border-transparent transition-all font-bold"
                              value={sub.examTime || ''}
                              onChange={(e) => updateSubject(sub.id, { examTime: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'timetable' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl shadow-black/5 border border-gray-100 animate-in fade-in zoom-in duration-700">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 md:mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-black text-white rounded-2xl">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight">Class Time Table Management</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure weekly lecture schedules and classrooms</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddTimeTableForm(!showAddTimeTableForm)}
                    className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    {showAddTimeTableForm ? "Hide Planner" : "Schedule New Lecture"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs"
                  >
                    <Download size={14} />
                    Print / Save Master Schedule
                  </motion.button>
                </div>
              </div>

              {showAddTimeTableForm && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gray-50/70 p-6 md:p-8 rounded-[2rem] border border-gray-200 shadow-inner mb-8 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                      <PlusCircle size={16} className="text-black" />
                      Add New Lecture / Class Schedule
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Weekly Timetable Planner</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Subject field */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Subject Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Maths, Physics, etc."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                      />
                      {/* Subject Name quick selection */}
                      <span className="text-[9px] text-gray-400 font-bold uppercase ml-1 block mt-2">Quick-Pick Subject:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {Array.from(new Set([...subjects.map(s => s.name), 'Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer'])).slice(0, 8).map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setNewSubjectName(name)}
                            className={cn(
                              "text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                              newSubjectName === name
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                            )}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Class Selector & Day Selector */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Class Section</label>
                        <select
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                          value={newSubjectClass}
                          onChange={(e) => setNewSubjectClass(e.target.value)}
                        >
                          <option value="All">All Classes</option>
                          {FIXED_CLASSES.map(cls => (
                            <option key={cls} value={cls}>Class {cls}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Day of the Week</label>
                        <select
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                          value={newSubjectDay}
                          onChange={(e) => setNewSubjectDay(e.target.value)}
                        >
                          {FIXED_DAYS.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Time option presets & customize */}
                    <div className="space-y-2 lg:col-span-1 md:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Clock size={11} /> Class Time Slot
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 09:00 AM - 10:00 AM"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectTime}
                        onChange={(e) => setNewSubjectTime(e.target.value)}
                      />
                      
                      {/* Time suggestions / chips */}
                      <span className="text-[9px] text-gray-400 font-bold uppercase ml-1 block my-2">Quick-Select Class Timings:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {[
                          "08:30 AM - 09:30 AM",
                          "09:30 AM - 10:30 AM",
                          "10:45 AM - 11:45 AM",
                          "11:45 AM - 12:45 PM",
                          "01:30 PM - 02:30 PM",
                          "02:30 PM - 03:30 PM",
                          "03:30 PM - 04:30 PM"
                        ].map(tSlot => (
                          <button
                            key={tSlot}
                            type="button"
                            onClick={() => setNewSubjectTime(tSlot)}
                            className={cn(
                              "text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer",
                              newSubjectTime === tSlot
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                            )}
                          >
                            {tSlot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Room, Max Marks, Passmarks, Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Room No.</label>
                      <input
                        type="text"
                        placeholder="e.g. 101, Lab 1"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectRoom}
                        onChange={(e) => setNewSubjectRoom(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lecture Type</label>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold appearance-none cursor-pointer"
                        value={newSubjectType}
                        onChange={(e) => setNewSubjectType(e.target.value)}
                      >
                        {subjectTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Max Marks (Exc. Exams)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectMax}
                        onChange={(e) => setNewSubjectMax(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pass Marks (Exc. Exams)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs md:text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm font-bold"
                        value={newSubjectPass}
                        onChange={(e) => setNewSubjectPass(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Add action buttons */}
                  <div className="flex md:justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setNewSubjectName('');
                        setNewSubjectTime('');
                        setNewSubjectRoom('');
                        setNewSubjectType('Theory');
                        setNewSubjectClass('All');
                        setNewSubjectDay('Monday');
                        setShowAddTimeTableForm(false);
                      }}
                      className="px-6 py-3 border border-gray-200 bg-white font-bold text-gray-500 rounded-xl hover:bg-gray-50 hover:text-black transition-all cursor-pointer text-xs md:text-sm"
                    >
                      Reset / Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newSubjectName.trim()) {
                          toast.error("Subject name is required!");
                          return;
                        }
                        if (!newSubjectTime.trim()) {
                          toast.error("Class time slot is required!");
                          return;
                        }
                        await addSubject();
                        toast.success(`Successfully added ${newSubjectName} to the schedule!`);
                        setShowAddTimeTableForm(false);
                      }}
                      className="bg-black text-white hover:bg-gray-900 font-extrabold px-8 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-xs md:text-sm cursor-pointer"
                    >
                      <PlusCircle size={15} />
                      Add to Time Table
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Class Selector Filter */}
              <div className="space-y-3 mb-8">
                <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Sliders size={12} />
                  Filter by Class Section
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setAdminTimetableClassFilter('All')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                      adminTimetableClassFilter === 'All'
                        ? "bg-black text-white border-black shadow-sm"
                        : "bg-white text-gray-500 hover:text-black border-gray-105"
                    )}
                  >
                    All Classes & Sections
                  </button>
                  {FIXED_CLASSES.map(cls => (
                    <button
                      key={cls}
                      onClick={() => setAdminTimetableClassFilter(cls)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                        adminTimetableClassFilter === cls
                          ? "bg-black text-white border-black shadow-sm"
                          : "bg-white text-gray-500 hover:text-black border-gray-105"
                      )}
                    >
                      Class {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Days */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {FIXED_DAYS.map(day => {
                  const daySubjects = subjects.filter(sub => {
                    const matchesDay = (sub.day || 'Monday') === day;
                    const matchesClass = adminTimetableClassFilter === 'All' || !sub.class || sub.class === 'All' || sub.class === adminTimetableClassFilter;
                    return matchesDay && matchesClass;
                  });

                  return (
                    <div key={day} className="bg-gray-50/50 p-5 rounded-[2rem] border border-gray-100 flex flex-col min-h-[300px] hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                        <span className="font-black text-xs uppercase tracking-widest text-gray-400">{day}</span>
                        <span className="bg-black/5 text-black font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                          {daySubjects.length} {daySubjects.length === 1 ? 'class' : 'classes'}
                        </span>
                      </div>

                      <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar">
                        {daySubjects.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center py-12 text-center my-auto">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No Lectures Scheduled</p>
                          </div>
                        ) : (
                          daySubjects.map(sub => (
                            <div key={sub.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative group hover:border-gray-200 transition-all">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <h4 className="font-bold text-xs text-gray-950 leading-snug">{sub.name}</h4>
                                  <span className={cn(
                                    "inline-block text-[8px] font-black uppercase tracking-widest mt-1 px-1.5 py-0.5 rounded border",
                                    !sub.class || sub.class === 'All'
                                      ? "bg-gray-50 text-gray-400 border-gray-150"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-150"
                                  )}>
                                    Class: {sub.class || 'All'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={cn(
                                    "text-[8px] font-black px-1.5 py-0.5 rounded capitalize border",
                                    sub.type === 'Practical' 
                                      ? 'bg-purple-50 text-purple-650 border-purple-100' 
                                      : 'bg-blue-50 text-blue-650 border-blue-100'
                                  )}>
                                    {sub.type || 'Theory'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete ${sub.name} from the timetable?`)) {
                                        removeSubject(sub.id);
                                        toast.success(`${sub.name} classroom schedule deleted successfully.`);
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-all"
                                    title="Unschedule Lecture"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-gray-50">
                                {/* Time slot edit */}
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1 flex items-center gap-1.5">
                                    <Clock size={10} /> Time Slot
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="e.g. 09:00 AM - 10:00 AM"
                                    className="bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all focus:ring-1 focus:ring-black focus:bg-white"
                                    value={sub.classTime || ''}
                                    onChange={(e) => updateSubject(sub.id, { classTime: e.target.value })}
                                  />
                                </div>

                                {/* Room edit */}
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Room No.</span>
                                  <input
                                    type="text"
                                    placeholder="TBA"
                                    className="bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all focus:ring-1 focus:ring-black focus:bg-white"
                                    value={sub.room || ''}
                                    onChange={(e) => updateSubject(sub.id, { room: e.target.value })}
                                  />
                                </div>

                                {/* Day rescheduling */}
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Reschedule Day</span>
                                  <select
                                    className="bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-all focus:ring-1 focus:ring-black focus:bg-white appearance-none"
                                    value={sub.day || 'Monday'}
                                    onChange={(e) => updateSubject(sub.id, { day: e.target.value })}
                                  >
                                    {FIXED_DAYS.map(d => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'hall-tickets' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Exam Schedule Management */}
            <div className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <Calendar size={20} className="text-emerald-500" />
                <h2 className="text-base md:text-lg font-bold">Exam Schedule Management</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {subjects.map((sub) => (
                  <div key={sub.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm md:text-base text-black">{sub.name}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Time</label>
                        <input
                          type="time"
                          className="w-full bg-white border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-black transition-all"
                          value={sub.examTime || ''}
                          onChange={(e) => updateSubject(sub.id, { examTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Room</label>
                        <input
                          type="text"
                          placeholder="Hall A"
                          className="w-full bg-white border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-black transition-all"
                          value={sub.room || ''}
                          onChange={(e) => updateSubject(sub.id, { room: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hall Ticket Generation */}
            <div className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-2">
                  <Ticket size={20} className="text-emerald-500" />
                  <h2 className="text-base md:text-lg font-bold">Generate Hall Tickets</h2>
                </div>
                
                <div className="flex items-center gap-3">
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-black transition-all"
                  >
                    <option value="All">All Classes</option>
                    {FIXED_CLASSES.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStudents.map((student) => (
                  <div key={student.docId} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-200 shrink-0">
                        {student.image ? (
                          <img src={student.image} alt={student.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate">{student.name}</h3>
                        <p className="text-[10px] text-gray-400 font-mono">{student.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200/50">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Class {student.class}</span>
                      <button
                        onClick={() => generateHallTicket(student)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-bold hover:scale-105 transition-all"
                      >
                        <Download size={12} />
                        Hall Ticket
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'notifications' && (
          <div className="xl:col-span-12 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Publisher Form Card */}
              <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-auto text-left">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone size={20} className="text-black animate-pulse animate-bounce" />
                    <h2 className="text-base md:text-lg font-bold">
                      {editingNotification ? 'Edit Exam Announcement' : 'Publish New Announcement'}
                    </h2>
                  </div>
                  
                  <p className="text-xs text-gray-400 mb-6 font-medium">
                    {editingNotification 
                      ? 'Modify the current exam alert detail. The update will sync instantly to landing & portals.'
                      : 'Draft a notification about upcoming timetables, holiday announcements, schedules, or hall tickets.'
                    }
                  </p>

                  <form onSubmit={handleAddNotification} id="notif-form" className="space-y-5">
                    <div>
                      <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">
                        Notice Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Second Term Practical Timetable"
                        value={newNotifTitle}
                        onChange={(e) => setNewNotifTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:ring-0 text-sm font-medium transition-all text-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">
                        Message Content
                      </label>
                      <textarea
                        rows={5}
                        placeholder="Detail the exam instructions, classes involved, classrooms, or online links..."
                        value={newNotifContent}
                        onChange={(e) => setNewNotifContent(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:ring-0 text-xs md:text-sm font-medium leading-relaxed transition-all text-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">
                        Target Audience
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'all', label: 'All Recipients' },
                          { value: 'students', label: 'Students' },
                          { value: 'parents', label: 'Parents' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setNewNotifAudience(option.value as any)}
                            className={cn(
                              "py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center",
                              newNotifAudience === option.value
                                ? "bg-black text-white border-black shadow-sm"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-50/50 border border-red-100 rounded-2xl">
                      <input
                        type="checkbox"
                        id="important-checkbox"
                        checked={newNotifImportant}
                        onChange={(e) => setNewNotifImportant(e.target.checked)}
                        className="rounded border-gray-300 text-red-500 focus:ring-red-400 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="important-checkbox" className="text-xs font-bold text-red-700 cursor-pointer select-none">
                        Mark as Urgent / Important
                      </label>
                    </div>
                  </form>
                </div>

                <div className="flex gap-2.5 mt-8 border-t border-gray-100 pt-5">
                  {editingNotification && (
                    <button
                      type="button"
                      onClick={handleCancelEditNotification}
                      className="flex-1 py-3 px-4 bg-gray-100 text-gray-505 font-bold text-xs md:text-sm rounded-xl hover:bg-gray-200 transition-all text-center"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    form="notif-form"
                    className="flex-1 py-3 px-4 bg-black text-white font-bold text-xs md:text-sm rounded-xl hover:opacity-95 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} />
                    {editingNotification ? 'Update Announcement' : 'Publish Alert'}
                  </button>
                </div>
              </div>

              {/* Published Board Card */}
              <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                      <Bell size={20} className="text-emerald-500" />
                      Notice Registry
                    </h2>
                    <p className="text-xs text-gray-400">Total notices: {notifications.length}</p>
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search alerts..."
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-250 rounded-lg focus:border-black focus:ring-0 focus:bg-white transition-all w-full sm:w-48 text-black"
                    />
                  </div>
                </div>

                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl text-gray-400">
                    <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No active declarations registered.</p>
                    <p className="text-[10px] mt-0.5">Use the left formulary block to publish your first announcement!</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                    {filteredNotifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                          notif.important 
                            ? 'border-red-100 bg-red-50/20' 
                            : 'border-gray-100 bg-gray-50/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {notif.important && (
                                <span className="bg-red-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Urgent
                                </span>
                              )}
                              {notif.audience === 'students' && (
                                <span className="bg-blue-50 text-blue-600 border border-blue-105 font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Students Only
                                </span>
                              )}
                              {notif.audience === 'parents' && (
                                <span className="bg-purple-50 text-purple-600 border border-purple-105 font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Parents Only
                                </span>
                              )}
                              {(notif.audience === 'all' || !notif.audience) && (
                                <span className="bg-gray-100 text-gray-500 border border-gray-200 font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  All Recipients
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-gray-400 font-semibold">{notif.date}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-gray-900 tracking-tight">{notif.title}</h4>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditNotificationSelect(notif)}
                              className="p-1 px-2 text-[10px] font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg flex items-center gap-0.5 transition-all"
                              title="Edit"
                            >
                              <Pencil size={11} />
                              <span className="sr-only sm:not-sr-only">Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteNotification(notif.id)}
                              className="p-1 px-2 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-0.5 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={11} />
                              <span className="sr-only sm:not-sr-only">Delete</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 leading-relaxed font-medium line-clamp-2 md:line-clamp-3 whitespace-pre-wrap">
                          {notif.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Admin Password Settings */}
            <div id="admin-settings" className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <Settings size={20} className="text-black" />
                <h2 className="text-base md:text-lg font-bold">Admin Settings</h2>
              </div>
              
              <div className="space-y-4 md:space-y-6">
                {/* Supabase Connection Status and Setup */}
                <div className="space-y-4 pb-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Supabase Database Integration</h3>
                    <div className="flex items-center gap-1.5">
                      {supabaseStatus?.isConnected ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl text-[10px] md:text-xs border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Supabase Live
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-xl text-[10px] md:text-xs border border-amber-200 flex items-center gap-1.5 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          Local Fallback Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 text-slate-800 rounded-2xl p-4 md:p-6 border border-slate-100 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center shrink-0 text-white shadow-md">
                        <Database size={20} />
                      </div>
                      <div className="space-y-1 flex-1">
                        <h4 className="font-bold text-xs md:text-sm text-slate-900">
                          Supabase Project: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">manshau cambus</code>
                        </h4>
                        <p className="text-[10px] md:text-xs text-slate-600 leading-relaxed">
                          Your entire student marksheet database is fully integrated with your Supabase Cloud cluster at <code className="bg-slate-200 px-1 py-0.5 rounded font-mono break-all">{SUPABASE_URL}</code>.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => syncFromSupabase(true)}
                        className={cn(
                          "px-3 py-2.5 bg-slate-950 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-850 active:scale-95 transition-all shadow-sm cursor-pointer border border-slate-950",
                          isSyncing && "opacity-50"
                        )}
                      >
                        <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] font-mono">
                      {[
                        { label: 'students', ok: supabaseStatus?.tablesVerified.students },
                        { label: 'subjects', ok: supabaseStatus?.tablesVerified.subjects },
                        { label: 'attendance', ok: supabaseStatus?.tablesVerified.attendance },
                        { label: 'notifications', ok: supabaseStatus?.tablesVerified.notifications },
                        { label: 'settings', ok: supabaseStatus?.tablesVerified.settings },
                      ].map((tbl) => (
                        <div key={tbl.label} className={cn(
                          "p-2 rounded-xl text-center border font-bold flex flex-col justify-center items-center gap-1 capitalize transition-all",
                          tbl.ok 
                            ? "bg-emerald-50/50 text-emerald-800 border-emerald-100" 
                            : "bg-amber-50/50 text-amber-800 border-amber-100"
                        )}>
                          <span className="text-[8px] uppercase font-bold text-gray-400 leading-none">{tbl.label}</span>
                          <span className="text-[10px] mt-0.5">{tbl.ok ? "🟢 Ready" : "🟡 Not Found"}</span>
                        </div>
                      ))}
                    </div>

                    {!supabaseStatus?.isConnected && (
                      <div className="bg-amber-50/80 text-amber-800 p-4 rounded-xl border border-amber-100 text-[10px] md:text-xs space-y-2 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold text-amber-950">
                          <AlertTriangle size={15} />
                          Supabase Schema Setup Needed
                        </div>
                        <p>
                          Your Supabase project is set up, but the corresponding PostgreSQL database tables (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">students</code>, <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">subjects</code>, etc.) do not exist yet or are empty.
                        </p>
                        <p className="font-bold">
                          To complete setup, please copy wait-free table creation code below and run it in your Supabase SQL Editor. This will enable immediate, dual-directional cloud synchronization!
                        </p>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-100 text-[10px] md:text-xs">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
                        <span className="font-mono text-slate-400 text-[9px] uppercase font-bold tracking-widest flex items-center gap-1">
                          <Database size={11} /> PostgreSQL Database Schema Setup
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
                            toast.success("SQL Schema Setup copied to clipboard!");
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-800 font-bold hover:bg-slate-700 active:scale-95 text-slate-300 rounded-md flex items-center gap-1 transition-all cursor-pointer border border-slate-700"
                        >
                          <Copy size={11} /> Copy SQL
                        </button>
                      </div>
                      <pre className="p-4 overflow-x-auto max-h-48 font-mono text-[9px] md:text-[10px] bg-slate-950 text-slate-300 select-all leading-normal">
                        {SUPABASE_SQL_SETUP}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Data Maintenance</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const DEFAULT_SUBJECTS: SubjectConfig[] = [
                          { id: '1', name: 'English', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Monday', classTime: '09:00 AM - 10:00 AM', examTime: '09:00 AM', room: '101' },
                          { id: '2', name: 'Maths', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Tuesday', classTime: '10:00 AM - 11:00 AM', examTime: '10:30 AM', room: '102' },
                          { id: '3', name: 'Science', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Wednesday', classTime: '11:15 AM - 12:15 PM', examTime: '01:00 PM', room: '103' },
                          { id: '4', name: 'Social', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Thursday', classTime: '12:15 PM - 01:15 PM', examTime: '02:30 PM', room: '104' },
                          { id: '5', name: 'Computer', maxMarks: 100, passMarks: 35, type: 'Theory', day: 'Friday', classTime: '02:00 PM - 03:00 PM', examTime: '04:00 PM', room: 'Lab 1' },
                        ];
                        try {
                          for (const sub of DEFAULT_SUBJECTS) {
                            await dbSave('subjects', sub.id, sub);
                          }
                          toast.success("Default subjects seeded successfully!");
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, 'subjects');
                        }
                      }}
                      className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-2.5 md:py-3 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-xs md:text-sm cursor-pointer"
                    >
                      <Plus size={18} />
                      Seed Default Subjects
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearAllModal(true)}
                      className="w-full bg-rose-50/50 border border-rose-200 hover:bg-rose-100/50 text-rose-600 font-bold py-2.5 md:py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs md:text-sm cursor-pointer shadow-sm"
                    >
                      <Trash2 size={18} className="text-rose-500" />
                      Remove All Students Data
                    </button>
                  </div>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Update Password</h3>
                  <form onSubmit={handleChangePassword} className="space-y-3 md:space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Enter new password"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="w-full bg-black text-white font-bold py-2.5 md:py-3 rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs md:text-sm"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>

                <div className="space-y-3 md:space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Exam Center Configuration</h3>
                  <div className="space-y-1">
                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Center Name</label>
                    <input
                      type="text"
                      placeholder="e.g. MAIN CAMPUS CENTER"
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all"
                      value={examCenter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExamCenter(val);
                        updateSettings({ examCenter: val });
                      }}
                    />
                    <p className="text-[9px] text-gray-400 ml-1 italic">This name will appear on all Hall Tickets.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'results' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Subject Management Option Bar */}
            <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black text-white rounded-xl">
                  <BookOpen size={18} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm md:text-base text-gray-900">Subject structures & Rules</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Configure Subject Maximum Marks & Passing Marks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubjectConfigPanel(!showSubjectConfigPanel)}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Settings size={14} className={showSubjectConfigPanel ? "animate-spin" : ""} />
                {showSubjectConfigPanel ? "Close Subject Settings" : "Open Subject Settings"}
              </button>
            </div>

            {showSubjectConfigPanel && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-top-4 duration-300">
                {/* Add Subject Section */}
                <div className="lg:col-span-5 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4 text-left">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <Plus size={18} className="text-black" />
                    <h3 className="font-black text-xs uppercase tracking-wider">Add New Subject Option</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Subject Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Physics"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-black transition-all font-semibold"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Select Class</label>
                      <select
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-black transition-all font-semibold cursor-pointer"
                        value={newSubjectClass}
                        onChange={(e) => setNewSubjectClass(e.target.value)}
                      >
                        <option value="All">All Classes</option>
                        {FIXED_CLASSES.map(cls => (
                          <option key={cls} value={cls}>Class {cls}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Max Marks</label>
                        <input
                          type="number"
                          placeholder="100"
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-black transition-all font-mono font-bold"
                          value={newSubjectMax}
                          onChange={(e) => setNewSubjectMax(parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Pass Marks</label>
                        <input
                          type="number"
                          placeholder="35"
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-black transition-all font-mono font-bold"
                          value={newSubjectPass}
                          onChange={(e) => setNewSubjectPass(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addSubject}
                      className="w-full px-4 py-3 bg-black text-white hover:bg-gray-800 transition-all rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-black/10 cursor-pointer"
                    >
                      Register Subject
                    </button>
                  </div>
                </div>

                {/* Edit Subject Passmarks & Max Marks Section */}
                <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4 text-left">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <Settings size={18} className="text-black" />
                    <h3 className="font-black text-xs uppercase tracking-wider">Configure Passing Criteria</h3>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3 scrollbar-hide">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 relative">
                        <div className="flex-1">
                          <span className="font-bold text-xs text-gray-900 block">{sub.name}</span>
                          <span className="text-[9px] text-gray-450 font-bold block mt-0.5 bg-gray-100 border border-gray-200 rounded-md px-1 py-0.5 max-w-max text-gray-500 text-[8px] uppercase tracking-wider">
                            {!sub.class || sub.class === 'All' ? 'All Classes' : `Class ${sub.class}`}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                          <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 min-w-[60px]">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-wider">Class</span>
                            <select
                              className="bg-transparent border-none p-0 text-left text-[10px] font-bold focus:ring-0 cursor-pointer text-gray-750"
                              value={sub.class || 'All'}
                              onChange={(e) => updateSubject(sub.id, { class: e.target.value })}
                            >
                              <option value="All">All</option>
                              {FIXED_CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-wider">Max</span>
                            <input
                              type="number"
                              className="bg-transparent border-none p-0 text-center text-xs font-bold font-mono focus:ring-0"
                              value={sub.maxMarks}
                              onChange={(e) => updateSubject(sub.id, { maxMarks: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-wider">Pass</span>
                            <input
                              type="number"
                              className="bg-transparent border-none p-0 text-center text-xs font-bold font-mono focus:ring-0"
                              value={sub.passMarks}
                              onChange={(e) => updateSubject(sub.id, { passMarks: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${sub.name}?`)) {
                              removeSubject(sub.id);
                            }
                          }}
                          className="absolute md:relative right-3 top-3 md:top-auto md:right-auto text-gray-400 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Record Results Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-5">
                <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                    <Search size={20} className="text-black" />
                    <h2 className="text-base md:text-lg font-bold">Student Lookup</h2>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        list="student-ids-list"
                        placeholder="Select or Enter Student ID"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-black transition-all"
                        value={resultSearchId}
                        onChange={(e) => setResultSearchId(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && findStudentById()}
                      />
                      <datalist id="student-ids-list">
                        {Array.from(new Set(students.map(s => s.id))).map(id => {
                          const student = students.find(s => s.id === id);
                          return (
                            <option key={id} value={id}>
                              {student?.name} ({student?.class})
                            </option>
                          );
                        })}
                      </datalist>
                    </div>
                    <button
                      onClick={findStudentById}
                      className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 active:scale-95 transition-all shadow-lg shadow-black/10"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {foundStudentProfile && (
                  <div className="mt-6 bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden shadow-inner shrink-0">
                        {foundStudentProfile.image ? (
                          <img src={foundStudentProfile.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm md:text-base">{foundStudentProfile.name}</h3>
                        <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">{foundStudentProfile.class} - Section {foundStudentProfile.section}</p>
                      </div>
                    </div>

                    <form onSubmit={handleRecordResults} className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Exam Type</label>
                        <select
                          required
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-black transition-all"
                          value={resultExamType}
                          onChange={(e) => setResultExamType(e.target.value)}
                        >
                          {FIXED_EXAMS.map(exam => (
                            <option key={exam} value={exam}>{exam}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                        {(() => {
                          const studentClass = foundStudentProfile?.class;
                          const filteredSubjectsByClass = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === studentClass);
                          return filteredSubjectsByClass.map((sub) => (
                            <div key={sub.id} className="p-2.5 rounded-xl border bg-white border-black/5 shadow-sm space-y-2 text-left">
                              <div className="flex justify-between items-center gap-1">
                                <div className="flex flex-col min-w-0">
                                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest truncate">{sub.name}</label>
                                  <span className="text-[8px] text-gray-400 font-bold font-mono">Max: {sub.maxMarks} | Pass: {sub.passMarks}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = resultMarks[sub.id];
                                    setResultMarks({ ...resultMarks, [sub.id]: current === 'A' ? 0 : 'A' });
                                  }}
                                  className={cn(
                                    "text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0",
                                    resultMarks[sub.id] === 'A' ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-400"
                                  )}
                                >
                                  ABSENT
                                </button>
                              </div>
                              <input
                                type="text"
                                className="w-full bg-gray-50 border-none rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-black transition-all"
                                placeholder="Score or A"
                                value={resultMarks[sub.id] === undefined ? '' : resultMarks[sub.id]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.toUpperCase() === 'A') {
                                    setResultMarks({ ...resultMarks, [sub.id]: 'A' });
                                  } else if (val === '') {
                                    setResultMarks({ ...resultMarks, [sub.id]: 0 });
                                  } else {
                                    const num = parseInt(val);
                                    setResultMarks({ ...resultMarks, [sub.id]: isNaN(num) ? 0 : num });
                                  }
                                }}
                              />
                            </div>
                          ));
                        })()}
                      </div>

                      <button
                        type="submit"
                        disabled={isUpdatingResults}
                        className="w-full bg-black text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl hover:bg-gray-900 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50 text-xs md:text-sm"
                      >
                        {isUpdatingResults ? 'Recording...' : 'Record Exam Result to Sheet'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7">
                {/* Table Section */}
                <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 md:p-6 border-bottom border-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <FileText size={20} className="text-gray-400" />
                      <h2 className="text-base md:text-lg font-bold">Marklist Data</h2>
                    </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto">
                  <div className="relative hidden md:block">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name or ID..."
                      className="bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-black transition-all w-48"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="flex-1 sm:flex-none bg-gray-50 border-none rounded-xl px-3 py-2 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-black transition-all"
                  >
                    <option value="All">All Classes</option>
                    {FIXED_CLASSES.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => exportToPDF()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-[10px] md:text-xs font-bold hover:scale-105 transition-all"
                  >
                    <Download size={14} />
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Mobile Search Bar */}
              <div className="px-4 pb-4 md:hidden">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name or ID..."
                    className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-black transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-hide -mx-4 md:mx-0">
                <table className="w-full text-left border-collapse min-w-[800px] xl:min-w-0">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">ID</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Photo</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Name</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Class/Sec</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Marks</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center whitespace-nowrap">Total</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center whitespace-nowrap">%</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center whitespace-nowrap">Grade</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center whitespace-nowrap">Result</th>
                      <th className="px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-amber-50 text-amber-600 rounded-full">
                              <Settings size={32} />
                            </div>
                            <div>
                              <p className="text-amber-800 font-bold">No Subjects Configured</p>
                              <p className="text-amber-600 text-sm">Please use the "Seed Default Subjects" button in Admin Settings to begin.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">
                          No student records found. Add a student to begin.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.docId} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-3 md:px-6 py-4">
                            <span className="font-mono text-[9px] md:text-[10px] bg-gray-100 text-gray-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md font-bold border border-gray-200/50 shadow-sm">
                              {student.id}
                            </span>
                          </td>
                          <td className="px-3 md:px-6 py-4">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                              {student.image ? (
                                <img src={student.image} alt={student.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <User size={14} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-xs md:text-sm">{student.name}</span>
                              <span className="text-[8px] md:text-[10px] text-gray-400 font-medium uppercase tracking-wider">{student.examType}</span>
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[10px] md:text-sm text-gray-700">{student.class}</span>
                              <span className="text-[8px] md:text-[10px] text-gray-400 font-bold">SEC {student.section || '-'}</span>
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px] md:max-w-none">
                              {subjects.filter(sub => student.marks[sub.id] !== undefined).map(sub => {
                                const score = student.marks[sub.id];
                                const isAbsent = score === 'A';
                                const isPass = !isAbsent && (score || 0) >= sub.passMarks;
                                return (
                                  <span key={sub.id} className={cn(
                                    "text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded uppercase font-bold",
                                    isAbsent ? "bg-rose-100 text-rose-600" :
                                    isPass ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                  )}>
                                    {sub.name.slice(0, 3)}: {isAbsent ? 'A' : score || 0}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-4 text-center font-bold text-xs md:text-sm">{student.total} <span className="text-[8px] md:text-[10px] text-gray-400">/ {student.maxPossibleTotal}</span></td>
                          <td className="px-3 md:px-6 py-4 text-center text-[10px] md:text-sm text-gray-500">{student.percentage.toFixed(1)}%</td>
                          <td className="px-3 md:px-6 py-4 text-center">
                            <span className={cn(
                              "px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-xs font-bold",
                              student.grade === 'A+' ? "bg-emerald-100 text-emerald-700" :
                              student.grade === 'A' ? "bg-blue-100 text-blue-700" :
                              student.grade === 'F' ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-700"
                            )}>
                              {student.grade}
                            </span>
                          </td>
                          <td className="px-3 md:px-6 py-4 text-center">
                            <span className={cn(
                              "text-[9px] md:text-xs font-bold uppercase tracking-widest",
                              student.result === 'Pass' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {student.result}
                            </span>
                          </td>
                          <td className="px-3 md:px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2">
                              <button
                                onClick={() => generateHallTicket(student)}
                                className="p-1.5 md:p-2 text-gray-300 hover:text-emerald-600 transition-colors"
                                title="Download Hall Ticket"
                              >
                                <FileText size={16} className="md:w-[18px] md:h-[18px]" />
                              </button>
                              <button
                                onClick={() => setEditingStudent(student)}
                                className="p-1.5 md:p-2 text-gray-300 hover:text-black transition-colors"
                                title="Edit Student"
                              >
                                <Pencil size={16} className="md:w-[18px] md:h-[18px]" />
                              </button>
                              <button
                                onClick={() => removeStudent(student.docId || student.id)}
                                className="p-1.5 md:p-2 text-gray-300 hover:text-rose-600 transition-colors"
                                title={student.examType === 'REGISTRATION' ? "Delete Student Profile" : "Remove Exam Result"}
                              >
                                <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
      </div>
    )}
  </div>
</div>
</div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] w-full max-w-2xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 bg-black text-white rounded-xl md:rounded-2xl">
                  <Pencil size={20} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">Edit Student</h3>
                  <p className="text-gray-500 text-[10px] md:text-sm">Update details for {editingStudent.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingStudent(null)}
                className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Student ID (Read Only)</label>
                  <input
                    type="text"
                    disabled
                    className="w-full bg-gray-50 border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm text-gray-400 cursor-not-allowed"
                    value={editingStudent.id}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-gray-50 border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Class</label>
                  <select
                    className="w-full bg-gray-50 border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all appearance-none"
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                  >
                    {FIXED_CLASSES.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Exam Type (Read Only)</label>
                  <input
                    type="text"
                    disabled
                    className="w-full bg-gray-50 border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm text-gray-400 cursor-not-allowed"
                    value={editingStudent.examType}
                  />
                </div>
                <div className="space-y-3 md:col-span-2 border-t border-gray-100 pt-4 text-left">
                  <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Student Photo</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 bg-gray-50/50 p-3.5 rounded-[1.25rem] border border-gray-100">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 shrink-0">
                      {editingStudent.image ? (
                        <img src={editingStudent.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={20} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 w-full flex flex-col gap-2.5">
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer bg-white hover:bg-gray-50 transition-colors rounded-xl px-4 py-2 text-xs font-semibold text-gray-650 text-gray-500 border border-gray-250 flex items-center justify-center shadow-sm cursor-pointer">
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoFileChange(e, (adjusted) => setEditingStudent({ ...editingStudent, image: adjusted }))}
                          />
                        </label>
                        {editingStudent.image && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoAdjustSrc(editingStudent.image || '');
                              setOnPhotoAdjustSave(() => (adjusted) => {
                                setEditingStudent(prev => prev ? { ...prev, image: adjusted } : null);
                              });
                            }}
                            className="px-3.5 py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="Adjust Photo"
                          >
                            <Sliders size={13} />
                            <span>Adjust</span>
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Or paste Direct Photo URL..."
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-black transition-all font-semibold font-sans shadow-sm"
                          value={editingStudent.image || ''}
                          onChange={(e) => setEditingStudent({ ...editingStudent, image: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Subject Marks</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {(() => {
                    const studentClass = editingStudent?.class;
                    const filteredSubjectsByClass = subjects.filter(sub => !sub.class || sub.class === 'All' || sub.class === studentClass);
                    return filteredSubjectsByClass.map((sub) => (
                      <div key={sub.id} className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl space-y-1.5 md:space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] md:text-xs font-bold text-gray-600">{sub.name}</label>
                        </div>
                        <input
                          type="text"
                          placeholder="0-100 or A"
                          className="w-full bg-white border-none rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm focus:ring-2 focus:ring-black transition-all"
                          value={editingStudent.marks[sub.id] === 'A' ? 'A' : (editingStudent.marks[sub.id] || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const marks = { ...editingStudent.marks };
                            if (val.toUpperCase() === 'A') {
                              marks[sub.id] = 'A';
                            } else if (val === '') {
                              marks[sub.id] = 0;
                            } else {
                              const num = parseInt(val);
                              marks[sub.id] = isNaN(num) ? 0 : num;
                            }
                            setEditingStudent({ ...editingStudent, marks });
                          }}
                        />
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 px-4 md:px-6 py-3 md:py-4 bg-gray-100 text-gray-600 font-bold rounded-xl md:rounded-2xl hover:bg-gray-200 transition-all text-xs md:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStudent}
                  className="flex-1 px-4 md:px-6 py-3 md:py-4 bg-black text-white font-bold rounded-xl md:rounded-2xl hover:scale-[1.02] transition-all shadow-xl shadow-black/10 disabled:opacity-50 text-xs md:text-sm"
                >
                  {isUpdatingStudent ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (() => {
        const targetDeleteStudent = students.find(s => s.docId === studentToDelete || s.id === studentToDelete);
        const isExam = targetDeleteStudent && targetDeleteStudent.examType !== 'REGISTRATION';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle size={32} className="text-rose-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {isExam ? 'Remove Exam Result?' : 'Delete Student?'}
                </h3>
                <p className="text-gray-500 mb-8">
                  {isExam 
                    ? `Are you sure you want to remove the exam result (${targetDeleteStudent?.examType}) for ${targetDeleteStudent?.name}? This action cannot be undone and these marks will be permanently deleted.`
                    : `Are you sure you want to remove the student profile for ${targetDeleteStudent?.name || 'this student'}? This action will permanently delete their profile and all of their recorded exam results.`}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setStudentToDelete(null)}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteStudent}
                    className="flex-1 px-6 py-4 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clear All Students Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={32} className="text-rose-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">
                Remove All Student Data?
              </h3>
              <p className="text-gray-500 text-xs md:text-sm mb-6 leading-relaxed">
                This is a highly destructive action. It will permanently delete ALL student profiles, results, and attendance records. This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  disabled={isClearingAll}
                  className="flex-1 px-5 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-xs md:text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAllStudentData}
                  disabled={isClearingAll}
                  className="flex-1 px-5 py-3.5 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isClearingAll ? 'Removing...' : 'Yes, Delete All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {photoAdjustSrc && onPhotoAdjustSave && (
        <PhotoAdjusterModal
          src={photoAdjustSrc}
          onSave={(adjusted) => {
            onPhotoAdjustSave(adjusted);
            setPhotoAdjustSrc(null);
            setOnPhotoAdjustSave(null);
          }}
          onClose={() => {
            setPhotoAdjustSrc(null);
            setOnPhotoAdjustSave(null);
          }}
        />
      )}
    </>
  );
}
