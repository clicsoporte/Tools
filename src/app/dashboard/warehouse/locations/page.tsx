"use client";
import { authorizePage } from "@/modules/core/lib/auth-guard";
import ManageLocationsClient from "./locations-client";

export const dynamic = 'force-dynamic';

export default function ManageLocationsPage() {
    // await authorizePage('warehouse:locations:create'); // This is a server-side function and cannot be used in a client component.
    return <ManageLocationsClient />;
}
