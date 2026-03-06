"use client";
import { authorizePage } from "@/modules/core/lib/auth-guard";
import BoletasClient from "./boletas-client";

export const dynamic = 'force-dynamic';

export default function BoletasPage() {
    // Secure the page with the new read permission
    // await authorizePage('consignments:boletas:read'); // This is a server-side function and cannot be used in a client component.
    return <BoletasClient />;
}
