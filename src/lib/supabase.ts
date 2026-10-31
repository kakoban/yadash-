import { createClient } from '@supabase/supabase-js';
import { Entry } from '../types';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || 'https://pybofuhhevqarmphgyhg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ym9mdWhoZXZxYXJtcGhneWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDU5OTQsImV4cCI6MjA5ODAyMTk5NH0.HJQ2w3bH2VqyWTU74sCVeNPyszSfLeIbYsEVZPcWiJ0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TABLE_NAME = 'roozneveshte_entries';

export const SQL_SCHEMA_STATEMENT = `-- Run this in your Supabase SQL Editor to update the table for authentication!
create table if not exists ${TABLE_NAME} (
  id text primary key,
  user_id uuid references auth.users(id) default auth.uid(),
  type text not null,
  title text,
  body text not null,
  tags text[] not null default '{}',
  created_at bigint not null,
  pinned boolean default false
);

-- In case table already exists, add pinned
alter table ${TABLE_NAME} add column if not exists pinned boolean default false;

-- In case table already exists, add user_id
alter table ${TABLE_NAME} add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- Enable RLS
alter table ${TABLE_NAME} enable row level security;

-- Drop the old public policy if it exists
drop policy if exists "Allow public read and write access" on ${TABLE_NAME};
drop policy if exists "Users can select their own entries" on ${TABLE_NAME};
drop policy if exists "Users can insert their own entries" on ${TABLE_NAME};
drop policy if exists "Users can update their own entries" on ${TABLE_NAME};
drop policy if exists "Users can delete their own entries" on ${TABLE_NAME};

create policy "Users can select their own entries"
on ${TABLE_NAME} for select
using ( auth.uid() = user_id );

create policy "Users can insert their own entries"
on ${TABLE_NAME} for insert
with check ( auth.uid() = user_id );

create policy "Users can update their own entries"
on ${TABLE_NAME} for update
using ( auth.uid() = user_id );

create policy "Users can delete their own entries"
on ${TABLE_NAME} for delete
using ( auth.uid() = user_id );
`;

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from(TABLE_NAME).select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST205') {
        // Table does not exist
        return false;
      }
      console.warn("Supabase connection test error:", error);
      return false; // Safely fail on any error
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchAllEntries(): Promise<{ data: Entry[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const mappedData: Entry[] = (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title || '',
      body: row.body,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: Number(row.created_at),
      pinned: !!row.pinned,
    }));

    return { data: mappedData, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function insertEntry(entry: Entry): Promise<{ error: any }> {
  try {
    const { error } = await supabase.from(TABLE_NAME).insert([
      {
        id: entry.id,
        type: entry.type,
        title: entry.title || '',
        body: entry.body,
        tags: entry.tags || [],
        created_at: entry.createdAt,
        pinned: !!entry.pinned,
      },
    ]);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

export async function updateEntry(entry: Entry): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        type: entry.type,
        title: entry.title || '',
        body: entry.body,
        tags: entry.tags || [],
        pinned: !!entry.pinned,
      })
      .eq('id', entry.id);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

export async function deleteEntry(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    return { error };
  } catch (err) {
    return { error: err };
  }
}
