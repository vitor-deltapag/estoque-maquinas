import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Privilegiado: cria/apaga users no Auth. Nunca usar para login de utilizador.
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin: Client | None = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    supabase_admin = None

SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Mesmo papel da chave do browser: sign_in_with_password em POST /login.
if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase_anon: Client | None = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
else:
    supabase_anon = None
