/**
 * @fileoverview This file defines the core TypeScript types used throughout the application.
 * Using centralized types helps ensure data consistency and provides autocompletion benefits.
 */

import type { LucideIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

/**
 * Represents a user account in the system.
 */
export type User = {
  id: number;
  name: string;
  email: string;
  password?: string; // Hashed password from DB, or plaintext only when updating.
  phone: string;
  whatsapp: string;
  avatar: string;
  role: string; // Corresponds to a Role ID
  erpAlias?: string; // User's username in the external ERP system
  recentActivity: string;
  securityQuestion?: string;
  securityAnswer?: string;
};

/**
 * Represents the company's general information.
 */
export type Company = {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
    systemName?: string;
    quotePrefix: string;
    nextQuoteNumber: number;
    decimalPlaces: number;
    quoterShowTaxId?: boolean;
    searchDebounceTime?: number;
    syncWarningHours?: number;
    importMode: 'file' | 'sql';
    lastSyncTimestamp?: string | null;
    customerFilePath?: string;
    productFilePath?: string;
    exemptionFilePath?: string;
    stockFilePath?: string;
    locationFilePath?: string;
    cabysFilePath?: string;
    supplierFilePath?: string;
};

/**
 * Represents a tool or module accessible from a dashboard.
 */
export type Tool = {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  adminOnly?: boolean;
};

/**
 * Defines a user role and its associated permissions.
 */
export type Role = {
  id: string;
  name: string;
  permissions: string[];
};

/**
 * Represents a customer, typically imported from an ERP system.
 */
export type Customer = {
    id: string; // CLIENTE
    name: string; // NOMBRE
    address: string; // DIRECCION
    phone: string; // TELEFONO1
    taxId: string; // CONTRIBUYENTE
    currency: string; // MONEDA
    creditLimit: number; // LIMITE_CREDITO
    paymentCondition: string; // CONDICION_PAGO
    salesperson: string; // VENDEDOR
    active: 'S' | 'N'; // ACTIVO
    email: string; // E_MAIL
    electronicDocEmail: string; // EMAIL_DOC_ELECTRONICO
};

/**
 * Represents a product or article, typically imported from an ERP system.
 */
export type Product = {
    id: string;             // ARTICULO
    description: string;    // DESCRIPCION
    classification: string; // CLASIFICACION_2
    lastEntry: string;      // ULTIMO_INGRESO
    active: 'S' | 'N';      // ACTIVO
    notes: string;          // NOTAS
    unit: string;           // UNIDAD_VENTA
    isBasicGood: 'S' | 'N'; // CANASTA_BASICA
    cabys: string;          // CODIGO_HACIENDA
};

/**
 * Represents a single line item within a quote.
 */
export type QuoteLine = {
    id: string; // Unique identifier for the line item in the UI
    product: Product; // The product details
    quantity: number;
    price: number;
    tax: number;
    // display fields are used to hold the string value from the input
    // before it's parsed, allowing for more flexible user input.
    displayQuantity: string;
    displayPrice: string;
};


/**
 * Represents the structure of the exchange rate API response.
 */
export type ExchangeRateApiResponse = {
    compra?: { fecha: string; valor: number; };
    venta: { fecha: string; valor: number; };
}

/**
 * Represents a saved quote draft.
 */
export type QuoteDraft = {
    id: string;
    createdAt: string;
    userId: number;
    customerId: string | null;
    customer?: Customer | null;
    lines: Omit<QuoteLine, 'displayQuantity' | 'displayPrice'>[];
    totals: {
        subtotal: number;
        totalTaxes: number;
        total: number;
    };
    notes: string;
    currency: string;
    exchangeRate: number | null;
    purchaseOrderNumber?: string;
    // Fields for complete form state restoration
    customerDetails?: string;
    deliveryAddress?: string;
    deliveryDate?: string;
    sellerName?: string;
    sellerType?: string;
    quoteDate?: string;
    validUntilDate?: string;
    paymentTerms?: string;
    creditDays?: number;
}

/**
* Represents a system log entry for auditing and debugging.
*/
export type LogEntry = {
    id: number;
    timestamp: string;
    type: "INFO" | "WARN" | "ERROR";
    message: string;
    details?: any; // Stored as a JSON string in the DB
};

/**
 * Represents the settings for external APIs.
 */
export type ApiSettings = {
    exchangeRateApi: string;
    haciendaExemptionApi: string;
    haciendaTributariaApi: string;
};

/**
 * Represents a database module for modular maintenance operations.
 */
export type DatabaseModule = {
    id: string; // e.g., 'clic-tools-main'
    name: string; // e.g., 'Clic-Tools (Sistema Principal)'
    dbFile: string; // e.g., 'intratool.db'
    initFn?: (db: any) => void;
    migrationFn?: (db: any) => void;
};

/**
 * Represents a customer's tax exemption record from the ERP.
 */
export type Exemption = {
    code: string;
    description: string;
    customer: string;
    authNumber: string;
    startDate: string;
    endDate: string;
    percentage: number;
    docType: string;
    institutionName: string;
    institutionCode: string;
};


/**
 * Represents a configurable exemption law in the system.
 */
export type ExemptionLaw = {
  docType: string; // e.g., '99' or '03'
  institutionName: string; // e.g., 'Régimen de Zona Franca'
  authNumber: string | null; // e.g., '9635', only for specific cases
};


// --- Production Planner Types ---

export type ProductionOrderStatus = 'pending' | 'approved' | 'in-queue' | 'in-progress' | 'on-hold' | 'in-maintenance' | 'completed' | 'received-in-warehouse' | 'canceled' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
export type AdministrativeAction = 'unapproval-request' | 'cancellation-request' | 'none';
export type ProductionOrderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProductionOrder = {
  id: number;
  consecutive: string;
  purchaseOrder?: string;
  requestDate: string;
  deliveryDate: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  customerId: string;
  customerName: string;
  customerTaxId: string;
  productId: string;
  productDescription: string;
  quantity: number;
  inventory?: number;
  inventoryErp?: number;
  priority: ProductionOrderPriority;
  status: ProductionOrderStatus;
  pendingAction: AdministrativeAction;
  notes?: string;
  requestedBy: string;
  approvedBy?: string;
  lastStatusUpdateBy?: string;
  lastStatusUpdateNotes?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  hasBeenModified?: boolean;
  deliveredQuantity?: number;
  defectiveQuantity?: number;
  erpPackageNumber?: string;
  erpTicketNumber?: string;
  erpOrderNumber?: string;
  reopened?: boolean;
  machineId?: string | null;
  shiftId?: string | null;
  previousStatus?: ProductionOrderStatus | null;
};

export type UpdateProductionOrderPayload = Partial<Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'machineId' | 'previousStatus' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes' | 'approvedBy' | 'lastModifiedBy' | 'lastModifiedAt' | 'hasBeenModified' | 'pendingAction'>> & {
    orderId: number;
    updatedBy: string;
};

export type ProductionOrderHistoryEntry = {
    id: number;
    orderId: number;
    timestamp: string;
    status: ProductionOrderStatus;
    notes?: string;
    updatedBy: string;
};

export type PlannerMachine = {
  id: string;
  name: string;
};

export type PlannerShift = {
  id: string;
  name: string;
};

export type CustomStatus = {
    id: 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
    label: string;
    color: string;
    isActive: boolean;
};

export type PlannerSettings = {
    orderPrefix?: string;
    nextOrderNumber?: number;
    useWarehouseReception: boolean;
    showCustomerTaxId: boolean;
    machines: PlannerMachine[];
    shifts: PlannerShift[];
    requireMachineForStart: boolean;
    requireShiftForCompletion: boolean;
    assignmentLabel: string;
    customStatuses: CustomStatus[];
    pdfPaperSize: 'letter' | 'legal';
    pdfOrientation: 'portrait' | 'landscape';
    pdfExportColumns: string[];
    pdfTopLegend?: string;
    fieldsToTrackChanges: string[];
};

export type UpdateStatusPayload = {
    orderId: number;
    status: ProductionOrderStatus;
    notes: string;
    updatedBy: string;
    deliveredQuantity?: number;
    defectiveQuantity?: number;
    erpPackageNumber?: string;
    erpTicketNumber?: string;
    reopen: boolean;
};

export type UpdateOrderDetailsPayload = {
  orderId: number;
  priority?: ProductionOrderPriority;
  machineId?: string | null;
  shiftId?: string | null;
  scheduledDateRange?: DateRange;
  updatedBy: string;
};


// --- Purchase Request Types ---

export type PurchaseRequestStatus = 'pending' | 'approved' | 'ordered' | 'received' | 'received-in-warehouse' | 'canceled';
export type PurchaseRequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PurchaseType = 'single' | 'multiple';

export type PurchaseRequest = {
  id: number;
  consecutive: string;
  purchaseOrder?: string; // Nº Orden de Compra Cliente
  requestDate: string;
  requiredDate: string;
  arrivalDate?: string;
  receivedDate?: string;
  clientId: string;
  clientName: string;
  clientTaxId: string;
  itemId: string;
  itemDescription: string;
  quantity: number;
  deliveredQuantity?: number;
  inventory?: number;
  priority: PurchaseRequestPriority;
  purchaseType: PurchaseType;
  unitSalePrice?: number; // Precio de venta unitario sin IVA
  erpOrderNumber?: string; // Número de pedido ERP de origen
  erpOrderLine?: number; // Número de línea del pedido ERP
  manualSupplier?: string; // Proveedor (manual)
  route?: string; // Ruta
  shippingMethod?: string; // Método de Envío
  status: PurchaseRequestStatus;
  pendingAction: AdministrativeAction;
  notes?: string;
  requestedBy: string;
  approvedBy?: string;
  receivedInWarehouseBy?: string;
  lastStatusUpdateBy?: string;
  lastStatusUpdateNotes?: string;
  reopened?: boolean;
  previousStatus?: PurchaseRequestStatus | null;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  hasBeenModified?: boolean;
  sourceOrders?: string[];
  involvedClients?: { id: string; name: string }[];
};

export type UpdatePurchaseRequestPayload = Partial<Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus' | 'lastModifiedAt' | 'lastModifiedBy' | 'hasBeenModified' | 'approvedBy' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes'>> & {
    requestId: number;
    updatedBy: string;
};

export type PurchaseRequestHistoryEntry = {
    id: number;
    requestId: number;
    timestamp: string;
    status: PurchaseRequestStatus;
    notes?: string;
    updatedBy: string;
};

export type RequestSettings = {
    requestPrefix?: string;
    nextRequestNumber?: number;
    showCustomerTaxId: boolean;
    routes: string[];
    shippingMethods: string[];
    useWarehouseReception: boolean;
    pdfTopLegend?: string;
    pdfExportColumns: string[];
    pdfPaperSize: 'letter' | 'legal';
    pdfOrientation: 'portrait' | 'landscape';
    erpHeaderQuery?: string;
    erpLinesQuery?: string;
};

export type UpdateRequestStatusPayload = {
    requestId: number;
    status: PurchaseRequestStatus;
    notes: string;
    updatedBy: string;
    reopen: boolean;
    manualSupplier?: string;
    erpOrderNumber?: string;
    deliveredQuantity?: number;
    arrivalDate?: string;
};

export type RejectCancellationPayload = {
    entityId: number;
    notes: string;
    updatedBy: string;
}

export type AdministrativeActionPayload = {
    entityId: number;
    action: AdministrativeAction;
    notes: string;
    updatedBy: string;
};


// --- Warehouse Management Types ---

export type LocationType = 'building' | 'zone' | 'rack' | 'shelf' | 'bin';

export type WarehouseLocationLevel = {
    type: string; // e.g. "level1", "level2"
    name: string; // e.g. "Edificio", "Pasillo"
}

export type WarehouseSettings = {
    locationLevels: WarehouseLocationLevel[];
    enablePhysicalInventoryTracking: boolean;
};

export type WarehouseLocation = {
    id: number;
    name: string;
    code: string; // A unique, human-readable code, e.g., R01-S03-B05
    type: string; // Corresponds to WarehouseLocationLevel['type']
    parentId?: number | null; // For hierarchical structure
};

/** For Advanced Mode: Tracks quantity in a specific location */
export type WarehouseInventoryItem = {
    id: number;
    itemId: string; // Foreign key to main products table (Product['id'])
    locationId: number; // Foreign key to locations table
    quantity: number;
    lastUpdated: string;
};

/** For Simple Mode: Maps an item to a location without quantity */
export type ItemLocation = {
    id: number;
    itemId: string;
    locationId: number;
    clientId?: string | null;
};

export type MovementLog = {
    id: number;
    itemId: string;
    quantity: number;
    fromLocationId?: number | null; // null for initial entry
    toLocationId?: number | null;   // null for removal
    timestamp: string;
    userId: number;
    notes?: string;
};

// --- Stock Management Types ---
export type StockInfo = {
    itemId: string;
    stockByWarehouse: { [key: string]: number };
    totalStock: number;
};

export type Warehouse = {
    id: string;
    name: string;
    isDefault: boolean;
    isVisible: boolean;
};

export type StockSettings = {
    warehouses: Warehouse[];
};

// --- Hacienda Query Types ---
export type HaciendaContributorInfo = {
    nombre: string;
    tipoIdentificacion: string;
    regimen: {
        codigo: string;
        descripcion: string;
    };
    situacion: {
        moroso: "SI" | "NO";
        omiso: "SI" | "NO";
        estado: string;
    };
    administracionTributaria: string;
    actividades: {
        estado: string;
        tipo: string;
        codigo: string;
        descripcion: string;
    }[];
};

export type HaciendaExemptionApiResponse = {
    numeroDocumento: string;
    identificacion: string;
    porcentajeExoneracion: number;
    fechaEmision: string;
    fechaVencimiento: string;
    ano: number;
    cabys: string[];
    tipoAutorizacion: string;
    tipoDocumento: {
        codigo: string;
        descripcion: string;
        };
    CodigoInstitucion: string;
    nombreInstitucion: string;
    poseeCabys: boolean;
};

export type EnrichedCabysItem = {
    code: string;
    description: string;
    taxRate: number;
};

export type EnrichedExemptionInfo = HaciendaExemptionApiResponse & {
    enrichedCabys: EnrichedCabysItem[];
};

// Legacy type for migration, can be removed later.
export type Location = {
    id: number;
    name: string;
    code: string;
    type: string;
    parentId?: number | null;
}

export type InventoryItem = {
    id: number;
    itemId: string;
    locationId: number;
    quantity: number;
    lastUpdated: string;
    erpStock?: StockInfo | null;
};


// --- SQL Import Types ---
export type SqlConfig = {
    user?: string;
    password?: string;
    host?: string;
    database?: string;
    port?: string;
}

export type ImportQuery = {
    type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys' | 'suppliers' | 'erp_order_headers' | 'erp_order_lines';
    query: string;
}

export type { DateRange };

export type NotePayload = {
    orderId: number;
    notes: string;
    updatedBy: string;
};

// --- Maintenance Types ---
export type UpdateBackupInfo = {
    moduleId: string;
    moduleName: string;
    fileName: string;
    date: string;
};

// --- Suggestion Box Types ---
export type Suggestion = {
  id: number;
  content: string;
  userId: number;
  userName: string;
  isRead: 0 | 1;
  timestamp: string;
};

// --- Notification Types ---
export type Notification = {
    id: number | string; // Can be number for DB notifications, string for synthetic ones like suggestions
    userId: number;
    message: string;
    href: string;
    isRead: 0 | 1;
    timestamp: string;
    isSuggestion?: boolean; // Flag to identify suggestion notifications
    suggestionId?: number; // Original suggestion ID
};


// --- Supplier Type ---
export type Supplier = {
    id: string;      // PROVEEDOR
    name: string;    // NOMBRE
    alias: string;   // ALIAS
    email: string;   // E_MAIL
    phone: string;   // TELEFONO1
};

// --- ERP Order Import Types ---
export type ErpOrderHeader = {
    PEDIDO: string;
    ESTADO: string;
    CLIENTE: string;
    FECHA_PEDIDO: string | Date;
    FECHA_PROMETIDA: string | Date;
    ORDEN_COMPRA?: string;
    CLIENTE_NOMBRE?: string;
    TOTAL_UNIDADES?: number;
    MONEDA_PEDIDO?: string;
    USUARIO?: string;
};

export type ErpOrderLine = {
    PEDIDO: string;
    PEDIDO_LINEA: number;
    ARTICULO: string;
    CANTIDAD_PEDIDA: number;
    PRECIO_UNITARIO: number;
};


// --- Analytics Types ---
export type ProductionReportData = {
    totals: {
        totalRequested: number;
        totalDelivered: number;
        totalDefective: number;
        totalNet: number;
    };
    details: (ProductionOrder & { completionDate: string | null })[];
}

    
