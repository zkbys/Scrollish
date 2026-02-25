import os

def get_env_map(env_path):
    env_map = {}
    if not os.path.exists(env_path):
        return env_map
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                env_map[k.strip()] = v.strip()
    return env_map

# 绝对路径
base_path = r'c:\scrollish\scrollish\scrollish-new'
env_path = os.path.join(base_path, '.env')
env_map = get_env_map(env_path)

VITE_SUPABASE_URL = env_map.get("VITE_SUPABASE_URL")
VITE_SUPABASE_ANON_KEY = env_map.get("VITE_SUPABASE_ANON_KEY")

if not VITE_SUPABASE_URL or not VITE_SUPABASE_ANON_KEY:
    print("FATAL: Missing env vars in .env")
    exit(1)

from supabase import create_client
supabase = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

tables = ["achievements", "subtree_vibes", "level_config", "posts_enrichment", "comments_enrichment"]

for table in tables:
    print(f"\n[Table: {table}]")
    try:
        # Try fetching columns by querying an empty select
        res = supabase.table(table).select("*").limit(1).execute()
        if res.data and len(res.data) > 0:
            print("Columns Found:", list(res.data[0].keys()))
        else:
            print("No data found, columns unknowable via select *.")
    except Exception as e:
        print(f"Error: {e}")
