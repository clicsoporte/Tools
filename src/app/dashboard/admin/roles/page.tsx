import { authorizePage } from "@/modules/core/lib/auth-guard";
import RolesClient from "./roles-client";

export default async function RolesPage() {
    await authorizePage('roles:read');
    return <RolesClient />;
}
