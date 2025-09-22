# Agribusiness Dashboard

Aplicação de visualização agrícola desenvolvida em FastAPI e React, com autenticação via JWT (se necessário), CRUD de dados básicos via seed, proteção CORS, logs, validações simples de segurança e documentação Swagger.

### Tecnologias

    - Python 3.10+ (FastAPI)
    - SQLite (via Docker volume)
    - React + Vite
    - Chart.js
    - Swagger (OpenAPI)
    - Docker Compose


## Configuração e Execução

### Clonar o repositório

```bash
git clone https://github.com/rebekaodilon/agribusiness-dashboard.git
cd agribusiness-dashboard
```

### Criar o arquivo `.env` do backend
Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```

### Criar o arquivo `.env` do frontend
Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```

## Subir containers com Docker
Na raiz do backend:
```bash
docker compose up -d --build
```

Isso criará os serviços:

    - api → FastAPI
    - data → volume com SQLite (agro.db)


## Instalar dependências do frontend

```bash
cd frontend
npm install
npm run dev

```

## Acessar a aplicação

- Frontend: http://localhost:5173

- Swagger: http://localhost:8000/docs

### Seeds
O backend já inclui seeds de dados (Soja e Milho em SP, MG e PR) para manter a aplicação funcional mesmo sem conexão com a API do IBGE.

### Link dos dados utilizados
IBGE – Produção Agrícola Municipal (PAM), Tabela 5457
https://sidra.ibge.gov.br/tabela/5457

### Vídeo de demonstração

https://youtu.be/3u0E2e91pO8


