"""
database.py - Inicializacion de base de datos PostgreSQL
Sistema de gestion academia - AcademiaSIS v2
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse


def get_database_url():
    """Obtiene la URL de la base de datos desde variables de entorno."""
    url = os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_PUBLIC_URL")
    if not url:
        # Fallback local para desarrollo
        url = "postgresql://postgres:postgres@localhost:5432/academiasis"
    # Railway a veces da postgres:// en lugar de postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def get_connection():
    """Devuelve una conexion psycopg2 con RealDictCursor por defecto."""
    url = get_database_url()
    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    return conn


def init_db():
    """Crea todas las tablas si no existen y carga datos iniciales."""
    conn = get_connection()
    cur = conn.cursor()

    # --- ALUMNOS ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alumnos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            dni VARCHAR(20) UNIQUE NOT NULL,
            correo VARCHAR(200),
            telefono VARCHAR(50),
            edad INTEGER,
            profesion VARCHAR(150),
            fuente VARCHAR(50) DEFAULT 'Otro',
            notas TEXT,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- SEDES ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sedes (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(150) NOT NULL,
            direccion VARCHAR(300),
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- TALLERES (catalogo) ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS talleres (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            duracion_dias INTEGER DEFAULT 1,
            precio_base NUMERIC(10,2) DEFAULT 0,
            descripcion TEXT,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- FECHAS PROGRAMADAS ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fechas (
            id SERIAL PRIMARY KEY,
            taller_id INTEGER REFERENCES talleres(id) ON DELETE CASCADE,
            fecha DATE NOT NULL,
            turno VARCHAR(30) DEFAULT 'mañana',
            sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
            profesor VARCHAR(150),
            cupo INTEGER DEFAULT 20,
            estado VARCHAR(20) DEFAULT 'activa',
            valoracion VARCHAR(20),
            que_paso TEXT,
            que_mejorar TEXT,
            que_funciono TEXT,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cerrado TIMESTAMP
        );
    """)

    # --- INSCRIPCIONES ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS inscripciones (
            id SERIAL PRIMARY KEY,
            alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
            fecha_id INTEGER REFERENCES fechas(id) ON DELETE CASCADE,
            monto_total NUMERIC(10,2) DEFAULT 0,
            monto_pagado NUMERIC(10,2) DEFAULT 0,
            metodo_pago VARCHAR(30),
            estado_pago VARCHAR(30) DEFAULT 'Pendiente',
            promocion VARCHAR(150),
            tipo_descuento VARCHAR(100),
            asistencia VARCHAR(20) DEFAULT 'Pendiente',
            notas TEXT,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- GASTOS ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gastos (
            id SERIAL PRIMARY KEY,
            descripcion VARCHAR(300) NOT NULL,
            categoria VARCHAR(80),
            monto NUMERIC(10,2) NOT NULL,
            fecha DATE NOT NULL,
            metodo_pago VARCHAR(30),
            proveedor VARCHAR(150),
            comprobante VARCHAR(50),
            notas TEXT,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- INVENTARIO (insumos) ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS insumos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(150) NOT NULL,
            unidad VARCHAR(20) DEFAULT 'uds',
            stock_actual NUMERIC(10,2) DEFAULT 0,
            stock_minimo NUMERIC(10,2) DEFAULT 0,
            consumo_clase NUMERIC(10,2) DEFAULT 0,
            precio_unitario NUMERIC(10,4) DEFAULT 0,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # --- CONSUMO DE INSUMOS POR CLASE ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS consumos (
            id SERIAL PRIMARY KEY,
            fecha_id INTEGER REFERENCES fechas(id) ON DELETE CASCADE,
            insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
            cantidad NUMERIC(10,2) DEFAULT 0,
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    conn.commit()

    # --- DATOS INICIALES ---
    # Sedes
    cur.execute("SELECT COUNT(*) AS c FROM sedes;")
    if cur.fetchone()["c"] == 0:
        cur.executemany(
            "INSERT INTO sedes (nombre, direccion) VALUES (%s, %s);",
            [
                ("Sede Principal", "Direccion principal"),
                ("Sede B", "Direccion alterna"),
            ],
        )

    # Talleres
    cur.execute("SELECT COUNT(*) AS c FROM talleres;")
    if cur.fetchone()["c"] == 0:
        cur.executemany(
            "INSERT INTO talleres (nombre, duracion_dias, precio_base) VALUES (%s, %s, %s);",
            [
                ("Cosmetologia avanzada", 4, 250),
                ("Barberia profesional", 4, 220),
                ("Uñas en gel", 1, 180),
                ("Maquillaje artistico", 1, 200),
                ("Extensiones de cabello", 1, 190),
                ("Depilacion con hilo", 1, 150),
            ],
        )

    # Insumos
    cur.execute("SELECT COUNT(*) AS c FROM insumos;")
    if cur.fetchone()["c"] == 0:
        cur.executemany(
            "INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo, consumo_clase, precio_unitario) VALUES (%s, %s, %s, %s, %s, %s);",
            [
                ("Cafe en granos", "g", 500, 200, 250, 0.05),
                ("Vasos descartables", "uds", 80, 30, 14, 0.15),
                ("Azucar", "g", 2000, 500, 200, 0.002),
                ("Servilletas", "uds", 200, 50, 20, 0.05),
            ],
        )

    conn.commit()
    cur.close()
    conn.close()
    print("Base de datos inicializada correctamente.")


if __name__ == "__main__":
    init_db()
