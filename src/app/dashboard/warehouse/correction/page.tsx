import { authorizePage } from "@/modules/core/lib/auth-guard";
import CorrectionClient from "./correction-client";

export default async function CorrectionPage() {
    await authorizePage('warehouse:correction:execute');
    return <CorrectionClient />;
}
