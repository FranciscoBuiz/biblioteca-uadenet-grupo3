-- Esquema de la Biblioteca. Idempotente: se aplica en cada arranque.
-- user_id no tiene FK porque los usuarios son del CORE.

CREATE TABLE IF NOT EXISTS libros (
  isbn VARCHAR(13) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  editorial VARCHAR(255) NOT NULL,
  anio INT NOT NULL,
  categoria VARCHAR(40) NOT NULL,
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ejemplares (
  codigo VARCHAR(20) PRIMARY KEY,
  isbn VARCHAR(13) NOT NULL,
  sede VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  FOREIGN KEY (isbn) REFERENCES libros (isbn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prestamos (
  id VARCHAR(20) PRIMARY KEY,
  isbn VARCHAR(13) NOT NULL,
  copia VARCHAR(20) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  sede VARCHAR(20) NOT NULL,
  fecha_prestamo DATE NOT NULL,
  fecha_limite DATE NOT NULL,
  fecha_devolucion DATE NULL,
  renovaciones INT NOT NULL,
  -- sin UNIQUE: el codigo de retiro es aleatorio y el contrato permite repetirlo
  codigo_retiro VARCHAR(20) NOT NULL,
  tiene_reservas BOOLEAN NOT NULL,
  FOREIGN KEY (isbn) REFERENCES libros (isbn),
  FOREIGN KEY (copia) REFERENCES ejemplares (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sanciones (
  id VARCHAR(20) PRIMARY KEY,
  loan_id VARCHAR(20) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  isbn VARCHAR(13) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  dias_atraso INT NOT NULL,
  fecha_limite_original DATE NOT NULL,
  fecha_deteccion DATE NOT NULL,
  fecha_cobro DATE NULL,
  estado VARCHAR(20) NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES prestamos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  cuerpo TEXT NOT NULL,
  fecha DATE NOT NULL,
  leida BOOLEAN NOT NULL,
  INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actividad (
  id VARCHAR(40) PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL,
  texto VARCHAR(500) NOT NULL,
  fecha_hora DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarifas (
  vigente_desde DATE PRIMARY KEY,
  monto DECIMAL(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ubicaciones (
  location_id VARCHAR(40) PRIMARY KEY,
  site_id VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  capacity INT NOT NULL,
  status VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 'prestamo' y 'sancion' guardan el proximo numero y 'lock' es la fila que serializa las transacciones.
CREATE TABLE IF NOT EXISTS secuencias (
  nombre VARCHAR(20) PRIMARY KEY,
  valor INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
