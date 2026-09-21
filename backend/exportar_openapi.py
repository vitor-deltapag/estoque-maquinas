import json
from main import app

def gerar_openapi():
    # Extrai a estrutura OpenAPI diretamente do FastAPI
    esquema_openapi = app.openapi()
    
    # Cria o arquivo openapi.json e escreve os dados nele
    with open("openapi.json", "w", encoding="utf-8") as arquivo:
        json.dump(esquema_openapi, arquivo, indent=2, ensure_ascii=False)
        
    print("✅ Arquivo openapi.json gerado/atualizado com sucesso!")

if __name__ == "__main__":
    gerar_openapi()