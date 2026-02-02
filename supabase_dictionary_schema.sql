-- Dictionaries table (metadata for books)
create table public.dictionaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text check (type in ('system', 'user')) default 'user',
  is_public boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) -- if null, it's a system dictionary valid for all, or we use public flag
);

-- Dictionary Entries table (the actual words)
create table public.dictionary_entries (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid references public.dictionaries(id) on delete cascade not null,
  word text not null,
  definition text, -- Basic definition string for quick display
  detail jsonb, -- Rich data: { "phonetic": "...", "examples": [{ "en": "...", "zh": "..." }] }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast lookup by word (though usually we fetch all words for a dictionary to frontend)
create index idx_dictionary_entries_dictionary_id on public.dictionary_entries(dictionary_id);
create index idx_dictionary_entries_word on public.dictionary_entries(word);

-- Enable RLS
alter table public.dictionaries enable row level security;
alter table public.dictionary_entries enable row level security;

-- Policies for dictionaries
-- Everyone can read system dictionaries or public ones
create policy "Dictionaries are viewable by everyone if public or system"
  on public.dictionaries for select
  using (is_public = true or type = 'system' or auth.uid() = user_id);

-- User can create their own dictionary
create policy "Users can insert their own dictionaries"
  on public.dictionaries for insert
  with check (auth.uid() = user_id);

-- Policies for entries
-- Entries are viewable if the dictionary is viewable
create policy "Entries are viewable if dictionary is accessible"
  on public.dictionary_entries for select
  using (
    exists (
      select 1 from public.dictionaries d
      where d.id = dictionary_entries.dictionary_id
      and (d.is_public = true or d.type = 'system' or d.user_id = auth.uid())
    )
  );

-- Helper function to get simple word list for a dictionary (lighter payload for frontend cache)
create or replace function get_dictionary_words(dict_id uuid)
returns table (word text)
language sql
security definer
as $$
  select word from public.dictionary_entries
  where dictionary_id = dict_id;
$$;
