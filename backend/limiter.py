from slowapi import Limiter
from slowapi.util import get_remote_address

# Sem default_limits: só rotas com @limiter.limit (hoje: POST /login).
limiter = Limiter(key_func=get_remote_address, default_limits=[])
