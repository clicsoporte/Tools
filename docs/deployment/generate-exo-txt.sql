-- Script para generar el archivo exo.txt para Clic-Tools
-- Este script concatena las columnas requeridas con un caracter de tabulación (CHAR(9))
-- para crear un formato de texto plano que la aplicación pueda importar.
--
-- Instrucciones de uso:
-- 1. Abre SQL Server Management Studio (SSMS).
-- 2. Conéctate a la base de datos donde reside la tabla [SOFTLAND].[GAREND].[AUTOR_VENTA].
-- 3. Abre una nueva ventana de consulta (New Query).
-- 4. Copia y pega este script.
-- 5. Ejecuta la consulta (F5 o el botón "Execute").
-- 6. En la pestaña "Results" (Resultados), haz clic derecho y selecciona "Save Results As..." (Guardar resultados como...).
-- 7. Guarda el archivo con el nombre "exo.txt" en la carpeta que has configurado en la aplicación Clic-Tools.

-- Primero, la fila de encabezado. Estos nombres DEBEN coincidir con los esperados por la aplicación.
SELECT 'CODIGO' + CHAR(9) + 'DESCRIPCION' + CHAR(9) + 'CLIENTE' + CHAR(9) + 'NUM_AUTOR' + CHAR(9) + 'FECHA_RIGE' + CHAR(9) + 'FECHA_VENCE' + CHAR(9) + 'PORCENTAJE' + CHAR(9) + 'TIPO_DOC' + CHAR(9) + 'NOMBRE_INSTITUCION' + CHAR(9) + 'CODIGO_INSTITUCION'
AS Header

UNION ALL

-- Luego, los datos de la tabla, convirtiendo todos los campos a texto y manejando valores nulos.
SELECT 
    ISNULL(CONVERT(NVARCHAR(MAX), [CODIGO]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [DESCRIPCION]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [CLIENTE]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [NUM_AUTOR]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [FECHA_RIGE], 23), '') + CHAR(9) + -- Formato AAAA-MM-DD
    ISNULL(CONVERT(NVARCHAR(MAX), [FECHA_VENCE], 23), '') + CHAR(9) + -- Formato AAAA-MM-DD
    ISNULL(CONVERT(NVARCHAR(MAX), [PORCENTAJE]), '0') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [TIPO_DOC]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [NOMBRE_INSTITUCION]), '') + CHAR(9) +
    ISNULL(CONVERT(NVARCHAR(MAX), [CODIGO_INSTITUCION]), '')
FROM 
    [SOFTLAND].[GAREND].[AUTOR_VENTA];
