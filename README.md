# AcademiaSIS v2 - Sistema de Gestión

Sistema web completo de gestión para academia de talleres presenciales.

## Características

- **9 módulos**: Dashboard, Alumnos, Talleres/Fechas, Inscripciones, Cierre de clase, Finanzas, Rentabilidad, Inventario, Reportes
- **Sin login** - acceso directo
- **Responsive** - Mac, tablet, celular
- **Base de datos**: PostgreSQL (Railway)
- **Backend**: Flask (Python)
- **Frontend**: HTML/CSS/JavaScript vanilla
- **Exportación a Excel** con dos hojas (Inscripciones, Gastos)

## Estructura

```
academiasis_v2/
├── app.py              # Backend Flask + API REST
├── database.py         # Inicialización de BD + datos iniciales
├── requirements.txt    # Dependencias Python
├── Procfile           # Comando de inicio para Railway
├── railway.json       # Configuración Railway
├── runtime.txt        # Versión Python
├── templates/
│   └── index.html     # UI completa (single-page)
└── static/
    ├── css/style.css  # Estilos responsivos
    └── js/main.js     # Lógica frontend
```

## Despliegue en Railway

### 1. Crear proyecto en Railway
1. Ir a https://railway.app y crear un nuevo proyecto
2. Conectar tu repositorio GitHub (sube esta carpeta primero)
3. Agregar servicio **PostgreSQL**: New → Database → PostgreSQL

### 2. Configurar variable de entorno
Railway crea automáticamente `DATABASE_URL` cuando agregas PostgreSQL. El sistema la detecta automáticamente.

### 3. Despliegue automático
Railway detecta `requirements.txt` y `Procfile` y despliega solo. La app:
- Crea las tablas automáticamente en el primer arranque
- Carga datos iniciales (2 sedes, 6 talleres, 4 insumos)

### 4. Generar dominio público
En Railway: Settings → Networking → Generate Domain

## Ejecutar localmente

```bash
# Instalar PostgreSQL local (opcional, o usar Railway directamente)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/academiasis"

# Instalar dependencias
pip install -r requirements.txt

# Inicializar BD (crea tablas + datos iniciales)
python database.py

# Iniciar servidor
python app.py
```

Abrir http://localhost:5000

## Datos iniciales cargados

**Sedes:** Sede Principal, Sede B
**Talleres:** Cosmetología avanzada (4d/S/250), Barbería profesional (4d/S/220), Uñas en gel (1d/S/180), Maquillaje artístico (1d/S/200), Extensiones de cabello (1d/S/190), Depilación con hilo (1d/S/150)
**Insumos:** Café en granos, Vasos descartables, Azúcar, Servilletas

## API Endpoints (REST)

| Recurso | Endpoints |
|---------|-----------|
| Dashboard | `GET /api/dashboard?period=hoy\|semana\|mes` |
| Alumnos | `GET/POST/PUT/DELETE /api/alumnos`, `GET /api/alumnos/buscar_dni?dni=` |
| Talleres | `GET/POST/DELETE /api/talleres` |
| Sedes | `GET/POST/DELETE /api/sedes` |
| Fechas | `GET/POST/DELETE /api/fechas`, `GET /api/fechas/:id/detalle`, `POST /api/fechas/:id/cerrar` |
| Inscripciones | `GET/POST/PUT/DELETE /api/inscripciones` |
| Gastos | `GET/POST/PUT/DELETE /api/gastos` |
| Finanzas | `GET /api/finanzas/resumen?desde=&hasta=` |
| Rentabilidad | `GET /api/rentabilidad?desde=&hasta=` |
| Inventario | `GET/POST/PUT/DELETE /api/insumos`, `POST /api/insumos/:id/agregar` |
| Reportes | `GET /api/reportes/excel?desde=&hasta=` |

## Notas

- Todos los datos se guardan en PostgreSQL de forma persistente
- La BD se inicializa automáticamente al primer request (con guardas para evitar duplicar datos)
- Sin autenticación: el sistema es accesible directamente desde la URL
