# Historial de Cambios (Changelog) - Clic-Tools

Este documento registra todas las mejoras, correcciones y cambios significativos en cada versión de la aplicación.

---

## Proceso de Actualización y Rollback

**Para actualizar a una nueva versión, siga estos pasos:**

1.  **¡Crítico! Crear Punto de Restauración:** Antes de cualquier cambio, vaya a **Administración > Mantenimiento** y haga clic en **"Crear Punto de Restauración"**. Esto crea una copia de seguridad completa de todas las bases de datos (`.db`).
2.  **Reemplazar Archivos:** Reemplace todos los archivos y carpetas de la aplicación en el servidor con los de la nueva versión, **excepto** la carpeta `dbs/` y el archivo `.env.local`.
3.  **Actualizar Dependencias:** Ejecute `npm install --omit=dev` en el servidor.
4.  **Reconstruir y Reiniciar:** Ejecute `npm run build` y reinicie la aplicación (ej: `pm2 restart clic-tools`).
5.  **Verificar:** Ejecute la auditoría desde **Administración > Mantenimiento** para confirmar que la estructura de la base de datos es correcta.

**Para realizar un rollback (regresar a la versión anterior):**

1.  **Restaurar Punto de Restauración:** Vaya a **Administración > Mantenimiento**, seleccione el punto de restauración que creó antes de la actualización y haga clic en "Restaurar". **Esto requiere un reinicio manual del servidor de la aplicación después de la restauración.**
2.  **Revertir Archivos:** Reemplace los archivos del servidor con los de la versión anterior.
3.  **Reinstalar y Reconstruir:** Ejecute `npm install --omit=dev` y `npm run build`.
4.  **Reiniciar:** Inicie la aplicación nuevamente.

---

## [2.2.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Nuevo Módulo "Catálogo de Clientes y Artículos":**
    -   Se ha evolucionado la herramienta "Asignar Ubicación" a un módulo de catálogo completo.
    -   Permite crear una asociación entre un **producto**, una **ubicación** y, opcionalmente, un **cliente**.
    -   **Exclusividad:** Se puede marcar una asignación como "Exclusiva" para un cliente, indicando que ese producto en esa ubicación es solo para él.
    -   La interfaz ha sido rediseñada con una tabla principal que muestra todas las asignaciones y un diálogo simplificado para crear o editar estas asociaciones.

-   **[Funcionalidad Clave] Nueva Herramienta "Corrección de Ingresos":**
    -   Se ha añadido una potente herramienta en **Almacén > Administración de Ingresos**.
    -   Permite a un supervisor buscar una unidad de inventario (lote/tarima) por múltiples criterios (fecha, producto, lote, etc.).
    -   Al seleccionar una unidad, se abre un modal que permite **corregir el producto o la cantidad** del ingreso original.
    -   Internamente, el sistema anula la unidad incorrecta y crea una nueva con los datos corregidos, generando los movimientos de inventario de entrada y salida correspondientes para una trazabilidad completa.

-   **[Funcionalidad Clave] Nuevo "Reporte de Catálogo":**
    -   Se ha añadido un nuevo reporte en **Analíticas > Reporte de Catálogo**.
    -   Permite auditar todas las asignaciones de producto-cliente-ubicación.
    -   Incluye filtros estándar por **rango de fechas**, búsqueda de texto, **clasificación de producto** y un nuevo filtro por **tipo de asignación** (General, Exclusivo, Sin Cliente).
    -   Cuenta con paginación y exportación a PDF y Excel.

### Mejoras de Experiencia de Usuario (UX)

-   **[UX] Fechas por Defecto en Reportes:** Todos los reportes de Analíticas ahora inician con el rango de fechas establecido en el día actual, facilitando la consulta de la información más reciente.
-   **[UX] Nomenclatura Intuitiva:** Se ha renombrado la tarjeta de acceso a la herramienta de asignaciones a "Catálogo Clientes y Artículos" para reflejar mejor su nueva funcionalidad.

---

## [2.1.1] - Publicado

### Mejoras Funcionales y de Experiencia de Usuario (UX)

-   **[Funcionalidad Clave] Búsqueda Universal por Código de Barras:**
    -   Se ha integrado la capacidad de buscar productos utilizando su código de barras en **toda la aplicación**.
    -   Los módulos **Cotizador, Planificador y Solicitudes de Compra** ahora permiten escanear o escribir un código de barras en el buscador de productos para una identificación instantánea.
    -   La importación de datos desde el ERP ha sido actualizada para incluir el campo `CODIGO_BARRAS_VENT`.

-   **[UX Almacén] Información de Producto Enriquecida:**
    -   En los módulos **Consulta de Almacén** y **Búsqueda Rápida**, los resultados ahora muestran información adicional crítica del producto:
        -   **Estado:** Una insignia visual ("Activo" en verde, "Inactivo" en rojo).
        -   **Unidad de Venta:** (Ej: CAJA, UND, PTE).
        -   **Notas:** Se muestran las notas del artículo directamente en la tarjeta si existen.
        -   **Código de Barras:** Se muestra el código de barras del producto.

-   **[UX Compras] Rediseño del Formulario de "Nueva Solicitud":**
    -   Se ha rediseñado el formulario emergente para crear una nueva solicitud de compra, organizando los campos en una cuadrícula de 3 columnas.
    -   Este cambio optimiza el uso del espacio en pantalla y asegura que todos los campos sean visibles sin necesidad de una barra de desplazamiento, solucionando problemas de desbordamiento visual.

-   **[Robustez] Prevención de Códigos de Ubicación Duplicados:**
    -   Se ha añadido una validación en la **Gestión de Ubicaciones** que impide a un administrador crear manualmente una nueva ubicación con un código que ya existe, previniendo errores de base de datos.

### Mejoras de Seguridad y Permisos

-   **[Seguridad] Permisos Granulares para Datos Financieros en Compras:**
    -   Se han introducido tres nuevos permisos para un control detallado sobre la información financiera en el módulo de Solicitudes de Compra:
        -   `requests:view:sale-price` (Ver Precio Venta)
        -   `requests:view:cost` (Ver Costo)
        -   `requests:view:margin` (Ver Margen)
    -   Estos permisos siguen una lógica de jerarquía: para ver el margen, se debe tener permiso para ver el costo, y para ver el costo, se debe tener permiso para ver el precio de venta.
    -   La interfaz ahora oculta estos campos a los usuarios que no posean dichos permisos.

### Mejoras Internas y de Estabilidad

-   **[Estabilidad] Corrección de Errores de Compilación:** Se solucionaron múltiples errores de `Cannot find module` que impedían que la aplicación se compilara correctamente. La causa raíz, relacionada con la carga inicial de la página y la detección de usuarios, ha sido resuelta para garantizar builds estables.
-   **[Calidad de Código] Centralización de Lógica Duplicada:**
    -   Se unificó la lógica para determinar si un usuario es "Administrador", utilizando el sistema de permisos (`hasPermission('admin:access')`) en lugar de comprobaciones directas, lo que hace el código más mantenible.
    -   Se eliminaron funciones duplicadas para obtener las iniciales de los usuarios, centralizando la lógica en un solo lugar.
-   **[UI] Corrección de Etiquetas de Almacén:** Se solucionó un problema en la generación de etiquetas PDF donde las rutas de ubicación largas se cortaban. Ahora, el texto se ajusta automáticamente en varias líneas para asegurar que la información siempre sea legible.
-   **[Preparación a Futuro] Cimientos para Módulo de Despacho:** Se ha integrado la infraestructura de base de datos y la lógica de importación para manejar datos de **facturas del ERP** (`erp_invoice_headers` y `erp_invoice_lines`). Aunque no hay una interfaz visible para el usuario final, este cambio sienta las bases para el futuro desarrollo del módulo de "Chequeo de Despacho".

## [2.1.0] - Publicado

### Mejoras de Calidad y Estabilidad

-   **[UX] Optimización del Flujo de Escáner:** En la pantalla de **Búsqueda Rápida de Almacén**, después de que un escáner introduce un código y presiona "Enter", el campo de búsqueda ahora se limpia y se re-enfoca automáticamente, permitiendo un flujo de escaneo continuo y sin interrupciones.

### Mejoras de Seguridad Críticas

-   **[Seguridad] Fortalecimiento del Sistema de Autenticación:**
    -   Se reemplazará el almacenamiento del ID de usuario en `sessionStorage` (inseguro y manipulable desde el navegador) por un sistema de **cookies seguras `httpOnly`**.
    -   Esto previene que un usuario pueda suplantar la identidad de otro (ej. un administrador) modificando variables en el navegador. La sesión ahora será gestionada de forma segura por el servidor.
-   **[Seguridad] Protección de Rutas de Descarga:**
    -   Se añadió una capa de autenticación y autorización a las rutas de descarga de archivos (`/api/temp-backups` y `/api/temp-exports`).
    -   A partir de ahora, solo los usuarios autenticados con los permisos adecuados (ej. `admin:maintenance:backup`) podrán descargar respaldos de bases de datos o reportes de Excel, previniendo fugas de información.

### Mejoras y Correcciones en Módulo de Almacén

-   **Asistente de Poblado de Racks (Funcionalidad Clave):**
    -   **[Nuevo] Capacidad de Retomar Sesiones:** Se ha implementado un sistema de "sesiones" robusto. Si un usuario inicia el asistente de poblado y luego navega a otro módulo, cierra la pestaña o su sesión expira, al volver a la herramienta podrá **continuar exactamente donde se quedó**.
    -   **[Solucionado] Error de Bloqueo por Sí Mismo:** Se solucionó el bug crítico que impedía a un usuario volver a usar el asistente si lo había abandonado sin finalizar, mostrándole que él mismo tenía el tramo bloqueado.
    -   **[Mejora] Detección Visual de Bloqueos:** La interfaz ahora detecta y deshabilita visualmente los niveles de un rack que ya están siendo poblados por otro usuario, previniendo errores y mejorando la claridad.
    -   **[Mejora] Indicador de Nivel Finalizado:** En el asistente, los niveles que ya han sido completamente poblados ahora muestran una etiqueta `(Finalizado)` para dar una retroalimentación visual clara al operario.
    -   **[Solucionado] Corrección del "Unknown" en Gestión de Bloqueos:** Se solucionó el error que causaba que el nombre del tramo bloqueado apareciera como "unknown".
    -   **[Estabilidad]** Se corrigieron múltiples errores de `NOT NULL constraint failed` y `Cannot read properties of undefined` que ocurrían debido a inconsistencias en la gestión del estado de la sesión, haciendo el asistente mucho más estable.

-   **Optimización para Dispositivos Móviles (Responsivo):**
    -   **[Mejora] Consulta de Almacén:** La página principal de búsqueda (`/warehouse/search`) fue rediseñada para una mejor experiencia en celulares y tablets. La barra de búsqueda ahora es fija en la parte superior, y los filtros adicionales se han movido a un panel lateral desplegable para una interfaz más limpia.
    -   **[Mejora] Gestión de Ubicaciones:** Se ajustó la disposición de los botones en pantallas pequeñas para un acceso más fácil y rápido.
    -   **[Mejora] Consistencia General:** Se aplicaron ajustes menores de diseño en todas las herramientas del módulo de Almacén para una experiencia más unificada.

### Correcciones Generales del Sistema

-   **[Estabilidad] Corrección de Errores de Renderizado en Servidor:** Se solucionó un error general (`Cannot read properties of undefined (reading 'call')`) que ocurría en varios módulos al no especificar correctamente que eran "componentes de cliente". Se añadió la directiva `"use client";` en todas las páginas afectadas, estabilizando la aplicación.

---

## [2.0.0] - Lanzamiento Inicial

-   Lanzamiento de la versión 2.0.0 de Clic-Tools.
-   Incluye los módulos de Cotizador, Planificador OP, Solicitudes de Compra, Asistente de Costos, Almacenes, Consultas Hacienda y el panel de Administración completo.
-   Arquitectura basada en Next.js App Router, componentes de servidor y bases de datos modulares SQLite.
