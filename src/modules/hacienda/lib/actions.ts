/**
 * @fileoverview Server Actions for the Hacienda module.
 * These server-only functions are responsible for securely interacting
 * with external Hacienda APIs to fetch contributor and exemption information.
 */
'use server';

import { logError } from '@/modules/core/lib/logger';
import { getApiSettings } from '@/modules/core/lib/db';
import type { HaciendaContributorInfo, HaciendaExemptionApiResponse, EnrichedExemptionInfo } from '../../core/types';
import { getCabysDescription } from './cabys';

/**
 * Fetches contributor (taxpayer) information from the Hacienda API.
 * @param {string} taxpayerId - The taxpayer's identification number.
 * @returns {Promise<HaciendaContributorInfo | { error: boolean; message: string }>} The contributor data or an error object.
 */
export async function getContributorInfo(taxpayerId: string): Promise<HaciendaContributorInfo | { error: boolean; message: string }> {
    if (!taxpayerId) {
        return { error: true, message: "El número de identificación es requerido." };
    }
    try {
        const apiSettings = await getApiSettings();
        if (!apiSettings?.haciendaTributariaApi) { 
            throw new Error("La URL de la API de situación tributaria no está configurada.");
        }
        
        const apiUrl = `${apiSettings.haciendaTributariaApi}${taxpayerId}`;
        
        const response = await fetch(apiUrl, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Error de la API de Hacienda: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data as HaciendaContributorInfo;
    } catch (error: any) {
        logError("Error al obtener información del contribuyente", { error: error.message, taxpayerId });
        return { error: true, message: error.message };
    }
}

/**
 * Fetches the status of a specific tax exemption from the Hacienda API.
 * @param {string} authNumber - The exemption authorization number.
 * @returns {Promise<HaciendaExemptionApiResponse | { error: boolean; message: string }>} The exemption data or an error object.
 */
export async function getExemptionStatus(authNumber: string): Promise<HaciendaExemptionApiResponse | { error: boolean; message: string }> {
    if (!authNumber) {
        return { error: true, message: "El número de autorización es requerido." };
    }
    try {
        const apiSettings = await getApiSettings();
        if (!apiSettings?.haciendaExemptionApi) {
            throw new Error("La URL de la API de exoneraciones no está configurada.");
        }

        const fullApiUrl = `${apiSettings.haciendaExemptionApi}${authNumber}`;
        const response = await fetch(fullApiUrl, { cache: 'no-store' });

        if (!response.ok) {
            if (response.status === 404) {
                 return { error: true, message: "Exoneración no encontrada." };
            }
            throw new Error(`Error de la API de Hacienda: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data as HaciendaExemptionApiResponse;
    } catch (error: any) {
        logError("Error al obtener estado de exoneración", { error: error.message, authNumber });
        return { error: true, message: error.message };
    }
}

/**
 * Fetches exemption status and enriches it with CABYS descriptions.
 * This provides a more user-friendly output by converting CABYS codes into human-readable text.
 * @param {string} authNumber - The exemption authorization number.
 * @returns {Promise<EnrichedExemptionInfo | { error: boolean; message: string }>} The enriched exemption data or an error object.
 */
export async function getEnrichedExemptionStatus(authNumber: string): Promise<EnrichedExemptionInfo | { error: boolean; message: string }> {
    const exemptionResult = await getExemptionStatus(authNumber);

    if ('error' in exemptionResult) {
        return exemptionResult;
    }

    const enrichedCabys = await Promise.all(
        exemptionResult.cabys.map(async (code) => {
            const description = await getCabysDescription(code);
            return { code, description: description || 'Descripción no encontrada' };
        })
    );

    return {
        ...exemptionResult,
        enrichedCabys,
    };
}
