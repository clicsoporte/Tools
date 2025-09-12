
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
import { Code, FileUp, FileTerminal, Network, ShieldCheck, Users, Building, FileDown, PlusCircle, UserCog, DatabaseZap, Keyboard, DollarSign, ShieldQuestion, LifeBuoy, Rocket, Boxes, CalendarCheck, ShoppingCart, Truck, PackageCheck, Factory, CheckCircle, XCircle, ShieldAlert, Search, Wrench, Map, PackagePlus, Warehouse, AlertCircle, Database, ToggleRight } from "lucide-react";
import type { Company } from "../../../modules/core/types";
import { getCompanySettings } from "../../../modules/core/lib/db-client";
import { Skeleton } from "../../../components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HelpPage() {
  const { setTitle } = usePageTitle();
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    setTitle("Centro de Ayuda");
    getCompanySettings().then(setCompany);
  }, [setTitle]);

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
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
          <Accordion type="single" collapsible className="w-full">
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
                  El objetivo es simple: tener todas las herramientas importantes (como hacer cotizaciones o planificar la producción) en un solo lugar, con la flexibilidad de obtener datos tanto de archivos de texto como directamente desde el ERP.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <DollarSign className="mr-4 h-6 w-6 text-green-500" />
                Módulo Cotizador
              </AccordionTrigger>
              <AccordionContent className="prose max-w-none text-base space-y-4">
                <p>
                  Esta es tu herramienta principal para crear y enviar cotizaciones profesionales a los clientes. Sigue estos pasos:
                </p>
                <ul className="list-disc space-y-3 pl-6">
                  <li>
                    <strong>Paso 1: Elige al Cliente.</strong> Empieza a escribir el nombre o código del cliente. El sistema te mostrará una lista de sugerencias. Cuando lo veas, haz clic para seleccionarlo y todos sus datos se llenarán automáticamente.
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
            
            <AccordionItem value="item-admin">
              <AccordionTrigger className="text-lg font-semibold">
                <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                Panel de Administración
              </AccordionTrigger>
              <AccordionContent className="prose max-w-none text-base space-y-4">
                <p>
                  Esta es la sala de máquinas del sistema, accesible solo para administradores. Aquí se configura todo.
                </p>
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <Users className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                        <div><h4 className="font-semibold">Gestión de Usuarios y Roles</h4><p>Crear, editar o eliminar usuarios y definir qué puede hacer cada uno usando roles y permisos detallados.</p></div>
                    </div>
                     <div className="flex items-start gap-4">
                        <Building className="mt-1 h-6 w-6 text-orange-500 shrink-0" />
                        <div><h4 className="font-semibold">Configuración General y de Módulos</h4><p>Establecer los datos de tu empresa (nombre, logo, prefijos) y ajustar el comportamiento de cada módulo.</p></div>
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
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-import">
                <AccordionTrigger className="text-lg font-semibold">
                  <DatabaseZap className="mr-4 h-6 w-6 text-red-500" />
                  Guía de Importación de Datos
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>La importación se gestiona desde **Administración {'>'} Importar Datos**. Aquí puedes elegir el método que mejor se adapte a tus necesidades.</p>
                    
                    <h4 className="font-semibold">Modo 1: Desde Archivos (.txt / .csv)</h4>
                    <p>Este método es útil para una configuración rápida o si no tienes acceso directo a la base de datos del ERP.</p>
                    <ol className="list-decimal space-y-2 pl-6">
                        <li>Activa el interruptor en "Importar desde Archivos".</li>
                        <li>Asegúrate de que tus archivos de texto (`.txt` separados por tabulador o `.csv` para CABYS) estén en una carpeta en el servidor.</li>
                        <li>En cada tarjeta, introduce la **ruta completa** al archivo correspondiente (ej: `C:\import_data\clientes.txt`).</li>
                        <li>Haz clic en el botón "Procesar Archivo" de cada tarjeta para cargar los datos.</li>
                    </ol>

                    <h4 className="font-semibold">Modo 2: Desde SQL Server (Recomendado)</h4>
                    <p>Este método es el más robusto y eficiente. Sincroniza los datos directamente desde tu ERP a la base de datos local de la aplicación.</p>
                     <ol className="list-decimal space-y-2 pl-6">
                        <li>Activa el interruptor en "Importar desde SQL Server".</li>
                        <li>Despliega la sección **"Configuración de Conexión a SQL Server"**.</li>
                        <li>Rellena los datos de tu servidor ERP. **Importante:** Por seguridad, se recomienda crear un usuario de SQL que solo tenga permisos de **lectura (`SELECT`)** sobre las tablas o vistas necesarias.</li>
                        <li>Guarda la configuración. Estos datos se almacenarán de forma segura en un archivo `.env` en el servidor.</li>
                        <li>Despliega la sección **"Gestión de Consultas SQL"**.</li>
                        <li>Para cada tipo de dato (Clientes, Artículos, etc.), pega la consulta `SELECT` que extrae la información de tu ERP. Asegúrate de que los nombres de las columnas en tu `SELECT` coincidan con los esperados por el sistema (ej. `SELECT ID_Cliente AS CLIENTE, NombreCliente AS NOMBRE, ... FROM VistaClientes`).</li>
                        <li>Guarda las consultas.</li>
                        <li>Una vez configurado, solo tienes que hacer clic en el botón grande **"Importar Todos los Datos desde ERP"** para ejecutar todas las consultas y actualizar la base de datos local.</li>
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
                Mi Perfil
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
          </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}
