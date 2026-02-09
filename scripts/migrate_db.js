const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    console.log('Adding has_enrichment column to comments table...');
    const { data, error } = await supabase.rpc('run_sql', {
        sql_command: 'ALTER TABLE comments ADD COLUMN IF NOT EXISTS has_enrichment BOOLEAN DEFAULT false;'
    });

    if (error) {
        if (error.message.includes('not found')) {
            console.log('RPC "run_sql" not found. This is expected if it was not created.');
            console.log('Skipping database schema change via RPC. Please add the column manually if needed.');
        } else {
            console.error('Error adding column:', error);
        }
    } else {
        console.log('Column added successfully (or already exists).');
    }
}

run();
