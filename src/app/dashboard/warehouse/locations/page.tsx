import ManageLocationsClient from "./locations-client";

export const dynamic = 'force-dynamic';

export default function ManageLocationsPage() {
    // await authorizePage('warehouse:locations:create');
    return <ManageLocationsClient />;
}
