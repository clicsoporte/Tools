import { authorizePage } from "@/modules/core/lib/auth-guard";
import ManageLocationsClient from "./locations-client";

export const dynamic = 'force-dynamic';

export default async function ManageLocationsPage() {
    await authorizePage('warehouse:locations:create');
    return <ManageLocationsClient />;
}
