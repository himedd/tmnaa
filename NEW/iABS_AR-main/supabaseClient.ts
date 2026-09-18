import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mqegvdtuyqglxjqakfha.supabase.co';
const supabaseKey = 'sb_publishable_mcxu0guthgq1U5w97JdKUQ_zaG9H8wa';

export const supabase = createClient(supabaseUrl, supabaseKey);
