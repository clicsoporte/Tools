/**
 * @fileoverview Hook to manage the state and logic for the ItemLocation assignment page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getLocations, getAllItemLocations, assignItemToLocation, unassignItemFromLocation, getSelectableLocations } from '@/modules/warehouse/lib/actions';
import type { Product, Customer, WarehouseLocation, ItemLocation } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

const renderLocationPathAsString = (locationId: number, locations: WarehouseLocation[]): string => {
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

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const emptyFormData = {
    selectedProductId: null as string | null,
    selectedClientId: null as string | null,
    selectedLocationId: null as string | null,
    isExclusive: false,
};

export function useItemLocation() {
    const { hasPermission, isAuthorized } = useAuthorization(['warehouse:item-assignment:create', 'warehouse:item-assignment:delete']);
    const { toast } = useToast();
    const { user, companyData, products: authProducts, customers: authCustomers } = useAuth();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for the main view
    const [allLocations, setAllLocations] = useState<WarehouseLocation[]>([]);
    const [allAssignments, setAllAssignments] = useState<ItemLocation[]>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    
    // State for dialogs and forms
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
    const [formData, setFormData] = useState(emptyFormData);

    // State for search inputs within dialogs
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [locationSearchTerm, setLocationSearchTerm] = useState('');
    const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
    
    const [debouncedProductSearch] = useDebounce(productSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedClientSearch] = useDebounce(clientSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedLocationSearch] = useDebounce(locationSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedGlobalFilter] = useDebounce(globalFilter, companyData?.searchDebounceTime ?? 500);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [locs, allAssigns] = await Promise.all([getLocations(), getAllItemLocations()]);
            setAllLocations(locs);
            setAllAssignments(allAssigns.sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        } catch (error) {
            logError("Failed to load data for assignment page", { error });
            toast({ title: "Error de Carga", description: "No se pudieron cargar los datos necesarios.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        if (isAuthorized) {
            loadInitialData();
        }
    }, [isAuthorized, loadInitialData]);
    
    const selectableLocations = useMemo(() => getSelectableLocations(allLocations), [allLocations]);
    
    const productOptions = useMemo(() => {
        if (!debouncedProductSearch) return [];
        const searchLower = debouncedProductSearch.toLowerCase();
        if (searchLower.length < 2) return [];
        return authProducts.filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
            .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
    }, [authProducts, debouncedProductSearch]);

    const clientOptions = useMemo(() =>
        debouncedClientSearch.length < 2 ? [] : authCustomers
            .filter(c => c.id.toLowerCase().includes(debouncedClientSearch.toLowerCase()) || c.name.toLowerCase().includes(debouncedClientSearch.toLowerCase()))
            .map(c => ({ value: c.id, label: `[${c.id}] ${c.name}` })),
        [authCustomers, debouncedClientSearch]
    );

    const locationOptions = useMemo(() => {
        const searchTerm = debouncedLocationSearch.trim().toLowerCase();
        if (searchTerm === '*' || searchTerm === '') return selectableLocations.map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, allLocations) }));
        return selectableLocations.filter(l => renderLocationPathAsString(l.id, allLocations).toLowerCase().includes(searchTerm))
            .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, allLocations) }));
    }, [allLocations, selectableLocations, debouncedLocationSearch]);


    const handleSelectProduct = (value: string) => {
        setIsProductSearchOpen(false);
        const product = authProducts.find(p => p.id === value);
        if (product) {
            setFormData(prev => ({ ...prev, selectedProductId: value }));
            setProductSearchTerm(`[${product.id}] ${product.description}`);
        }
    };
    
    const handleSelectClient = (value: string | null) => {
        setIsClientSearchOpen(false);
        const client = value ? authCustomers.find(c => c.id === value) : null;
        setFormData(prev => ({ ...prev, selectedClientId: client ? client.id : null }));
        setClientSearchTerm(client ? `[${client.id}] ${client.name}` : '');
    };

    const handleSelectLocation = (value: string) => {
        setIsLocationSearchOpen(false);
        const location = allLocations.find(l => String(l.id) === value);
        if (location) {
            setFormData(prev => ({ ...prev, selectedLocationId: value }));
            setLocationSearchTerm(renderLocationPathAsString(location.id, allLocations));
        }
    };
    
    const resetForm = useCallback(() => {
        setFormData(emptyFormData);
        setProductSearchTerm('');
        setClientSearchTerm('');
        setLocationSearchTerm('');
        setEditingAssignmentId(null);
        setIsEditing(false);
    }, []);

    const openCreateForm = () => {
        resetForm();
        setIsFormOpen(true);
    };

    const openEditForm = (assignment: ItemLocation) => {
        const product = authProducts.find(p => p.id === assignment.itemId);
        const client = assignment.clientId ? authCustomers.find(c => c.id === assignment.clientId) : null;
        const location = allLocations.find(l => l.id === assignment.locationId);

        setFormData({
            selectedProductId: assignment.itemId,
            selectedClientId: assignment.clientId || null,
            selectedLocationId: String(assignment.locationId),
            isExclusive: assignment.isExclusive === 1,
        });

        setProductSearchTerm(product ? `[${product.id}] ${product.description}` : '');
        setClientSearchTerm(client ? `[${client.id}] ${client.name}` : '');
        setLocationSearchTerm(location ? renderLocationPathAsString(location.id, allLocations) : '');
        
        setEditingAssignmentId(assignment.id);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (!formData.selectedProductId || !formData.selectedLocationId) {
            toast({ title: "Datos Incompletos", description: "Debe seleccionar un producto y una ubicación.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                id: isEditing ? editingAssignmentId! : undefined,
                itemId: formData.selectedProductId,
                locationId: parseInt(formData.selectedLocationId, 10),
                clientId: formData.selectedClientId,
                isExclusive: (formData.isExclusive ? 1 : 0) as 0 | 1,
                updatedBy: user.name,
            };

            const savedAssignment = await assignItemToLocation(payload);
            
            if (isEditing) {
                setAllAssignments(prev => prev.map(a => a.id === savedAssignment.id ? savedAssignment : a));
                toast({ title: "Asignación Actualizada" });
            } else {
                setAllAssignments(prev => [savedAssignment, ...prev]);
                toast({ title: "Asignación Creada" });
            }
            
            setIsFormOpen(false);
            resetForm();
        } catch(e: any) {
            logError('Failed to save item assignment', { error: e.message });
            toast({ title: "Error al Guardar", description: `No se pudo guardar la asignación. ${e.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAssignment = async (assignmentId: number) => {
        setIsSubmitting(true);
        try {
            await unassignItemFromLocation(assignmentId);
            setAllAssignments(prev => prev.filter(a => a.id !== assignmentId));
            toast({ title: "Asignación Eliminada", variant: "destructive" });
        } catch (e: any) {
            logError('Failed to delete item assignment', { error: e.message });
            toast({ title: "Error al Eliminar", description: `No se pudo eliminar la asignación. ${e.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const filteredAssignments = useMemo(() => {
        if (!debouncedGlobalFilter) {
            return allAssignments;
        }
        const lowerCaseFilter = debouncedGlobalFilter.toLowerCase();
        return allAssignments.filter(a => {
            const product = authProducts.find(p => p.id === a.itemId);
            const client = authCustomers.find(c => c.id === a.clientId);
            const locationString = renderLocationPathAsString(a.locationId, allLocations);
            return (
                product?.id.toLowerCase().includes(lowerCaseFilter) ||
                product?.description.toLowerCase().includes(lowerCaseFilter) ||
                client?.name.toLowerCase().includes(lowerCaseFilter) ||
                locationString.toLowerCase().includes(lowerCaseFilter)
            );
        });
    }, [allAssignments, debouncedGlobalFilter, authProducts, authCustomers, allLocations]);

    useEffect(() => { setCurrentPage(0); }, [debouncedGlobalFilter, rowsPerPage]);
    
    const paginatedAssignments = useMemo(() => {
        const start = currentPage * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredAssignments.slice(start, end);
    }, [filteredAssignments, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredAssignments.length / rowsPerPage);

    return {
        state: {
            isLoading, isSubmitting, isFormOpen, isEditing,
            globalFilter, currentPage, rowsPerPage,
            formData, productSearchTerm, isProductSearchOpen,
            clientSearchTerm, isClientSearchOpen, locationSearchTerm, isLocationSearchOpen
        },
        selectors: {
            paginatedAssignments, totalPages, filteredAssignments,
            productOptions, clientOptions, locationOptions, hasPermission,
            getProductName: (id: string) => authProducts.find(p => p.id === id)?.description || 'Desconocido',
            getClientName: (id: string | null | undefined) => id ? authCustomers.find(c => c.id === id)?.name : 'General',
            getLocationPath: (id: number) => renderLocationPathAsString(id, allLocations)
        },
        actions: {
            setGlobalFilter, setCurrentPage, setRowsPerPage,
            setIsFormOpen, openCreateForm, openEditForm, handleSubmit, handleDeleteAssignment, resetForm,
            setFormData,
            setProductSearchTerm, setIsProductSearchOpen, handleSelectProduct,
            setClientSearchTerm, setIsClientSearchOpen, handleSelectClient,
            setLocationSearchTerm, setIsLocationSearchOpen, handleSelectLocation,
        }
    };
}
