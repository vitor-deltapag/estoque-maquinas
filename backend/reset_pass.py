"""Script local. Credenciais só no .env (ADMIN_RESET_EMAIL / ADMIN_RESET_PASSWORD)."""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def reset_admin_password():
    email_alvo = (os.environ.get("ADMIN_RESET_EMAIL") or "").strip()
    nova_senha = os.environ.get("ADMIN_RESET_PASSWORD") or ""
    if not email_alvo or not nova_senha:
        print("Defina ADMIN_RESET_EMAIL e ADMIN_RESET_PASSWORD no .env")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta")
        sys.exit(1)

    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    usuarios = supabase_admin.auth.admin.list_users()

    for user in usuarios:
        if user.email == email_alvo:
            try:
                supabase_admin.auth.admin.update_user_by_id(
                    user.id,
                    {"password": nova_senha},
                )
                print(f"Senha redefinida para {email_alvo}")
                return
            except Exception:
                print("Erro ao atualizar senha")
                sys.exit(1)

    print("Usuário não encontrado.")
    sys.exit(1)


if __name__ == "__main__":
    reset_admin_password()
