import CorrectionClient from "./correction-client";

export const dynamic = 'force-dynamic';

export default function CorrectionPage() {
    // await authorizePage('warehouse:correction:execute');
    return <CorrectionClient />;
}
