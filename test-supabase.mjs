import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cpcmkcjddqpkhjhvugto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwY21rY2pkZHFwa2hqaHZ1Z3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNjk0ODEsImV4cCI6MjA5Nzk0NTQ4MX0._uYIYqgVffk0QvBZpSFf6PQ1rO6Ik5kTiCtcMBli424";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: reports } = await supabase.from('reports').select('id').limit(1);
  if (!reports || reports.length === 0) {
    console.log("No reports found to update.");
    return;
  }
  const reportId = reports[0].id;
  console.log("Attempting to update report:", reportId);
  
  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'Reported' })
    .eq('id', reportId)
    .select()
    .single();

  console.log("Update Error:", error);
  console.log("Update Data:", data);
}

test();
