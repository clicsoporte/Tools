// src/modules/hacienda/types.ts

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
};

export type EnrichedExemptionInfo = HaciendaExemptionApiResponse & {
    enrichedCabys: EnrichedCabysItem[];
};
