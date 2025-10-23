/**
 * @fileoverview Server Actions for fetching data from external APIs.
 * This file contains functions that are executed only on the server, providing a secure
 * way to interact with third-party services without exposing API keys or dealing with CORS.
 */
"use server";

import { getApiSettings as getApiSettingsDb, getEmailSettings as getEmailSettingsDb } from './db';
import { logError, logWarn } from './logger';
import type { ApiSettings, EmailSettings } from '../types';

/**
 * Fetches the current USD to CRC exchange rate from the configured API endpoint.
 * @returns {Promise<any>} The JSON response from the external API or an error object.
 */
export async function getExchangeRate(): Promise<any> {
    try {
        const apiSettings = await getApiSettingsDb();
        if (!apiSettings?.exchangeRateApi) {
            throw new Error("Exchange rate API URL not configured in settings.");
        }

        // Use no-store to always get the freshest data from the API endpoint itself
        const response = await fetch(apiSettings.exchangeRateApi, {
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorPayload = { status: response.status, statusText: response.statusText, url: apiSettings.exchangeRateApi };
            await logError("Error fetching exchange rate from external API", errorPayload);
            return { error: true, message: `Error de API externa (${response.status})`, status: response.status };
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        await logError("Failed to fetch exchange rate", { error: error.message });
        return { error: true, message: "Error interno al consultar la API de tipo de cambio." };
    }
}


/**
 * Fetches the status of a tax exemption from the configured Hacienda API endpoint.
 * @param {string} authNumber - The authorization number of the exemption to check.
 * @returns {Promise<any>} The JSON response from the external API or an error object.
 */
export async function getExemptionStatus(authNumber: string): Promise<any> {
    if (!authNumber) {
        return { error: true, message: "Authorization number is required", status: 400 };
    }

    try {
        const apiSettings = await getApiSettingsDb();
        if (!apiSettings?.haciendaExemptionApi) {
            throw new Error("Exemption API URL not configured in settings.");
        }

        const fullApiUrl = `${apiSettings.haciendaExemptionApi}${authNumber}`;

        const response = await fetch(fullApiUrl, {
             next: { revalidate: 86400 } // Cache for 24 hours
        });
        
        const errorPayload = { 
            status: response.status, 
            statusText: response.statusText, 
            authNumber: authNumber,
            url: fullApiUrl
        };

        if (!response.ok) {
            if (response.status === 404) {
                 await logWarn("Exemption not found in Hacienda API", errorPayload);
                 return { error: true, message: "Exoneración no encontrada en Hacienda.", status: 404 };
            }
            await logError("Error fetching exemption from external API", errorPayload);
            return { error: true, message: `Error de API externa (${response.status})`, status: response.status };
        }

        const data = await response.json();
        return data;

    } catch (error: any) {
        await logError(`Failed to fetch exemption for auth number: ${authNumber}`, { error: error.message });
        return { error: true, message: "Error interno al consultar la API de exoneraciones." };
    }
}

/**
 * Fetches the API settings from the database.
 * This is a server action wrapper for the database function.
 * @returns {Promise<ApiSettings | null>} The API settings.
 */
export async function getApiSettings(): Promise<ApiSettings | null> {
    return getApiSettingsDb();
}

/**
 * Fetches the email settings from the database.
 * This is a server action wrapper for the database function.
 * @returns {Promise<Partial<EmailSettings>>} The email settings.
 */
export async function getEmailSettings(): Promise<Partial<EmailSettings>> {
    return getEmailSettingsDb();
}
