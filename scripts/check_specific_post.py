import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

res = supabase.table("production_posts").select("id, enrichment_status, sentence_segments").eq("id", "449ddbf1-bd2f-4757-b65c-efd61202c66f").execute()
print(res.data)
