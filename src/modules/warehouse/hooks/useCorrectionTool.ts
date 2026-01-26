/**
 * @fileoverview Hook to manage the state and logic for the Inventory Correction tool.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { correctInventoryUnit, searchInventoryUnits, applyInventoryUnit, getWarehouseSettings, getLocations } from '@/modules/warehouse/lib/actions';
import type { InventoryUnit, Product, DateRange, WarehouseSettings, WarehouseLocation } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { subDays, format, parseISO } from 'date-fns';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';

export type SortKey = 'status' | 'receptionConsecutive' | 'productId' | 'humanReadableId' | 'quantity' | 'createdBy' | 'createdAt' | 'annulledBy' | 'annulledAt' | 'appliedBy' | 'appliedAt';
export type SortDirection = 'asc' | 'desc';

interface State {
    isSearching: boolean;
    isSubmitting: boolean;
    filters: {
        dateRange?: DateRange;
        productId: string;
        humanReadableId: string;
        unitCode: string;
        documentId: string;
        receptionConsecutive: string;
        showVoided: boolean;
        statusFilter: 'pending' | 'all';
    };
    searchResults: InventoryUnit[];
    unitToCorrect: InventoryUnit | null;
    isConfirmModalOpen: boolean;
    newProductSearch: string;
    isNewProductSearchOpen: boolean;
    newSelectedProduct: Product | null;
    editableUnit: Partial<InventoryUnit>;
    visibleColumns: string[];
    sortKey: SortKey;
    sortDirection: SortDirection;
    currentPage: number;
    rowsPerPage: number;
}

const emptyEditableUnit: Partial<InventoryUnit> = {
    productId: '',
    quantity: undefined,
    humanReadableId: '',
    documentId: '',
    erpDocumentId: '',
};

const renderLocationPathAsString = (locationId: number | null, locations: WarehouseLocation[]): string => {
    if (!locationId) return '';
    const path: WarehouseLocation[] = [];
    let current: WarehouseLocation | undefined = locations.find(l => l.id === locationId);
    while (current) {
        path.unshift(current);
        const parentId = current.parentId;
        if (!parentId) break;
        current = locations.find(l => l.id === parentId);
    }
    return path.map(l => l.name).join(' > ');
};

const availableColumns = [
    { id: 'status', label: 'Estado' },
    { id: 'receptionConsecutive', label: 'Consecutivo Ingreso' },
    { id: 'traceability', label: 'Trazabilidad' },
    { id: 'productDescription', label: 'Producto' },
    { id: 'humanReadableId', label: 'Nº Lote / ID' },
    { id: 'quantity', label: 'Cant.' },
    { id: 'createdBy', label: 'Recibido Por' },
    { id: 'createdAt', label: 'Fecha Ingreso' },
    { id: 'appliedBy', label: 'Aplicado Por' },
    { id: 'appliedAt', label: 'Fecha Aplicación' },
    { id: 'annulledBy', label: 'Anulado Por' },
    { id: 'annulledAt', label: 'Fecha Anulación' },
];


export const useCorrectionTool = () => {
    const { hasPermission } = useAuthorization(['warehouse:correction:execute', 'warehouse:correction:apply']);
    const { toast } = useToast();
    const { user, products: authProducts, companyData: authCompanyData } = useAuth();
    
    const [warehouseSettings, setWarehouseSettings] = useState<WarehouseSettings | null>(null);
    const [allLocations, setAllLocations] = useState<WarehouseLocation[]>([]);

    const [state, setState] = useState<State>({
        isSearching: false,
        isSubmitting: false,
        filters: {
            dateRange: { from: subDays(new Date(), 7), to: new Date() },
            productId: '',
            humanReadableId: '',
            unitCode: '',
            documentId: '',
            receptionConsecutive: '',
            showVoided: false,
            statusFilter: 'pending',
        },
        searchResults: [],
        unitToCorrect: null,
        isConfirmModalOpen: false,
        newProductSearch: '',
        isNewProductSearchOpen: false,
        newSelectedProduct: null,
        editableUnit: {},
        visibleColumns: ['status', 'traceability', 'productDescription', 'quantity', 'createdBy', 'createdAt', 'annulledBy', 'appliedBy'],
        sortKey: 'createdAt',
        sortDirection: 'desc',
        currentPage: 0,
        rowsPerPage: 25,
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadPrefsAndData = async () => {
            if (user && hasPermission('warehouse:correction:execute')) {
                const prefs = await getUserPreferences(user.id, 'correctionToolPrefs');
                const [settings, locations] = await Promise.all([getWarehouseSettings(), getLocations()]);
                
                setState(prevState => ({
                    ...prevState,
                    visibleColumns: prefs?.visibleColumns || prevState.visibleColumns,
                    filters: {
                        ...prevState.filters,
                        statusFilter: prefs?.statusFilter === 'all' ? 'all' : 'pending',
                    }
                }));

                setWarehouseSettings(settings);
                setAllLocations(locations);
            }
        };
        loadPrefsAndData();
    }, [hasPermission, user]);
    
    const [debouncedNewProductSearch] = useDebounce(state.newProductSearch, 300);

    const handleSearch = useCallback(async () => {
        updateState({ isSearching: true, searchResults: [] });
        try {
            const results = await searchInventoryUnits(state.filters);
            updateState({ searchResults: results, currentPage: 0 });
            if (results.length === 0) {
                toast({ title: 'Sin Resultados', description: 'No se encontraron ingresos con los filtros especificados.' });
            }
        } catch (error: any) {
            logError("Error searching for inventory units", { error: error.message });
            toast({ title: "Error de Búsqueda", variant: "destructive" });
        } finally {
            updateState({ isSearching: false });
        }
    }, [state.filters, toast, updateState]);
    
    const handleClearFilters = () => {
        updateState({
            filters: {
                dateRange: { from: subDays(new Date(), 7), to: new Date() },
                productId: '',
                humanReadableId: '',
                unitCode: '',
                documentId: '',
                receptionConsecutive: '',
                showVoided: false,
                statusFilter: 'pending',
            },
            searchResults: [],
            currentPage: 0,
        });
    };

    const handleSelectNewProduct = (productId: string) => {
        const product = authProducts.find(p => p.id === productId);
        if (product) {
            updateState({
                newSelectedProduct: product,
                newProductSearch: `[${product.id}] ${product.description}`,
                isNewProductSearchOpen: false,
                editableUnit: { ...state.editableUnit, productId: product.id }
            });
        }
    };

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            updateState({
                unitToCorrect: null,
                isConfirmModalOpen: false,
                newProductSearch: '',
                newSelectedProduct: null,
                editableUnit: {},
            });
        } else {
             updateState({ isConfirmModalOpen: true });
        }
    };
    
    const handleConfirmCorrection = async () => {
        if (!user || !state.unitToCorrect) {
             toast({ title: "Error", description: "Faltan datos para la corrección.", variant: "destructive" });
             return;
        }
        
        updateState({ isSubmitting: true });
        try {
            if (state.unitToCorrect.status === 'pending') {
                await applyInventoryUnit({
                    unitId: state.unitToCorrect.id,
                    newProductId: state.editableUnit.productId ?? state.unitToCorrect.productId,
                    newQuantity: state.editableUnit.quantity ?? state.unitToCorrect.quantity,
                    newHumanReadableId: state.editableUnit.humanReadableId ?? state.unitToCorrect.humanReadableId ?? '',
                    newDocumentId: state.editableUnit.documentId ?? state.unitToCorrect.documentId ?? '',
                    newErpDocumentId: state.editableUnit.erpDocumentId ?? state.unitToCorrect.erpDocumentId ?? '',
                    updatedBy: user.name,
                });
                toast({ title: "Ingreso Aplicado", description: `El ingreso ${state.unitToCorrect.receptionConsecutive} ha sido finalizado.` });
            } else {
                 await correctInventoryUnit({
                    unitId: state.unitToCorrect.id,
                    newProductId: state.editableUnit.productId ?? state.unitToCorrect.productId,
                    newQuantity: state.editableUnit.quantity ?? state.unitToCorrect.quantity,
                    newHumanReadableId: state.editableUnit.humanReadableId ?? state.unitToCorrect.humanReadableId ?? '',
                    newDocumentId: state.editableUnit.documentId ?? state.unitToCorrect.documentId ?? '',
                    newErpDocumentId: state.editableUnit.erpDocumentId ?? state.unitToCorrect.erpDocumentId ?? '',
                    userId: user.id,
                    userName: user.name,
                });
                toast({ title: "Corrección Exitosa", description: `La unidad ${state.unitToCorrect.unitCode} ha sido actualizada.` });
            }
            
            handleModalOpenChange(false);
            await handleSearch(); // Refresh search results
        } catch (error: any) {
            logError('Error executing inventory action', { error: error.message, unitId: state.unitToCorrect.id });
            toast({ title: "Error en la Operación", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handlePrintTicket = async (unit: InventoryUnit) => {
        if (!user || !authCompanyData || !warehouseSettings) {
            toast({ title: 'Error', description: 'No se pudieron cargar los datos del usuario o la empresa.', variant: 'destructive'});
            return;
        }
    
        updateState({ isSubmitting: true });
    
        try {
            let docTitle = 'COMPROBANTE DE INGRESO';
            let mainConsecutive = unit.receptionConsecutive || `U-${unit.unitCode}`;
            let trazabilidadContent = '';
    
            if (unit.status === 'voided' && unit.correctionConsecutive) {
                docTitle = 'COMPROBANTE DE ANULACIÓN';
                mainConsecutive = unit.correctionConsecutive;
                trazabilidadContent = `Este documento ANULA el ingreso: ${unit.receptionConsecutive}`;
            } else if (unit.correctedFromUnitId) {
                docTitle = 'COMPROBANTE DE INGRESO (POR CORRECCIÓN)';
                const originalUnit = state.searchResults.find(u => u.id === unit.correctedFromUnitId);
                if(originalUnit) {
                     trazabilidadContent = `Este documento CORRIGE Y REEMPLAZA el ingreso: ${originalUnit.receptionConsecutive}`;
                }
            }
            
            const product = authProducts.find(p => p.id === unit.productId);
            const locationPath = renderLocationPathAsString(unit.locationId, allLocations);
    
            const detailsContent = [
                `Producto:          [${unit.productId}] ${product?.description || 'N/A'}`,
                `Cantidad Recibida:  ${unit.quantity} Unidades`,
                `Lote / ID Físico:   ${unit.humanReadableId || 'N/A'}`,
                `Documento Origen:   ${unit.documentId || 'N/A'}`,
                `Documento ERP:      ${unit.erpDocumentId || 'N/A'}`,
                `Ubicación Destino:  ${locationPath}`,
                `Notas:             ${unit.notes || 'Sin notas.'}`
            ].join('\n');
    
            const doc = generateDocument({
                docTitle,
                docId: mainConsecutive,
                meta: [
                    { label: 'Fecha de Ingreso', value: format(parseISO(unit.createdAt), 'dd/MM/yyyy HH:mm') },
                    ...(unit.appliedAt ? [{ label: 'Fecha de Aplicación', value: format(parseISO(unit.appliedAt), 'dd/MM/yyyy HH:mm') }] : [])
                ],
                companyData: authCompanyData,
                logoDataUrl: authCompanyData.logoUrl,
                blocks: [
                    ...(trazabilidadContent ? [{ title: 'TRAZABILIDAD:', content: trazabilidadContent }] : []),
                    { title: 'DETALLES DEL MOVIMIENTO:', content: detailsContent },
                ],
                table: { columns: [], rows: [] },
                totals: [],
                topLegend: warehouseSettings.pdfTopLegend,
                signatureBlock: [
                    { label: 'Recibido Por:', value: unit.createdBy },
                    { label: 'Revisado Por:', value: unit.appliedBy || '' }
                ],
            });
    
            doc.save(`comprobante_${mainConsecutive}.pdf`);
            
        } catch(err: any) {
            logError("Failed to generate receipt PDF", { error: err.message, unitId: unit.id });
            toast({ title: 'Error al generar PDF', description: 'No se pudo crear el documento.', variant: 'destructive'});
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const setEditableUnitField = (field: keyof InventoryUnit, value: any) => {
        updateState({ editableUnit: { ...state.editableUnit, [field]: value } });
    };

    const resetEditableUnit = () => {
        const { unitToCorrect } = state;
        if (unitToCorrect) {
            const originalProduct = authProducts.find(p => p.id === unitToCorrect.productId);
            updateState({
                editableUnit: { ...unitToCorrect },
                newSelectedProduct: originalProduct || null,
                newProductSearch: originalProduct ? `[${originalProduct.id}] ${originalProduct.description}` : '',
            });
        }
    };
    
    const handleClearForm = () => {
        updateState({
            editableUnit: { ...emptyEditableUnit, locationId: state.unitToCorrect?.locationId },
            newSelectedProduct: null,
            newProductSearch: '',
        });
    }
    
    const setUnitToCorrect = (unit: InventoryUnit | null) => {
        if (unit) {
            const product = authProducts.find(p => p.id === unit.productId);
            updateState({ 
                unitToCorrect: unit,
                editableUnit: { ...unit },
                newSelectedProduct: product || null,
                newProductSearch: product ? `[${product.id}] ${product.description}`: '',
                isConfirmModalOpen: true 
            });
        }
    };

     const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (state.sortKey === key && state.sortDirection === 'asc') {
            direction = 'desc';
        }
        updateState({ sortKey: key, sortDirection: direction });
    };

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        updateState({
            visibleColumns: checked
                ? [...state.visibleColumns, columnId]
                : state.visibleColumns.filter(id => id !== columnId)
        });
    };

    const savePreferences = async () => {
        if (!user) return;
        await saveUserPreferences(user.id, 'correctionToolPrefs', { visibleColumns: state.visibleColumns, statusFilter: state.filters.statusFilter });
        toast({ title: 'Preferencias Guardadas' });
    };

    const sortedResults = useMemo(() => {
        const data = [...state.searchResults];
        data.sort((a, b) => {
            const key = state.sortKey;
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            const valA = a[key as keyof InventoryUnit] ?? '';
            const valB = b[key as keyof InventoryUnit] ?? '';
            
            if (key === 'createdAt' || key === 'annulledAt' || key === 'appliedAt') {
                const dateA = valA ? parseISO(valA as string).getTime() : 0;
                const dateB = valB ? parseISO(valB as string).getTime() : 0;
                if (!valA) return 1 * dir;
                if (!valB) return -1 * dir;
                return (dateA - dateB) * dir;
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * dir;
            }
            return String(valA).localeCompare(String(valB)) * dir;
        });
        return data;
    }, [state.searchResults, state.sortKey, state.sortDirection]);
    
    const paginatedResults = useMemo(() => {
        const start = state.currentPage * state.rowsPerPage;
        const end = start + state.rowsPerPage;
        return sortedResults.slice(start, end);
    }, [sortedResults, state.currentPage, state.rowsPerPage]);
    
    const selectors = {
        hasPermission,
        productOptions: useMemo(() => {
            if (debouncedNewProductSearch.length < 2) return [];
            const searchLower = debouncedNewProductSearch.toLowerCase();
            return authProducts
                .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower) || (p.barcode || '').toLowerCase().includes(searchLower))
                .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
        }, [authProducts, debouncedNewProductSearch]),
        getOriginalProductName: () => {
            if (!state.unitToCorrect) return '';
            return authProducts.find(p => p.id === state.unitToCorrect?.productId)?.description || state.unitToCorrect?.productId;
        },
        getProductName: (productId: string) => authProducts.find(p => p.id === productId)?.description || 'Desconocido',
        getLocationPath: (locationId: number | null) => renderLocationPathAsString(locationId, allLocations),
        isCorrectionFormValid: useMemo(() => {
            if (!state.unitToCorrect) return false;
            const hasChanged = state.editableUnit.productId !== state.unitToCorrect.productId ||
                               state.editableUnit.quantity !== state.unitToCorrect.quantity ||
                               state.editableUnit.humanReadableId !== (state.unitToCorrect.humanReadableId || '') ||
                               state.editableUnit.documentId !== (state.unitToCorrect.documentId || '') ||
                               state.editableUnit.erpDocumentId !== (state.unitToCorrect.erpDocumentId || '');
            return hasChanged;
        }, [state.editableUnit, state.unitToCorrect]),
        sortedResults,
        paginatedResults,
        totalPages: Math.ceil(sortedResults.length / state.rowsPerPage),
        availableColumns,
        visibleColumnsData: useMemo(() => {
            return state.visibleColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean) as { id: string; label: string; }[];
        }, [state.visibleColumns]),
        getColumnContent: (item: InventoryUnit, colId: string): { content: any; className?: string; type?: string; variant?: "default" | "secondary" | "destructive" | "outline" | undefined; } => {
            switch (colId) {
                case 'status': return { type: 'badge', content: item.status, variant: item.status === 'pending' ? 'secondary' : (item.status === 'voided' ? 'destructive' : 'default'), className: item.status === 'applied' ? 'bg-green-600' : '' };
                case 'receptionConsecutive': return { type: 'string', content: item.receptionConsecutive || 'N/A', className: "font-mono text-xs" };
                case 'traceability':
                    if (item.correctionConsecutive) {
                        const correctedUnit = state.searchResults.find(u => u.correctedFromUnitId === item.id);
                        const replacementText = correctedUnit ? `Reemplazado por ${correctedUnit.receptionConsecutive}` : 'Anulado sin reemplazo';
                        return {
                            type: 'badge',
                            content: `${item.correctionConsecutive} (Anula ${item.receptionConsecutive})`,
                            variant: 'destructive'
                        };
                    }
                    if (item.correctedFromUnitId) {
                        const original = state.searchResults.find(u => u.id === item.correctedFromUnitId);
                        return {
                            type: 'badge',
                            content: `Corrige a ${original?.receptionConsecutive || 'N/A'}`,
                            variant: 'outline'
                        };
                    }
                    return { type: 'string', content: '-', className: "text-muted-foreground" };
                case 'productDescription': return { type: 'multiline', content: [ { text: selectors.getProductName(item.productId) }, { text: item.productId, className: "text-xs text-muted-foreground" } ]};
                case 'humanReadableId': return { type: 'string', content: item.humanReadableId || 'N/A' };
                case 'quantity': return { type: 'string', content: item.quantity, className: 'font-bold' };
                case 'createdBy': return { content: item.createdBy, type: 'string' };
                case 'createdAt': return { type: 'string', content: item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yy HH:mm') : '' };
                case 'annulledBy': return { type: 'string', content: item.annulledBy || '' };
                case 'annulledAt': return { type: 'string', content: item.annulledAt ? format(parseISO(item.annulledAt), 'dd/MM/yy HH:mm') : '' };
                case 'appliedBy': return { type: 'string', content: item.appliedBy || '' };
                case 'appliedAt': return { type: 'string', content: item.appliedAt ? format(parseISO(item.appliedAt), 'dd/MM/yy HH:mm') : '' };
                default: return { content: null, type: 'string' };
            }
        },
    };
    
    const actions = {
        setFilter: (field: keyof State['filters'], value: any) => {
            updateState({
                filters: { ...state.filters, [field]: value },
            });
        },
        handleStatusFilterChange: (checked: boolean) => {
            updateState({
                filters: { ...state.filters, statusFilter: checked ? 'pending' : 'all' },
                currentPage: 0,
            });
        },
        handleSearch,
        handleClearFilters,
        handleSelectNewProduct,
        handleModalOpenChange,
        handleConfirmCorrection,
        setUnitToCorrect,
        setNewProductSearch: (term: string) => updateState({ newProductSearch: term }),
        setNewProductSearchOpen: (isOpen: boolean) => updateState({ isNewProductSearchOpen: isOpen }),
        setEditableUnitField,
        resetEditableUnit,
        handleClearForm,
        handleSort,
        handleColumnVisibilityChange,
        savePreferences,
        handlePrintTicket,
        setCurrentPage: (page: number | ((p: number) => number)) => updateState({ currentPage: typeof page === 'function' ? page(state.currentPage) : page }),
        setRowsPerPage: (size: number) => updateState({ rowsPerPage: size, currentPage: 0 }),
    };

    return {
        state,
        actions,
        selectors,
    };
};
