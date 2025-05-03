import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kubocyhvejzgsisihhrt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Ym9jeWh2ZWp6Z3Npc2loaHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNzc4ODMsImV4cCI6MjA2MTc1Mzg4M30.fuvRFzX9ju0rmcJ-ZiVKbGedL8-xPXEWxcPK5VShpiE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 