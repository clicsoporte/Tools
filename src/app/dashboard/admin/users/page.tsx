"use client";
import { authorizePage } from "@/modules/core/lib/auth-guard";
import UsersClient from "./users-client";

export const dynamic = 'force-dynamic';

export default function UsersPage() {
    // await authorizePage('users:read'); // This is a server-side function and cannot be used in a client component.
    return <UsersClient />;
}
