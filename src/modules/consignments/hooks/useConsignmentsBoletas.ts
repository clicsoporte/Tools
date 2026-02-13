/**
 * @fileoverview Hook for managing the logic for the Consignments Boletas page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getBoletas, updateBoletaStatus, getBoletaDetails, updateBoleta, getConsignmentAgreements } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { RestockBoleta, BoletaLine, BoletaHistory, ConsignmentSettings, ConsignmentAgreement } from '@/modules/core/types';
import { getConsignmentSettings } from '../lib/actions';
import { generateDocument } from '@/lib/pdf-generator';
import { format, parseISO } from 'date-fns';

export type BoletaSortKey = 'consecutive' | 'client_name' | 'created_at' | 'status';
export type BoletaSortDirection = 'asc' | 'desc';

const statusConfig: { [key: string]: { label: string; color: string } } = {
    pending: { label: "Pendiente", color: "bg-yellow-500" },
    approved: { label: "Aprobada", color: "bg-green-500" },
    sent: { label: "Enviada", color: "bg-blue-500" },
    invoiced: { label: "Facturada", color: "bg-indigo-600" },
    canceled: { label: "Cancelada", color: "bg-red-700" }
};

export const useConsignmentsBoletas = () => {
    const { hasPermission } = useAuthorization(['consignments:approve']);
    const { toast } = useToast();
    const { user, companyData } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        agreements: [] as ConsignmentAgreement[],
        boletas: [] as RestockBoleta[],
        isStatusModalOpen: false,
        boletaToUpdate: null as RestockBoleta | null,
        statusUpdatePayload: { status: '', notes: '', erpInvoiceNumber: '' },
        isDetailsModalOpen: false,
        isDetailsLoading: false,
        detailedBoleta: null as { boleta: RestockBoleta, lines: BoletaLine[], history: BoletaHistory[] } | null,
        sortKey: 'created_at' as BoletaSortKey,
        sortDirection: 'desc' as BoletaSortDirection,
        filters: {
            status: ['pending', 'approved', 'sent', 'invoiced'],
        },
        settings: null as ConsignmentSettings | null,
    });

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [boletasData, settingsData, agreementsData] = await Promise.all([
                getBoletas({ status: state.filters.status }),
                getConsignmentSettings(),
                getConsignmentAgreements(),
            ]);
            updateState({ boletas: boletasData, settings: settingsData, agreements: agreementsData });
        } catch (error) {
            logError('Failed to load boletas', { error });
            toast({ title: 'Error', description: 'No se pudieron cargar los datos de las boletas.', variant: 'destructive' });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast, updateState, state.filters.status]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);
    
    const openStatusModal = (boleta: RestockBoleta, status: string) => {
        updateState({
            boletaToUpdate: boleta,
            statusUpdatePayload: { status, notes: '', erpInvoiceNumber: '' },
            isStatusModalOpen: true,
        });
    };
    
    const handleStatusUpdatePayloadChange = (field: keyof typeof state.statusUpdatePayload, value: string) => {
        updateState({ statusUpdatePayload: { ...state.statusUpdatePayload, [field]: value } });
    };

    const submitStatusUpdate = async () => {
        if (!user || !state.boletaToUpdate) return;
        updateState({ isSubmitting: true });
        try {
            await updateBoletaStatus({
                boletaId: state.boletaToUpdate.id,
                updatedBy: user.name,
                ...state.statusUpdatePayload
            });
            toast({ title: 'Estado Actualizado' });
            updateState({ isStatusModalOpen: false });
            await loadInitialData();
        } catch (error: any) {
            logError('Failed to update boleta status', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const openBoletaDetails = async (boletaId: number) => {
        updateState({ isDetailsModalOpen: true, isDetailsLoading: true });
        try {
            const details = await getBoletaDetails(boletaId);
            updateState({ detailedBoleta: details });
        } catch (error) {
            logError('Failed to get boleta details', { error });
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            updateState({ isDetailsLoading: false });
        }
    };
    
    const handleDetailedLineChange = (lineId: number, newQuantity: number) => {
        if (!state.detailedBoleta) return;
        const updatedLines = state.detailedBoleta.lines.map(line => 
            line.id === lineId ? { ...line, replenish_quantity: newQuantity } : line
        );
        updateState({ detailedBoleta: { ...state.detailedBoleta, lines: updatedLines }});
    };
    
    const saveBoletaChanges = async () => {
        if (!state.detailedBoleta || !user) return;
        updateState({ isSubmitting: true });
        try {
            await updateBoleta(state.detailedBoleta.boleta, state.detailedBoleta.lines, user.name);
            toast({ title: 'Boleta Actualizada' });
            updateState({ isDetailsModalOpen: false });
            await loadInitialData();
        } catch (error: any) {
            logError('Failed to save boleta changes', { error: error.message });
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handlePrintBoleta = async (boleta: RestockBoleta) => {
        if (!companyData || !state.settings) return;
        updateState({ isSubmitting: true });
        
        try {
            const details = await getBoletaDetails(boleta.id);
            if (!details) {
                throw new Error("No se encontraron los detalles de la boleta.");
            }

            const tableHeaders = state.settings.pdfExportColumns || ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'];
            const columnLabels: { [key: string]: string } = {
                'product_id': 'Código',
                'product_description': 'Descripción',
                'counted_quantity': 'Inv. Físico',
                'max_stock': 'Máximo',
                'replenish_quantity': 'A Reponer',
            };
            
            const tableRows = details.lines.map(line => {
                return tableHeaders.map(headerId => {
                    switch (headerId) {
                        case 'product_id': return line.product_id;
                        case 'product_description': return line.product_description;
                        case 'counted_quantity': return line.counted_quantity;
                        case 'max_stock': return line.max_stock;
                        case 'replenish_quantity': return line.replenish_quantity;
                        default: return '';
                    }
                });
            });

            const doc = generateDocument({
                docTitle: 'BOLETA DE REPOSICIÓN DE CONSIGNACIÓN',
                docId: boleta.consecutive,
                meta: details.history.map((h: BoletaHistory) => ({
                    label: `${statusConfig[h.status]?.label || h.status} por:`,
                    value: `${h.updatedBy} - ${format(parseISO(h.timestamp), 'dd/MM/yy HH:mm')}`
                })).concat(boleta.erp_invoice_number ? [{ label: 'Factura ERP:', value: boleta.erp_invoice_number }] : []),
                companyData,
                logoDataUrl: companyData.logoUrl,
                blocks: [
                    { title: 'Cliente:', content: state.agreements.find(a => a.id === boleta.agreement_id)?.client_name || 'N/A' },
                    { title: 'Bodega ERP:', content: state.agreements.find(a => a.id === boleta.agreement_id)?.erp_warehouse_id || 'N/A' },
                ],
                table: {
                    columns: tableHeaders.map(id => columnLabels[id] || id),
                    rows: tableRows,
                    columnStyles: {
                        2: { halign: 'right' },
                        3: { halign: 'right' },
                        4: { halign: 'right' }
                    }
                },
                totals: [],
                topLegend: state.settings.pdfTopLegend,
                signatureBlock: [
                    { label: 'Preparado y Entregado', value: 'Nombre y Firma' },
                    { label: 'Recibido Conforme', value: 'Nombre y Firma' }
                ]
            });
            doc.save(`boleta_${boleta.consecutive}.pdf`);
        } catch (error: any) {
            logError("Failed to print boleta", { error: error.message });
            toast({ title: 'Error al Imprimir', variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const getAgreementName = useCallback((id: number) => {
        return state.agreements.find(a => a.id === id)?.client_name || 'Desconocido';
    }, [state.agreements]);
    
    const selectors = {
        hasPermission,
        statusConfig,
        sortedBoletas: useMemo(() => {
            return [...state.boletas].sort((a, b) => {
                const dir = state.sortDirection === 'asc' ? 1 : -1;
                switch (state.sortKey) {
                    case 'created_at': return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
                    case 'client_name': return getAgreementName(a.agreement_id).localeCompare(getAgreementName(b.agreement_id)) * dir;
                    default: return String(a[state.sortKey]).localeCompare(String(b[state.sortKey])) * dir;
                }
            });
        }, [state.boletas, state.sortKey, state.sortDirection, getAgreementName]),
        getAgreementName,
    };

    return {
        state,
        actions: {
            loadBoletas,
            openStatusModal,
            handleStatusUpdatePayloadChange,
            submitStatusUpdate,
            openBoletaDetails,
            handleDetailedLineChange,
            saveBoletaChanges,
            handlePrintBoleta,
            setStatusModalOpen: (open: boolean) => updateState({ isStatusModalOpen: open }),
            setDetailsModalOpen: (open: boolean) => updateState({ isDetailsModalOpen: open }),
            handleBoletaSort: (key: BoletaSortKey) => {
                updateState({ sortKey: key, sortDirection: state.sortKey === key && state.sortDirection === 'asc' ? 'desc' : 'asc' });
            },
            setBoletaStatusFilter: (statuses: string[]) => {
                updateState({ filters: { status: statuses } });
            },
        },
        selectors
    };
};
