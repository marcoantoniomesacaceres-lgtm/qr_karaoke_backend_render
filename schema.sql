-- =====================================================================
-- SCRIPT DE CREACIÓN Y MODIFICACIÓN DE LA ESTRUCTURA DE LA BASE DE DATOS
-- PROYECTO: My Qr Music (Backend)
-- MOTOR DE BASE DE DATOS: MySQL / MariaDB
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `eventoQrDb` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `eventoQrDb`;

-- Habilitar chequeo de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. TABLAS CORE (ORDENADAS DE FORMA SEGURA POR LLAVES FORÁNEAS)
-- =====================================================================

-- Tabla: mesas
CREATE TABLE IF NOT EXISTS `mesas` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `nombre`      VARCHAR(100)  NOT NULL,
    `qr_code`     VARCHAR(100)  NOT NULL,
    `is_active`   BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_mesas_qr_code` (`qr_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: locales (SaaS / Multi-Local)
CREATE TABLE IF NOT EXISTS `locales` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `slug`        VARCHAR(100)  NOT NULL,
    `nombre`      VARCHAR(200)  NOT NULL,
    `direccion`   VARCHAR(200)  NULL,
    `telefono`    VARCHAR(50)   NULL,
    `hora_cierre` VARCHAR(10)   NULL DEFAULT '03:00',
    `logo_url`    VARCHAR(500)  NULL,
    `is_active`   BOOLEAN       NOT NULL DEFAULT TRUE,
    `created_at`  DATETIME      NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_locales_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
    `id`              INT           NOT NULL AUTO_INCREMENT,
    `nick`            VARCHAR(50)   NOT NULL,
    `mesa_id`         INT           NULL,
    `puntos`          INT           NOT NULL DEFAULT 0,
    `nivel`           VARCHAR(20)   NOT NULL DEFAULT 'bronce',
    `is_active`       BOOLEAN       NOT NULL DEFAULT TRUE,
    `song_credits`    INT           NOT NULL DEFAULT 3,
    `last_active`       DATETIME      NULL,
    `is_silenced`       BOOLEAN       NOT NULL DEFAULT FALSE,
    `is_banned`         BOOLEAN       NOT NULL DEFAULT FALSE,
    `credits_added_at`  DATETIME      NULL,
    `last_song_added_at` DATETIME     NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_usuarios_mesa_id` FOREIGN KEY (`mesa_id`) REFERENCES `mesas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: canciones
CREATE TABLE IF NOT EXISTS `canciones` (
    `id`                  BIGINT        NOT NULL,
    `titulo`              VARCHAR(200)  NULL,
    `youtube_id`          VARCHAR(50)   NULL,
    `duracion_seconds`    INT           NOT NULL DEFAULT 0,
    `estado`              VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
    `usuario_id`          INT           NULL,
    `created_at`          DATETIME      NULL,
    `started_at`          DATETIME      NULL,
    `finished_at`         DATETIME      NULL,
    `approved_at`         DATETIME      NULL,
    `orden_manual`        INT           NULL,
    `puntuacion_ia`       INT           NOT NULL DEFAULT 0,
    `is_karaoke`          BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_canciones_usuario_id` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: productos
CREATE TABLE IF NOT EXISTS `productos` (
    `id`              INT            NOT NULL AUTO_INCREMENT,
    `nombre`          VARCHAR(100)   NOT NULL,
    `descripcion`     VARCHAR(500)   NULL,
    `categoria`       VARCHAR(100)   NOT NULL DEFAULT 'General',
    `valor`           NUMERIC(10, 2) NOT NULL,
    `costo`           NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    `stock`           INT            NOT NULL DEFAULT 0,
    `stock_seguridad` INT            NOT NULL DEFAULT 0,
    `local_id`        INT            NULL,
    `imagen_url`      VARCHAR(500)   NULL,
    `is_active`       BOOLEAN        NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_productos_local_id` FOREIGN KEY (`local_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: cuentas
CREATE TABLE IF NOT EXISTS `cuentas` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `mesa_id`     INT           NOT NULL,
    `estado`      VARCHAR(20)   NOT NULL DEFAULT 'abierta',
    `created_at`  DATETIME      NULL,
    `closed_at`   DATETIME      NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_cuentas_mesa_id` FOREIGN KEY (`mesa_id`) REFERENCES `mesas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: consumos
CREATE TABLE IF NOT EXISTS `consumos` (
    `id`              INT            NOT NULL AUTO_INCREMENT,
    `producto_id`     INT            NOT NULL,
    `cantidad`        INT            NOT NULL,
    `valor_total`     NUMERIC(10, 2) NOT NULL,
    `mesa_id`         INT            NULL,
    `usuario_id`      INT            NULL,
    `cuenta_id`       INT            NULL,
    `is_dispatched`   BOOLEAN        NOT NULL DEFAULT FALSE,
    `created_at`      DATETIME       NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_consumos_producto_id`  FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_consumos_mesa_id`      FOREIGN KEY (`mesa_id`)     REFERENCES `mesas` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_consumos_usuario_id`   FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_consumos_cuenta_id`    FOREIGN KEY (`cuenta_id`)   REFERENCES `cuentas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: pagos
CREATE TABLE IF NOT EXISTS `pagos` (
    `id`          INT            NOT NULL AUTO_INCREMENT,
    `mesa_id`     INT            NOT NULL,
    `monto`       NUMERIC(10, 2) NOT NULL,
    `metodo`      VARCHAR(50)    NOT NULL DEFAULT 'efectivo',
    `created_at`  DATETIME       NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_pagos_mesa_id` FOREIGN KEY (`mesa_id`) REFERENCES `mesas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: banned_nicks
CREATE TABLE IF NOT EXISTS `banned_nicks` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `nick`        VARCHAR(100)  NOT NULL,
    `banned_at`   DATETIME      NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_banned_nicks_nick` (`nick`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: admin_logs
CREATE TABLE IF NOT EXISTS `admin_logs` (
    `id`          INT            NOT NULL AUTO_INCREMENT,
    `timestamp`   DATETIME       NULL,
    `action`      VARCHAR(100)   NULL,
    `details`     VARCHAR(1000)  NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: admin_api_keys
CREATE TABLE IF NOT EXISTS `admin_api_keys` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `key`         VARCHAR(200)  NOT NULL,
    `description` VARCHAR(200)  NULL,
    `is_active`   BOOLEAN       NOT NULL DEFAULT TRUE,
    `created_at`  DATETIME      NULL,
    `last_used`   DATETIME      NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admin_api_keys_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: configuracion_global
CREATE TABLE IF NOT EXISTS `configuracion_global` (
    `id`                          INT          NOT NULL DEFAULT 1,
    `karaoke_activo`              BOOLEAN      NOT NULL DEFAULT TRUE,
    `hora_cierre`                 VARCHAR(10)  NOT NULL DEFAULT '02:00',
    `max_canciones_por_usuario`   INT          NOT NULL DEFAULT 5,
    `updated_at`                  DATETIME     NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. TABLAS DE ADMINISTRACIÓN (SaaS / MULTI-LOCAL)
-- =====================================================================

-- Tabla: usuarios_locales (Dueños/Administradores globales de locales)
CREATE TABLE IF NOT EXISTS `usuarios_locales` (
    `id`            INT           NOT NULL AUTO_INCREMENT,
    `email`         VARCHAR(100)  NOT NULL,
    `password_hash` VARCHAR(200)  NOT NULL,
    `nombre`        VARCHAR(200)  NOT NULL,
    `telefono`      VARCHAR(50)   NULL,
    `is_active`     BOOLEAN       NOT NULL DEFAULT TRUE,
    `created_at`    DATETIME      NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_usuarios_locales_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de Relación: usuarios_locales_rel (Muchos a Muchos entre Dueños y Locales)
CREATE TABLE IF NOT EXISTS `usuarios_locales_rel` (
    `usuario_local_id` INT NOT NULL,
    `local_id`         INT NOT NULL,
    PRIMARY KEY (`usuario_local_id`, `local_id`),
    CONSTRAINT `fk_rel_usuario_id` FOREIGN KEY (`usuario_local_id`) REFERENCES `usuarios_locales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_rel_local_id`   FOREIGN KEY (`local_id`)   REFERENCES `locales` (`id`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: usuarios_empleado_locales (DJ, Meseros, Cajeros por cada Local)
CREATE TABLE IF NOT EXISTS `usuarios_empleado_locales` (
    `id`                 INT           NOT NULL AUTO_INCREMENT,
    `local_id`           INT           NOT NULL,
    `email`              VARCHAR(100)  NOT NULL,
    `password_hash`      VARCHAR(200)  NOT NULL,
    `nombre`             VARCHAR(200)  NOT NULL,
    `rol`                VARCHAR(50)   NOT NULL, -- 'dj', 'mesero', 'cajero', 'admin'
    `modulos_permitidos` TEXT          NULL,     -- JSON array de módulos autorizados ej: ["dashboard","accounts","inventory"]
    `is_active`          BOOLEAN       NOT NULL DEFAULT TRUE,
    `created_at`         DATETIME      NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_empleados_email` (`email`),
    CONSTRAINT `fk_empleados_local_id` FOREIGN KEY (`local_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: traslados_inventario (Auditoría y control de transferencias de stock entre sedes)
CREATE TABLE IF NOT EXISTS `traslados_inventario` (
    `id`                 INT            NOT NULL AUTO_INCREMENT,
    `local_origen_id`    INT            NOT NULL,
    `local_destino_id`   INT            NOT NULL,
    `producto_origen_id` INT            NULL,
    `producto_nombre`    VARCHAR(200)   NOT NULL,
    `cantidad`           INT            NOT NULL,
    `costo_unitario`     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    `usuario_id`         INT            NULL,
    `usuario_nombre`     VARCHAR(200)   NULL,
    `notas`              VARCHAR(500)   NULL,
    `fecha`              DATETIME       NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_traslados_local_origen` FOREIGN KEY (`local_origen_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_traslados_local_destino` FOREIGN KEY (`local_destino_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_traslados_producto_origen` FOREIGN KEY (`producto_origen_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 3. HISTORIAL DE MODIFICACIONES (ALTER TABLE / PARCHES APLICADOS)
-- =====================================================================

/*
-- A continuación se listan las sentencias ejecutadas históricamente
-- para migrar bases de datos viejas a la estructura final de arriba:

-- PARCHE A: Columnas consolidadas en canciones, productos, consumos y usuarios
ALTER TABLE `canciones` ADD COLUMN `puntuacion_ia` INT NOT NULL DEFAULT 0;
ALTER TABLE `canciones` ADD COLUMN `is_karaoke` BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE `canciones` ADD COLUMN `approved_at` DATETIME NULL;
ALTER TABLE `productos` ADD COLUMN `costo` NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `productos` ADD COLUMN `imagen_url` VARCHAR(500) NULL;
ALTER TABLE `consumos` ADD COLUMN `is_dispatched` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `consumos` ADD COLUMN `cuenta_id` INT NULL;
ALTER TABLE `usuarios` ADD COLUMN `song_credits` INT NOT NULL DEFAULT 3;
ALTER TABLE `usuarios` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE `mesas` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT TRUE;

-- PARCHE B: Nuevas columnas de seguridad y estado en usuarios
ALTER TABLE `usuarios` ADD COLUMN `last_active` DATETIME NULL;
ALTER TABLE `usuarios` ADD COLUMN `is_silenced` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `usuarios` ADD COLUMN `is_banned` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `usuarios` ADD COLUMN `credits_added_at` DATETIME NULL;
ALTER TABLE `usuarios` ADD COLUMN `last_song_added_at` DATETIME NULL;

-- PARCHE C: Nuevas columnas añadidas a la tabla productos para soporte multi-local y categorías
ALTER TABLE `productos` ADD COLUMN `categoria` VARCHAR(100) NOT NULL DEFAULT 'General';
ALTER TABLE `productos` ADD COLUMN `stock_seguridad` INT NOT NULL DEFAULT 0;
ALTER TABLE `productos` ADD COLUMN `local_id` INT NULL;
ALTER TABLE `productos` ADD CONSTRAINT `fk_productos_local_id` FOREIGN KEY (`local_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE;

-- PARCHE D: Soporte para permisos granulares de empleados y traslados de inventario entre sedes
ALTER TABLE `usuarios_empleado_locales` ADD COLUMN `modulos_permitidos` TEXT NULL;

CREATE TABLE IF NOT EXISTS `traslados_inventario` (
    `id`                 INT            NOT NULL AUTO_INCREMENT,
    `local_origen_id`    INT            NOT NULL,
    `local_destino_id`   INT            NOT NULL,
    `producto_origen_id` INT            NULL,
    `producto_nombre`    VARCHAR(200)   NOT NULL,
    `cantidad`           INT            NOT NULL,
    `costo_unitario`     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    `usuario_id`         INT            NULL,
    `usuario_nombre`     VARCHAR(200)   NULL,
    `notas`              VARCHAR(500)   NULL,
    `fecha`              DATETIME       NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_traslados_local_origen` FOREIGN KEY (`local_origen_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_traslados_local_destino` FOREIGN KEY (`local_destino_id`) REFERENCES `locales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_traslados_producto_origen` FOREIGN KEY (`producto_origen_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PARCHE E: Soporte para hora de cierre independiente y teléfono de contacto por sede
ALTER TABLE `locales` ADD COLUMN `telefono` VARCHAR(50) NULL;
ALTER TABLE `locales` ADD COLUMN `hora_cierre` VARCHAR(10) NULL DEFAULT '03:00';
*/
