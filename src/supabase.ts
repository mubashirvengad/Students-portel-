// Supabase REST Client with Local Offline Fallback
import { StudentMarks, SubjectConfig, ExamNotification } from './types';

export const SUPABASE_URL = "https://ezlyvvvinkunehnifqna.supabase.co/rest/v1";
export const SUPABASE_KEY = "sb_publishable_cLXkut9XQZT4sxbj_PfMQA_UVa62FJ9";

const getHeaders = () => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
});

export interface SupabaseConfigStatus {
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
}

// Check database table existence and access
export async function checkSupabaseConnection(): Promise<SupabaseConfigStatus> {
  const status: SupabaseConfigStatus = {
    isConnected: false,
    checkedAt: new Date().toLocaleTimeString(),
    error: null,
    tablesVerified: {
      students: false,
      subjects: false,
      attendance: false,
      notifications: false,
      settings: false,
    }
  };

  try {
    // We try to fetch 1 row from each table to verify its schema/existence
    const verifyTable = async (table: string) => {
      const resp = await fetch(`${SUPABASE_URL}/${table}?limit=1`, {
        method: 'GET',
        headers: getHeaders()
      });
      return resp.ok;
    };

    const results = await Promise.allSettled([
      verifyTable('students'),
      verifyTable('subjects'),
      verifyTable('attendance'),
      verifyTable('notifications'),
      verifyTable('settings')
    ]);

    status.tablesVerified.students = results[0].status === 'fulfilled' && results[0].value;
    status.tablesVerified.subjects = results[1].status === 'fulfilled' && results[1].value;
    status.tablesVerified.attendance = results[2].status === 'fulfilled' && results[2].value;
    status.tablesVerified.notifications = results[3].status === 'fulfilled' && results[3].value;
    status.tablesVerified.settings = results[4].status === 'fulfilled' && results[4].value;

    const anyWorking = Object.values(status.tablesVerified).some(v => v);
    status.isConnected = anyWorking;

    if (!anyWorking) {
      status.error = "Could not reach any tables. Please check if they are created in your Supabase SQL Editor.";
    }
  } catch (err: any) {
    status.isConnected = false;
    status.error = err.message || "Failed to contact Supabase REST API server.";
  }

  return status;
}

// SQL Template instructions to copy into their Supabase dashboard
export const SUPABASE_SQL_SETUP = `-- Copy and execute this SQL in your Supabase SQL Editor
-- This ensures all columns match the application models perfectly!

-- 1. Create subjects table
create table if not exists subjects (
  "id" text primary key,
  "name" text not null,
  "maxMarks" integer not null,
  "passMarks" integer not null,
  "type" text,
  "examDate" text,
  "examTime" text,
  "room" text,
  "class" text
);

-- Enable RLS & Select/Insert permissions
alter table subjects enable row level security;
create policy "Allow public read subjects" on subjects for select using (true);
create policy "Allow public edit subjects" on subjects for all using (true) with check (true);

-- 2. Create students table (Profile & Marks cache)
create table if not exists students (
  "docId" text primary key,
  "id" text not null,
  "studentId" text,
  "name" text not null,
  "class" text not null,
  "section" text,
  "examType" text,
  "marks" jsonb,
  "image" text,
  "hallTicketAvailable" boolean default false
);

alter table students enable row level security;
create policy "Allow public read students" on students for select using (true);
create policy "Allow public edit students" on students for all using (true) with check (true);

-- 3. Create attendance table
create table if not exists attendance (
  "id" text primary key,
  "studentId" text not null,
  "studentName" text not null,
  "studentClass" text not null,
  "date" text not null,
  "status" text not null
);

alter table attendance enable row level security;
create policy "Allow public read attendance" on attendance for select using (true);
create policy "Allow public edit attendance" on attendance for all using (true) with check (true);

-- 4. Create notifications table
create table if not exists notifications (
  "id" text primary key,
  "title" text not null,
  "content" text not null,
  "date" text not null,
  "important" boolean default false,
  "audience" text default 'all'
);

alter table notifications enable row level security;
create policy "Allow public read notifications" on notifications for select using (true);
create policy "Allow public edit notifications" on notifications for all using (true) with check (true);

-- 5. Create settings table
create table if not exists settings (
  "id" text primary key,
  "adminPassword" text default '1234',
  "examCenter" text default 'MANSHAU CAMPUS MAIN CENTER',
  "subjectTypes" jsonb,
  "resultsPublished" boolean default false
);

alter table settings enable row level security;
create policy "Allow public read settings" on settings for select using (true);
create policy "Allow public edit settings" on settings for all using (true) with check (true);

-- Insert seed config
insert into settings ("id", "adminPassword", "examCenter", "subjectTypes")
values ('admin', '1234', 'MANSHAU CAMPUS MAIN CENTER', '["Theory", "Practical", "Internal", "Other"]')
on conflict ("id") do nothing;
`;

// Helper: Fetch all records from a Supabase table
export async function fetchFromSupabase<T>(table: string): Promise<T[]> {
  const resp = await fetch(`${SUPABASE_URL}/${table}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch ${table} from Supabase: ${resp.statusText}`);
  }

  return resp.json();
}

// Helper: Upsert record to Supabase table
export async function upsertToSupabase(table: string, primaryKeyField: string, data: any): Promise<void> {
  // PostgREST upsert requires Prefer: resolution=merge-duplicates
  const resp = await fetch(`${SUPABASE_URL}/${table}`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify(data)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to upsert ${table}: ${text || resp.statusText}`);
  }
}

// Helper: Delete record from Supabase table
export async function deleteFromSupabase(table: string, primaryKeyField: string, value: string): Promise<void> {
  const resp = await fetch(`${SUPABASE_URL}/${table}?${primaryKeyField}=eq.${encodeURIComponent(value)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to delete from ${table}: ${text || resp.statusText}`);
  }
}
