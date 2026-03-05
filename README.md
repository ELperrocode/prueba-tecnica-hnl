# BancaHNL — Sistema de Banca en Línea

Sistema de banca en línea simplificado con soporte para gestión de cuentas, transacciones financieras y asistente de IA con MCP.

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | **Go** (chi router, GORM, JWT) |
| Base de datos financiera | **TigerBeetle** (doble entrada contable) |
| Base de datos de usuarios | **PostgreSQL** (usuarios y autenticación) |
| Frontend | **React + Vite + TypeScript** |
| UI | **Tailwind CSS v4** + Lucide Icons + Recharts |
| IA / Chat | **MCP Tools** + **OpenRouter** (nvidia/nemotron-3-nano-30b-a3b) |
| Infraestructura | **Docker** + Docker Compose |

---

## Requisitos Previos

- Docker >= 24.0
- Docker Compose >= 2.0
- Una API key de [OpenRouter](https://openrouter.ai) (para el chat con IA)

---

## Inicio Rápido

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd prueba-tecnica

# Copiar variables de entorno
cp .env.example .env
# Editar .env y agregar tu OPENROUTER_API_KEY

# Preparar datos de seed
bash setup.sh
```

### 2. Levantar con Docker

```bash
docker-compose up --build
```

### 3. Acceder

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| TigerBeetle | localhost:3001 |

---

## Credenciales de Prueba

El sistema carga automáticamente 1,000 usuarios al iniciar. Algunos ejemplos:

| Email | Contraseña |
|-------|------------|
| `ihernandez@email.com` | `Isabel2024!` |
| Cualquier usuario del JSON | Su contraseña del JSON |

Para registrar un nuevo usuario, usa el formulario de registro en http://localhost:3000/register.

---

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | `postgres` |
| `JWT_SECRET` | Secreto para firmar JWTs | `change-me-in-production-please` |
| `OPENROUTER_API_KEY` | API key de OpenRouter (**requerida para chat**) | — |
| `OPENROUTER_MODEL` | Modelo de IA a usar | `nvidia/nemotron-3-nano-30b-a3b:free` |

---

## API Endpoints

### Autenticación
```
POST /api/auth/register     Registro de usuario
POST /api/auth/login        Inicio de sesión → { token, user }
POST /api/auth/logout       Cierre de sesión
GET  /api/auth/me           Perfil del usuario autenticado
```

### Cuentas (requiere Authorization: Bearer <token>)
```
GET  /api/accounts                  Lista cuentas del usuario con saldos
GET  /api/accounts/:accountNumber   Detalle de una cuenta
```

### Transacciones (requiere Authorization)
```
POST /api/transactions/deposit      Depósito
POST /api/transactions/withdraw     Retiro
POST /api/transactions/transfer     Transferencia
GET  /api/transactions?limit=50     Historial de transacciones
```

### Chat IA (requiere Authorization)
```
POST /api/chat    { message: string } → { response: string }
```

### Health Check
```
GET  /health    → { status: "ok" }
```

#### Ejemplo de depósito:
```json
POST /api/transactions/deposit
{
  "account_number": "4001-6588-5247-0001",
  "amount": 500.00,
  "description": "Depósito de nómina"
}
```

---

## Arquitectura con TigerBeetle

### Modelo Contable (doble entrada)

TigerBeetle implementa contabilidad de doble entrada donde cada transferencia:
- **Debita** una cuenta (resta créditos / agrega débitos)
- **Acredita** otra cuenta (suma créditos)

El saldo de una cuenta = `credits_posted - debits_posted`

### Cuentas en TigerBeetle

```
Ledger: 1 (USD, asset_scale=2 → montos en centavos)

Codes:
  1 = cuenta corriente (checking)
  2 = cuenta de ahorros (savings)
  3 = cuenta de inversión (investment)
  99 = operador/banco (para depósitos y retiros)

Flags importantes:
  - debits_must_not_exceed_credits  → previene sobregiro
  - history                        → permite consultar historial
  - imported                       → para carga de datos históricos
```

### Flujo de Transacciones

```
Depósito:    BANCO (debit) ──────────→ USUARIO (credit)
Retiro:      USUARIO (debit) ─────────→ BANCO (credit)
Transferencia: CUENTA_A (debit) ──────→ CUENTA_B (credit)
```

### Relación PostgreSQL ↔ TigerBeetle

```
PostgreSQL:        users (UUID) ──→ user_accounts (TBAccountID: uint64)
TigerBeetle:       Account.ID = TBAccountID
```

---

## Datos de Seed

El archivo `datos-prueba-HNL (1).json` contiene:
- **1,000 usuarios** con emails y contraseñas en texto plano
- **1,605 cuentas** (checking, savings, investment) con saldos iniciales
- **6,429 transacciones** históricas (depósitos, retiros, transferencias)

Al iniciar, el backend:
1. Crea usuarios en PostgreSQL (con contraseñas hasheadas con bcrypt)
2. Crea las cuentas en TigerBeetle con flag `imported`
3. Carga los saldos iniciales como transferencias importadas
4. Importa el historial de transacciones (omitiendo las que causarían saldo negativo)

---

## Chat con IA (MCP)

El asistente bancario usa el patrón de **herramientas MCP** (Model Context Protocol):

### Herramientas disponibles

| Tool | Descripción |
|------|-------------|
| `get_accounts` | Lista todas las cuentas del usuario con saldos |
| `get_balance` | Consulta el saldo de una cuenta específica |
| `get_transactions` | Obtiene el historial de transacciones |
| `make_deposit` | Realiza un depósito |
| `make_withdrawal` | Realiza un retiro |
| `make_transfer` | Realiza una transferencia |

### Ejemplos de uso

```
"¿Cuánto tengo en mi cuenta?"
"Transfiere $100 a la cuenta 4001-2559-1172-0416"
"Muéstrame mis últimas 5 transacciones"
"Deposita $500 en mi cuenta de ahorros"
```

El asistente **siempre confirma** las operaciones destructivas antes de ejecutarlas.

---

## Estructura del Proyecto

```
prueba-tecnica/
├── backend/
│   ├── cmd/server/
│   │   ├── main.go         # Entry point, wiring
│   │   └── seed.go         # Seed data loader
│   ├── internal/
│   │   ├── config/         # Configuración (env vars)
│   │   ├── handlers/       # HTTP handlers (auth, accounts, txns, chat)
│   │   ├── mcp/            # MCP tool registry
│   │   ├── middleware/     # JWT auth middleware
│   │   ├── models/         # GORM models + request/response types
│   │   ├── services/       # Business logic
│   │   └── tigerbeetle/    # TigerBeetle client wrapper
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── __tests__/      # Unit tests (Vitest)
│   │   │   └── utils/      # Tests for utility functions
│   │   ├── api/            # Axios API client
│   │   ├── components/     # Layout, Chat, UI primitives
│   │   ├── contexts/       # AuthContext
│   │   ├── pages/          # Dashboard, Login, Register, Transactions, History
│   │   ├── utils/          # format, accounts, transactions helpers
│   │   └── types.ts        # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
├── data/                   # Seed data (gitignored, created by setup.sh)
├── scripts/
│   └── tb-entrypoint.sh    # TigerBeetle Docker entrypoint
├── docker-compose.yml
├── Dockerfile.tigerbeetle
├── .env.example
└── setup.sh
```

---

## Decisiones Técnicas

1. **TigerBeetle como base de datos principal**: Elegido por su modelo de doble entrada que garantiza consistencia financiera automática. Las transacciones son atómicas y el motor previene sobregiros vía `flags.debits_must_not_exceed_credits`.

2. **IDs como uint64**: Los IDs de cuentas en TigerBeetle son u128. Para este proyecto usamos uint64 (la mitad inferior) ya que 1,605 cuentas lo permiten con margen amplio.

3. **Cuenta operador (ID: 999,999)**: Para depósitos y retiros, se usa una cuenta bancaria interna. Los depósitos acreditan al usuario y debitan al banco; los retiros hacen lo inverso.

4. **Seed con flag `imported`**: Las transacciones históricas se importan con timestamps estrictamente crecientes (requerimiento de TigerBeetle). Las transacciones que causarían saldo negativo son omitidas silenciosamente.

5. **MCP Tools + OpenRouter**: Se implementa el patrón de herramientas MCP sin el overhead del transporte JSON-RPC. Los tool schemas siguen el formato MCP estándar y se convierten a function calling de OpenRouter.

6. **JWT stateless**: Los tokens JWT expirar en 24h. No hay blacklist en esta implementación.

---

## Bonus Implementados

- ✅ Logs estructurados (via chi middleware)
- ✅ Paginación en historial de transacciones (`?limit=N`)
- ✅ Gráficas de balance en el dashboard (Recharts)
- ✅ Búsqueda y filtros en historial
- ✅ Rate limiting en endpoints sensibles (registro: 5/min, login: 10/min, transacciones: 30/min, chat: 20/min)
- ✅ Exportar historial a CSV (`GET /api/transactions/export`, botón en la UI)
- ✅ CI/CD con GitHub Actions (build + vet del backend Go, type-check + build + **unit tests** del frontend React)

---

## Desarrollo Local (sin Docker)

```bash
# PostgreSQL local
psql -U postgres -c "CREATE DATABASE banca;"

# TigerBeetle local
# Descargar: https://github.com/tigerbeetle/tigerbeetle/releases
./tigerbeetle format --cluster=0 --replica=0 --replica-count=1 --development ./tigerbeetle.tigerbeetle
./tigerbeetle start --cluster=0 --replica=0 --replica-count=1 --addresses=0.0.0.0:3000 --development ./tigerbeetle.tigerbeetle &

# Backend
cd backend
DATABASE_URL="postgres://postgres:postgres@localhost:5432/banca?sslmode=disable" \
TIGERBEETLE_ADDR="localhost:3000" \
JWT_SECRET="dev-secret" \
OPENROUTER_API_KEY="your-key" \
go run ./cmd/server/

# Frontend
cd frontend
npm install && npm run dev
```
