"use client";
import { authorizePage } from "@/modules/core/lib/auth-guard";
import RolesClient from "./roles-client";

export const dynamic = 'force-dynamic';

export default function RolesPage() {
    // await authorizePage('roles:read'); // This line is commented out as it's a server-side function
    return <RolesClient />;
}
