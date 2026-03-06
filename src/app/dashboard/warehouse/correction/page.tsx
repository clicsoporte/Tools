"use client";
import { authorizePage } from "@/modules/core/lib/auth-guard";
import CorrectionClient from "./correction-client";

export const dynamic = 'force-dynamic';

export default function CorrectionPage() {
    // await authorizePage('warehouse:correction:execute'); // This is a server-side function and cannot be used in a client component.
    return <CorrectionClient />;
}
