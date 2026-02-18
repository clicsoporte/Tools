import { authorizePage } from "@/modules/core/lib/auth-guard";
import BoletasClient from "./boletas-client";

export default async function BoletasPage() {
    // Secure the page with the new read permission
    await authorizePage('consignments:boletas:read');
    return <BoletasClient />;
}
