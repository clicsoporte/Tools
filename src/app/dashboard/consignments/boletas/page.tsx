import BoletasClient from "./boletas-client";

export const dynamic = 'force-dynamic';

export default function BoletasPage() {
    // Secure the page with the new read permission
    // await authorizePage('consignments:boletas:read');
    return <BoletasClient />;
}
