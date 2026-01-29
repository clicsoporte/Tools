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

## [2.7.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Lógica Inteligente de Multi-Ubicación para Productos:**
    -   Se ha rediseñado por completo la lógica de asignación de ubicaciones para reflejar la realidad de un almacén dinámico. El sistema ahora permite de forma intencional que un mismo producto resida en múltiples ubicaciones.
    -   **Flujo Deliberado con Decisión:** En el **"Catálogo Clientes y Artículos"** y en el **"Asistente de Recepción"**, al asignar un producto a una nueva ubicación, el sistema ahora detecta si ya tiene un "hogar" y presenta un diálogo de decisión claro:
        -   **Mover a la nueva ubicación:** Actualiza el registro existente, moviendo el producto de su ubicación anterior a la nueva.
        -   **Agregar como ubicación adicional:** Crea un nuevo registro, permitiendo que el producto tenga múltiples ubicaciones designadas.
    -   Esta mejora previene errores y la creación de datos duplicados, dando al usuario control total sobre la estructura del catálogo.

-   **[UX Almacén] Asistente de Poblado con Auditoría Automática:**
    -   Para no sacrificar su velocidad, el asistente **mantiene el guardado inmediato** de cada asignación escaneada, asegurando que no se pierdan datos.
    -   **Resumen Inteligente al Finalizar:** Al terminar una sesión, el asistente ahora presenta una ventana de resumen que **resalta en rojo** cualquier producto que haya sido asignado a múltiples ubicaciones durante esa sesión.
    -   **Notificación Automática por Correo:** Junto con el resumen, el sistema **envía automáticamente un correo electrónico** a los supervisores con los detalles de las ubicaciones múltiples detectadas, garantizando una auditoría proactiva sin interrumpir al operario.

-   **[UX Reportes] Reporte de Catálogo Depurado y Preciso:**
    -   El **Reporte de Catálogo** ha sido mejorado para reflejar la nueva lógica de multi-ubicación.
    -   En lugar de mostrar filas duplicadas, ahora agrupa las ubicaciones por producto, mostrando todas las ubicaciones asignadas en una sola vista consolidada. Esto ofrece un panorama limpio y preciso del estado actual del inventario.

-   **[Mejora de UX] Optimización del Asistente de Recepción:**
    -   La opción **"Guardar como ubicación predeterminada"** ahora viene activada por defecto para agilizar el proceso de registro.
    -   La lista de ubicaciones sugeridas ahora se actualiza en tiempo real dentro de la misma sesión, eliminando la necesidad de salir y volver a entrar para ver los cambios recientes.

---

## [2.6.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Configuración de Alias para Reporte de Tránsitos:**
    -   Se ha añadido una nueva sección de configuración en **Administración > Analíticas**.
    -   Desde aquí, ahora puedes definir **alias de texto y colores personalizados** para cada estado de las órdenes de compra del ERP (ej: `A` = "Activa" en color verde, `E` = "Enviada" en azul).
    -   Esta funcionalidad, inspirada en la gestión de bodegas, te da control total sobre cómo se interpreta y visualiza la información de tránsito en toda la aplicación.
-   **[UX Reportes] Filtro de Estados Múltiples en Reporte de Tránsitos:**
    -   El **Reporte de Tránsitos** ahora incluye un nuevo filtro multi-selección para los **estados**.
    -   Los estados que aparecen en el filtro utilizan los alias y colores que configuraste en el paso anterior, haciendo la interfaz más intuitiva.
    -   Por defecto, el filtro seleccionará todos los estados que no sean finales (como "Recibida" o "Anulada"), pero puedes personalizar la vista para incluir o excluir los que necesites.
    -   Tus preferencias de columnas y filtros de estado ahora se guardan por usuario.

### Correcciones y Mejoras Internas

-   **[Corrección Crítica] Reparación de Importación de Tránsitos:** Se ha corregido un error crítico en el sistema de importación de datos desde archivos. Previamente, el sistema estaba ignorando incorrectamente los archivos de órdenes de compra del ERP (`erp_purchase_order_headers.txt` y `erp_purchase_order_lines.txt`), lo que causaba que el Reporte de Tránsitos no mostrara datos actualizados. Con esta corrección, la sincronización de tránsitos vuelve a funcionar como se esperaba.
-   **[Estabilidad] Carga Automática en Reportes:** Se ha ajustado la lógica de carga en todos los reportes de Analíticas. Ahora, ningún reporte cargará datos automáticamente al abrir la página. El usuario debe siempre hacer clic en "Generar Reporte" para iniciar la consulta, previniendo sobrecargas de rendimiento con grandes volúmenes de datos.
-   **[Refactorización]** Se ha centralizado la lógica de obtención de datos para todos los reportes de Analíticas en un archivo de acciones dedicado, mejorando la organización y mantenibilidad del código.

---

## [2.5.0] - Publicado

### Mejoras de Experiencia de Usuario (UX)

-   **[UX] Mejoras en Administración de Ingresos:**
    -   Se ha añadido **paginación** a la tabla de resultados, permitiendo manejar miles de registros sin afectar el rendimiento.
    -   Se ha integrado un nuevo filtro **"Mostrar solo pendientes"** que está activado por defecto, enfocando la vista en las tareas que requieren acción. La preferencia de este filtro se guarda por usuario.
-   **[UX] Indicador Visual de Ubicaciones Mixtas:**
    -   En todas las herramientas del módulo de Almacén (Asistente de Recepción, Catálogo, Consultas, etc.), las ubicaciones que contienen más de un tipo de producto ahora muestran una insignia roja **"(Mixta)"**.
    -   Esto proporciona visibilidad inmediata al operario sobre el estado de una ubicación sin necesidad de generar un reporte.
-   **[UX] Notificación de Sincronización Mejorada:** El mensaje que aparece al finalizar la sincronización del ERP ahora muestra un recuento más claro del progreso (ej: "Se han procesado 10 de 11 tipos de datos").

### Correcciones y Mejoras Internas

-   **[Funcionalidad] Búsqueda por Código de Barras Universal:** Se ha habilitado la búsqueda por código de barras en todos los buscadores de productos de la aplicación (Cotizador, Planificador, Compras, Almacén) para una mayor consistencia y agilidad.
-   **[Corrección] Logo en PDF de Ingresos:** Se solucionó un error que impedía que el logo de la empresa se mostrara en los comprobantes de ingreso y anulación generados desde la Administración de Ingresos.
-   **[Corrección] Título de Página Dinámico:** Se arregló un problema que causaba que el título en la cabecera de la aplicación no se actualizara correctamente al navegar entre diferentes herramientas del panel de Administración.
-   **[Lógica] Asistente de Recepción Inteligente:** Se corrigió la lógica del asistente. Ahora, la advertencia de "Ubicación Ocupada" solo aparecerá si se intenta ingresar un producto en una ubicación que ya contiene un artículo **diferente**, y no cuando se agrega más stock del mismo producto.
-   **[Documentación] Centro de Ayuda Actualizado:** Se ha ampliado y actualizado el manual de usuario con tutoriales detallados que explican la diferencia entre las herramientas de almacén y cómo realizar traslados de inventario.

---

## [2.4.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Generación de Boletas de Ingreso/Corrección (PDF):**
    -   Se ha añadido un nuevo botón de **impresión** en cada fila de la herramienta **"Administración de Ingresos"**.
    -   Al hacer clic, el sistema genera una boleta en formato PDF, ideal para auditorías de **ISO 9001**.
    -   **Contenido Dinámico:** La boleta adapta su título y contenido según el estado del registro:
        -   **Ingreso Normal:** Se titula **"Comprobante de Ingreso"**.
        -   **Anulación:** Se titula **"Comprobante de Anulación"** y muestra a qué ingreso original anula.
        -   **Corrección:** Se titula **"Comprobante de Ingreso (por Corrección)"** y muestra a qué ingreso reemplaza.
    -   **Trazabilidad Completa:** La boleta incluye todos los detalles: producto, cantidades, lotes, documentos asociados (ERP y origen), y el nombre del usuario que **recibió** y el que **aplicó** el ingreso.
    -   **Personalización:** Se puede configurar una "Leyenda Superior" (ej: "Documento Controlado - ISO 9001") desde la Configuración de Almacenes.
-   **[Funcionalidad] Campo de Notas en Recepción:**
    -   El "Asistente de Recepción" ahora incluye un campo opcional para añadir **notas** al momento de registrar un nuevo ingreso.
    -   Estas notas quedan registradas en el sistema y se imprimen en la boleta de ingreso correspondiente, permitiendo documentar cualquier eventualidad durante la recepción (ej: "caja golpeada").

---

## [2.3.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Nuevo Flujo de Aprobación para Ingresos de Mercadería:**
    -   Se ha introducido un sistema de estados para la herramienta **"Administración de Ingresos"**.
    -   **Nuevos Estados:** Los ingresos creados desde el "Asistente de Recepción" ahora entran en estado **"Pendiente"**.
    -   **Revisión y Aplicación:** Un supervisor puede ahora "Revisar y Aplicar" un ingreso pendiente. En esta etapa, se pueden **editar todos los campos**, incluyendo `Producto`, `Cantidad`, `Lote` y, crucialmente, añadir el **Nº de Documento ERP** que se genera horas después de la recepción física. Al "Aplicar", el registro se actualiza y se marca como final.
    -   **Corrección Post-Aplicación:** Una vez que un ingreso está "Aplicado", el flujo de "Corrección" funciona como antes: anula el ingreso original y crea uno nuevo, manteniendo una trazabilidad completa de los cambios.
    -   Este cambio proporciona la flexibilidad necesaria para completar la información del ERP sin perder el control ni la capacidad de auditoría.

-   **[UX Reportes] Mejoras en Reporte de Ocupación:**
    -   La columna "Artículos" en el "Reporte de Ocupación" ahora muestra directamente el **código del artículo** además de la descripción cuando una ubicación está ocupada por un solo producto.
    -   Se han añadido nuevos **filtros jerárquicos** por **Rack** y **Nivel**, permitiendo un análisis mucho más granular del estado de las ubicaciones.
    -   El buscador del reporte ahora también indexa el código del artículo.

### Mejoras Internas y de Estabilidad

-   **[Estabilidad]** Se corrigió un error de compilación (`Property 'disabled' does not exist`) relacionado con el componente de filtro múltiple, mejorando la estabilidad de la página de reportes.

---

## [2.2.0] - Publicado

### Funcionalidades y Mejoras Principales

-   **[Funcionalidad Clave] Nuevo Módulo "Catálogo de Clientes y Artículos":**
    -   Se ha evolucionado la herramienta "Asignar Ubicación" a un módulo de catálogo completo.
    -   Permite crear una asociación entre un **producto**, una **ubicación** y, opcionalmente, un **cliente**.
    -   **Exclusividad:** Se puede marcar una asignación como "Exclusiva" para un cliente, indicando que ese producto en esa ubicación es solo para él.
    -   La interfaz ha sido rediseñada con una tabla principal que muestra todas las asignaciones y un diálogo simplificado para crear o editar estas asociaciones.

-   **[Funcionalidad Clave] Nueva Herramienta "Administración de Ingresos" (Corrección):**
    -   Se ha añadido una potente herramienta en **Almacén &gt; Administración de Ingresos**.
    -   Permite a un supervisor buscar una unidad de inventario (lote/tarima) por múltiples criterios (fecha, producto, lote, consecutivo, etc.).
    -   Al seleccionar una unidad, se abre un modal que permite **corregir el producto o la cantidad** del ingreso original.
    -   Internamente, el sistema anula la unidad incorrecta y crea una nueva con los datos corregidos, generando los movimientos de inventario de entrada y salida correspondientes para una trazabilidad completa.

-   **[Funcionalidad Clave] Nuevo "Reporte de Catálogo":**
    -   Se ha añadido un nuevo reporte en **Analíticas &gt; Reporte de Catálogo**.
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
