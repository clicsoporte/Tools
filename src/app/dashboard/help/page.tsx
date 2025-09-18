
"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "../../../modules/core/hooks/usePageTitle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { Code, FileUp, FileTerminal, Network, ShieldCheck, Users, Building, FileDown, PlusCircle, UserCog, DatabaseZap, Keyboard, DollarSign, ShieldQuestion, LifeBuoy, Rocket, Boxes, CalendarCheck, ShoppingCart, Truck, PackageCheck, Factory, CheckCircle, XCircle, ShieldAlert, Search, Wrench, Map, PackagePlus, BookMarked, Save, Copy, Folder, AlertTriangle, ToggleRight, FilePlusIcon, Warehouse, Send, Loader2 } from "lucide-react";
import type { Company } from "../../../modules/core/types";
import { getCompanySettings } from "../../../modules/core/lib/db-client";
import { Skeleton } from "../../../components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { logInfo } from "@/modules/core/lib/logger";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { useToast } from "@/modules/core/hooks/use-toast";

export default function HelpPage() {
  const { setTitle } = usePageTitle();
  const { user } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle("Centro de Ayuda");
    getCompanySettings().then(setCompany);
  }, [setTitle]);

  const handleSuggestionSubmit = async () => {
      if (!suggestion.trim() || !user) return;
      setIsSubmitting(true);
      try {
          await logInfo(`Sugerencia de Usuario: ${suggestion}`, { user: user.name, email: user.email });
          toast({
              title: "¡Gracias por tu Sugerencia!",
              description: "Hemos recibido tu idea y la revisaremos pronto.",
          });
          setSuggestion("");
      } catch (error) {
          toast({
              title: "Error al Enviar",
              description: "No se pudo enviar tu sugerencia en este momento.",
              variant: "destructive"
          });
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
        <Card>
            <CardHeader>
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
                    <LifeBuoy className="h-6 w-6" />
                </div>
                <div>
                    {company ? (
                    <CardTitle className="text-2xl">Manual de Usuario de {company.systemName || "la Aplicación"}</CardTitle>
                    ) : (
                        <Skeleton className="h-8 w-96" />
                    )}
                    <CardDescription>
                    Guía completa sobre cómo utilizar las herramientas y funcionalidades del
                    sistema.
                    </CardDescription>
                </div>
            </div>
            </CardHeader>
            <CardContent className="space-y-6">
            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg font-semibold">
                    <Rocket className="mr-4 h-6 w-6 text-blue-500" />
                    Introducción al Sistema
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base">
                    <p>
                    ¡Bienvenido a <strong>{company?.systemName || "la Aplicación"}</strong>! Piensa en este sistema como tu navaja suiza digital para las tareas diarias de la empresa. Ha sido diseñado para ser súper rápido y fácil de usar desde cualquier computadora en la oficina.
                    </p>
                    <p>
                    El objetivo es simple: tener todas las herramientas importantes (como hacer cotizaciones, solicitudes de compra o planificar la producción) en un solo lugar, con la flexibilidad de obtener datos tanto de archivos de texto como directamente desde el ERP.
                    </p>
                </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-quoter">
                <AccordionTrigger className="text-lg font-semibold">
                    <DollarSign className="mr-4 h-6 w-6 text-green-500" />
                    Tutorial: Módulo Cotizador
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Esta es tu herramienta principal para crear y enviar cotizaciones profesionales a los clientes. Sigue estos pasos:
                    </p>
                    <ul className="list-disc space-y-3 pl-6">
                    <li>
                        <strong>Paso 1: Elige al Cliente.</strong> Empieza a escribir el nombre o código del cliente. El sistema te mostrará una lista de sugerencias. Cuando lo veas, haz clic para seleccionarlo y todos sus datos se llenarán automáticamente (dirección, condición de pago, etc.).
                    </li>
                    <li>
                        <strong>Paso 2: Agrega Productos.</strong> En el buscador de productos, escribe el código o la descripción. Verás una lista de sugerencias con la cantidad que hay en el inventario del ERP. Presiona `Enter` o haz clic para añadirlo a la cotización.
                    </li>
                    <li>
                        <strong>Atajos de Teclado (<Keyboard className="inline h-4 w-4" />):</strong> Para ir más rápido, usa la tecla `Enter` en los campos de "Cantidad" y "Precio". Te llevará al siguiente campo y luego de vuelta al buscador de productos. ¡Es súper eficiente!
                    </li>
                    <li>
                        <strong>Paso 3: Generar PDF (<FileDown className="inline h-4 w-4" />):</strong> Cuando todo esté listo, genera un PDF profesional. El número de cotización se actualizará solo para la próxima vez.
                    </li>
                    </ul>
                </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-requests">
                <AccordionTrigger className="text-lg font-semibold">
                    <ShoppingCart className="mr-4 h-6 w-6 text-yellow-500" />
                    Tutorial: Módulo Solicitud de Compra
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Esta herramienta te permite crear, gestionar y dar seguimiento a las solicitudes de compra internas de manera centralizada.
                    </p>
                    <ul className="list-disc space-y-3 pl-6">
                    <li>
                        <strong>Paso 1: Crear Solicitud (<FilePlusIcon className="inline h-4 w-4" />):</strong> Haz clic en "Nueva Solicitud" para abrir el formulario. Busca al cliente y el artículo de la misma forma que en el cotizador. Completa los campos como la cantidad requerida, la fecha en que lo necesitas y el proveedor (si lo conoces).
                    </li>
                    <li>
                        <strong>Paso 2: Entender el Flujo de Estados.</strong> Las solicitudes pasan por varios estados para un seguimiento claro:
                        <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                            <li><strong>Pendiente:</strong> La solicitud ha sido creada y está esperando aprobación.</li>
                            <li><strong>Aprobada (<CheckCircle className="inline h-4 w-4 text-green-600"/>):</strong> Un usuario con permisos ha aprobado la compra.</li>
                            <li><strong>Ordenada (<Truck className="inline h-4 w-4 text-blue-600"/>):</strong> Ya se realizó el pedido al proveedor.</li>
                            <li><strong>Recibida (<PackageCheck className="inline h-4 w-4 text-teal-600"/>):</strong> El producto ha llegado. Aquí puedes registrar la cantidad real que se recibió.</li>
                            <li><strong>Cancelada (<XCircle className="inline h-4 w-4 text-red-600"/>):</strong> La solicitud ha sido cancelada.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Paso 3: Usar Prioridad y Cantidad Recibida.</strong> Puedes establecer una prioridad a la solicitud para indicar su urgencia. Al recibir el producto, puedes indicar si la cantidad recibida es diferente a la solicitada, y el sistema te mostrará la diferencia.
                    </li>
                    <li>
                        <strong>Paso 4: Navegar en el Historial.</strong> Para mantener la velocidad, la vista de "Archivadas" carga los datos por páginas. Puedes elegir ver 50, 100 o 200 registros por página y navegar entre ellas. Los filtros de búsqueda se aplicarán a todo el historial, no solo a la página actual.
                    </li>
                    </ul>
                </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-planner">
                <AccordionTrigger className="text-lg font-semibold">
                    <CalendarCheck className="mr-4 h-6 w-6 text-purple-500" />
                    Tutorial: Módulo Planificador OP
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Organiza y visualiza la carga de trabajo del taller o la producción. Permite un seguimiento detallado de cada orden.
                    </p>
                    <ul className="list-disc space-y-3 pl-6">
                        <li>
                            <strong>Paso 1: Crear Órdenes.</strong> Similar a los otros módulos, crea una nueva orden de producción buscando al cliente y el producto. Establece la cantidad, la fecha de entrega y la prioridad.
                        </li>
                        <li>
                            <strong>Paso 2: Programar por Rango de Fechas.</strong> Una orden de producción a menudo abarca varios días. Para reflejar esto, haz clic directamente en el área de "Fecha Programada" de una orden. Esto abrirá un calendario donde puedes seleccionar un rango de fechas de inicio y fin.
                        </li>
                        <li>
                            <strong>Paso 3: Gestionar Estados y Asignaciones.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li>Asigna cada orden a una máquina o proceso específico desde un menú desplegable. Puedes configurar estas máquinas en el panel de administración.</li>
                                <li>Cambia el estado de la orden (Aprobada, En Progreso, En Espera, Completada) para reflejar su avance en tiempo real.</li>
                                <li>**Estados Personalizados:** Define hasta 4 estados adicionales en la configuración para adaptar el flujo a tu proceso exacto (ej: "En Diseño", "Esperando Material").</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Paso 4: Usar Prioridades y Cuenta Regresiva.</strong> Utiliza el selector de prioridad (Urgente, Alta, etc.) y fíjate en el indicador de días restantes para organizar el trabajo. El indicador de días se basa en el tiempo programado, cambiando de color (verde {'>'} naranja {'>'} rojo) a medida que se acerca la fecha límite de producción.
                        </li>
                    </ul>
                </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-warehouse">
                    <AccordionTrigger className="text-lg font-semibold">
                        <Warehouse className="mr-4 h-6 w-6 text-cyan-600" />
                        Tutorial: Módulo de Almacenes
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Este módulo te da control sobre la ubicación de tu inventario. Su configuración, aunque potente, puede ser confusa al principio. Se basa en un concepto de dos pasos: el **Molde** y el **Árbol**.</p>
                        
                        <ul className="list-none space-y-3 pl-0">
                            <li>
                                <strong className="text-base">1. El Molde (Definir Jerarquía):</strong> Aquí le dices al sistema cómo organizas tu almacén, pero sin crear nada real todavía. Es solo la plantilla. Por ejemplo: le dices que usas "Bodegas", que dentro de ellas hay "Pasillos", y que en los pasillos hay "Racks".
                            </li>
                            <li>
                                <strong className="text-base">2. El Árbol (Crear Ubicaciones Reales):</strong> Una vez que tienes el "molde", aquí es donde creas el árbol real de tu almacén. Aquí es donde dices: "Ok, voy a crear una ubicación de tipo `Bodega` y se va a llamar `Bodega 04`". Luego, "dentro de Bodega 04, voy a crear una ubicación de tipo `Pasillo` y se va a llamar `Pasillo Bolsas 01`", y así sucesivamente.
                            </li>
                        </ul>

                        <h4 className="font-semibold text-lg pt-4 border-t">Tutorial Práctico: Configurando tu Almacén desde Cero</h4>
                        <p>Usemos un ejemplo real: tienes una bodega (`04`), con un pasillo (`01`) entre dos racks (`01` y `02`). Los productos se guardan en tarimas (`pallets`) que tienen una posición horizontal y vertical.</p>

                        <h5 className="font-semibold">Paso 1: Crear el "Molde" (La Jerarquía)</h5>
                        <ol className="list-decimal space-y-2 pl-6">
                            <li>Ve a <strong>Administración {'>'} Config. Almacenes</strong>.</li>
                            <li>En la sección <strong>"Paso 1: Definir Jerarquía del Almacén"</strong>, borra los niveles que existan.</li>
                            <li>Añade, en orden, los siguientes niveles:
                                <ul className="list-[circle] space-y-1 pl-5 mt-2">
                                    <li>Bodega</li>
                                    <li>Pasillo</li>
                                    <li>Rack</li>
                                    <li>Posición Horizontal</li>
                                    <li>Posición Vertical</li>
                                </ul>
                            </li>
                            <li>Haz clic en <strong>Guardar Niveles</strong>.</li>
                        </ol>

                        <h5 className="font-semibold">Paso 2: Construir el "Árbol" (Las Ubicaciones Reales)</h5>
                        <p>Ahora, en la sección **"Paso 2: Crear Ubicaciones Reales"**, vamos a construir el almacén pieza por pieza:</p>
                        <ol className="list-decimal space-y-3 pl-6">
                            <li>
                                <strong>Crear la Bodega:</strong>
                                <ul className="list-[circle] space-y-1 pl-5 mt-2 text-sm">
                                    <li>Haz clic en <strong>"Añadir Ubicación"</strong>.</li>
                                    <li><strong>Nombre:</strong> `Bodega 04`, <strong>Código:</strong> `B04`.</li>
                                    <li><strong>Tipo de Ubicación:</strong> `Nivel 1: Bodega`.</li>
                                    <li><strong>Ubicación Padre:</strong> Déjalo en `Sin padre`.</li>
                                    <li>Guarda. Ya tienes la raíz de tu árbol.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Crear el Pasillo:</strong>
                                <ul className="list-[circle] space-y-1 pl-5 mt-2 text-sm">
                                    <li>Haz clic de nuevo en <strong>"Añadir Ubicación"</strong>.</li>
                                    <li><strong>Nombre:</strong> `Pasillo 01`, <strong>Código:</strong> `P01`.</li>
                                    <li><strong>Tipo de Ubicación:</strong> `Nivel 2: Pasillo`.</li>
                                    <li><strong>Ubicación Padre:</strong> Selecciona `Bodega 04`.</li>
                                    <li>Guarda. Verás que `Pasillo 01` aparece anidado debajo de `Bodega 04`.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Crear los Racks:</strong> Repite el proceso para crear `Rack 01` (Código `R01`) y `Rack 02` (Código `R02`), ambos de tipo `Nivel 3: Rack` y ambos con `Pasillo 01` como padre.
                            </li>
                            <li>
                                <strong>Crear las Posiciones:</strong> Finalmente, puedes crear las posiciones dentro de cada rack. Por ejemplo, para crear la primera posición del Rack 01:
                                <ul className="list-[circle] space-y-1 pl-5 mt-2 text-sm">
                                    <li>Añade `Posición Horizontal 1` (Código `H1`), tipo `Nivel 4`, padre `Rack 01`.</li>
                                    <li>Añade `Posición Vertical 1` (Código `V1`), tipo `Nivel 5`, padre `Posición Horizontal 1`.</li>
                                </ul>
                                Tu ubicación final para un producto sería `B04 &gt; P01 &gt; R01 &gt; H1 &gt; V1`.
                            </li>
                        </ol>
                        <p className="pt-2">Una vez configurado, puedes ir al módulo <strong>Asignar Inventario</strong> para empezar a colocar tus artículos, como el `P011 BOLSA 20 X 30 X 2.5 TRANSPARENTE`, en estas nuevas ubicaciones.</p>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-admin">
                <AccordionTrigger className="text-lg font-semibold">
                    <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                    Tutorial: Panel de Administración
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Esta es la sala de máquinas del sistema, accesible solo para administradores. Aquí se configura todo.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <Users className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                            <div><h4 className="font-semibold">Gestión de Usuarios y Roles</h4><p>Crear, editar o eliminar usuarios y definir qué puede hacer cada uno usando roles y permisos detallados. Puedes crear roles personalizados (ej: "Comprador") y asignarle solo los permisos que necesita.</p></div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Building className="mt-1 h-6 w-6 text-orange-500 shrink-0" />
                            <div><h4 className="font-semibold">Configuración General y de Módulos</h4><p>Establecer los datos de tu empresa (nombre, logo, prefijos) y ajustar el comportamiento de cada módulo (Cotizador, Planificador, Compras, etc.) desde sus propias tarjetas de configuración.</p></div>
                        </div>
                        <div className="flex items-start gap-4">
                            <FileUp className="mt-1 h-6 w-6 text-cyan-500 shrink-0" />
                            <div>
                                <h4 className="font-semibold">Importar Datos</h4>
                                <p>Este es el centro de control para sincronizar los datos de tu ERP con la aplicación. Tienes dos modos:</p>
                                <ul className="list-inside list-[circle] pl-5 mt-2 text-sm">
                                    <li><strong>Desde Archivos:</strong> Configura las rutas completas a los archivos `.txt` o `.csv` en el servidor y procesa cada uno manualmente.</li>
                                    <li><strong>Desde SQL Server:</strong> Conecta la aplicación directamente a la base de datos de tu ERP para una sincronización robusta con un solo clic.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <DatabaseZap className="mt-1 h-6 w-6 text-red-500 shrink-0" />
                            <div><h4 className="font-semibold">Mantenimiento</h4><p>Realiza copias de seguridad (backup) de la base de datos de cada módulo, restáuralas, o reinicia un módulo a su estado de fábrica si algo sale mal.</p></div>
                        </div>
                    </div>
                </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-import">
                    <AccordionTrigger className="text-lg font-semibold">
                    <DatabaseZap className="mr-4 h-6 w-6 text-red-500" />
                    Tutorial: Importación de Datos (Archivos y SQL)
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>La importación se gestiona desde <strong>Administración {'>'} Importar Datos</strong>. Aquí puedes elegir el método que mejor se adapte a tus necesidades.</p>
                        
                        <h4 className="font-semibold">Modo 1: Desde Archivos (.txt / .csv)</h4>
                        <p>Este método es útil para una configuración rápida o si no tienes acceso directo a la base de datos del ERP.</p>
                        <ol className="list-decimal space-y-2 pl-6">
                            <li>Activa el interruptor en "Importar desde Archivos".</li>
                            <li>Asegúrate de que tus archivos de texto (`.txt` separados por tabulador o `.csv` para CABYS) estén en una carpeta en el servidor.</li>
                            <li>En cada tarjeta, introduce la <strong>ruta completa</strong> al archivo correspondiente (ej: `C:\\import_data\\clientes.txt`).</li>
                            <li>Haz clic en el botón "Procesar Archivo" de cada tarjeta para cargar los datos.</li>
                        </ol>

                        <h4 className="font-semibold">Modo 2: Desde SQL Server (Recomendado)</h4>
                        <p>Este método es el más robusto y eficiente. Sincroniza los datos directamente desde tu ERP a la base de datos local de la aplicación.</p>
                        <ol className="list-decimal space-y-2 pl-6">
                            <li>Activa el interruptor en "Importar desde SQL Server".</li>
                            <li>Despliega la sección <strong>"Configuración de Conexión a SQL Server"</strong>.</li>
                            <li>Rellena los datos de tu servidor ERP. <strong>Importante:</strong> Por seguridad, se recomienda crear un usuario de SQL que solo tenga permisos de <strong>lectura (`SELECT`)</strong> sobre las tablas o vistas necesarias.</li>
                            <li>Guarda la configuración. Estos datos se almacenarán de forma segura en un archivo `.env` en el servidor.</li>
                            <li>Despliega la sección <strong>"Gestión de Consultas SQL"</strong>.</li>
                            <li>Para cada tipo de dato (Clientes, Artículos, etc.), pega la consulta `SELECT` que extrae la información de tu ERP. Asegúrate de que los nombres de las columnas en tu `SELECT` coincidan con los esperados por el sistema (ej. `SELECT ID_Cliente AS CLIENTE, NombreCliente AS NOMBRE, ... FROM VistaClientes`).</li>
                            <li>Guarda las consultas.</li>
                            <li>Una vez configurado, solo tienes que hacer clic en el botón grande <strong>"Importar Todos los Datos desde ERP"</strong> para ejecutar todas las consultas y actualizar la base de datos local.</li>
                        </ol>
                        <Alert>
                            <ToggleRight className="h-4 w-4" />
                            <AlertTitle>Botón de Sincronización Rápida</AlertTitle>
                            <AlertDescription>
                                Puedes dar permiso (`admin:import:run`) a ciertos roles para que vean un botón de "Sincronizar Datos del ERP" en el panel principal. Esto les permite actualizar los datos sin necesidad de acceder a la pantalla de configuración.
                            </AlertDescription>
                        </Alert>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-user-profile">
                <AccordionTrigger className="text-lg font-semibold">
                    <UserCog className="mr-4 h-6 w-6 text-blue-500" />
                    Tutorial: Mi Perfil
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base">
                    <div className="flex items-start gap-4">
                        <UserCog className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                        <div>
                            <p>
                            Aquí puedes personalizar tu propia cuenta de usuario.
                            </p>
                            <ul className="list-disc space-y-2 pl-6">
                                <li>Actualiza tu nombre, teléfono y WhatsApp.</li>
                                <li>Cambia tu foto de perfil haciendo clic sobre el círculo con tus iniciales.</li>
                                <li>Cambia tu contraseña.</li>
                                <li>Configura una pregunta de seguridad para poder recuperar tu cuenta si olvidas la contraseña.</li>
                            </ul>
                        </div>
                    </div>
                </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-update">
                    <AccordionTrigger className="text-lg font-semibold">
                    <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                    Guía: ¿Cómo se actualiza la aplicación?
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Actualizar la aplicación a una nueva versión sin perder tus datos es un proceso crítico. El sistema está diseñado para manejar esto de forma segura gracias a las **migraciones automáticas**.</p>
                        
                        <h4 className="font-semibold">Proceso de Actualización Seguro:</h4>
                        <ol className="list-decimal space-y-3 pl-6">
                            <li>
                                <strong>Paso 1: Realizar una Copia de Seguridad (<Copy className="inline h-4 w-4"/>).</strong> Este es el paso más importante. Antes de tocar nada, ve al directorio de la aplicación en tu servidor y haz una copia de seguridad completa de la carpeta `dbs/`. Esta carpeta contiene todas tus bases de datos (usuarios, órdenes, solicitudes, etc.).
                            </li>
                            <li>
                                <strong>Paso 2: Reemplazar Archivos.</strong> Detén la aplicación (por ejemplo, usando `pm2 stop clic-tools`). Luego, borra todos los archivos y carpetas de la versión anterior **excepto** la carpeta `dbs/` y, si existe, el archivo `.env.local`. Después, copia todos los archivos de la nueva versión en su lugar.
                            </li>
                            <li>
                                <strong>Paso 3: Actualizar y Reconstruir.</strong> Abre una terminal en la carpeta del proyecto, ejecuta `npm install --omit=dev` para instalar cualquier nueva dependencia y luego `npm run build` para compilar la nueva versión.
                            </li>
                            <li>
                                <strong>Paso 4: Reiniciar.</strong> Vuelve a iniciar la aplicación (ej: `pm2 start clic-tools`). Al arrancar, el sistema detectará que las bases de datos en la carpeta `dbs/` no tienen las últimas columnas o tablas y las añadirá automáticamente sin borrar los datos existentes.
                            </li>
                        </ol>
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>¡Atención!</AlertTitle>
                            <AlertDescription>
                                Nunca reemplaces la carpeta `dbs/` del servidor con la de la nueva versión, ya que esto borraría todos tus datos de producción.
                            </AlertDescription>
                        </Alert>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Buzón de Sugerencias y Mejoras</CardTitle>
                <CardDescription>
                    ¿Tienes una idea para mejorar la aplicación? ¿Encontraste algo que no funciona como esperabas? Déjanos tu sugerencia aquí.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="suggestion-box">Tu sugerencia</Label>
                    <Textarea
                        id="suggestion-box"
                        placeholder="Describe tu idea o el problema que encontraste..."
                        rows={4}
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSuggestionSubmit} disabled={isSubmitting || !suggestion.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar Sugerencia
                </Button>
            </CardFooter>
        </Card>
      </div>
    </main>
  );
}
