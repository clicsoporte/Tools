/**
 * @fileoverview Reusable component for rendering an inventory counting form.
 */
'use client';

import React from 'react';
import type { ConsignmentProduct } from '@/modules/core/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryCountFormProps {
    products: ConsignmentProduct[];
    counts: Record<string, string>;
    onQuantityChange: (productId: string, value: string) => void;
    getProductName: (id: string) => string;
    height?: string;
}

export const InventoryCountForm: React.FC<InventoryCountFormProps> = ({
    products,
    counts,
    onQuantityChange,
    getProductName,
    height = 'h-[60vh]',
}) => {
    return (
        <ScrollArea className={`${height} p-1`}>
            <div className="space-y-4">
                {products.length > 0 ? (
                    products.map((p: ConsignmentProduct) => (
                        <Card key={p.product_id}>
                            <CardContent className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-4 items-center">
                                <div className="col-span-2 sm:col-span-3">
                                    <p className="font-medium leading-snug">{getProductName(p.product_id)}</p>
                                    <p className="text-sm text-muted-foreground font-mono">{p.product_id}</p>
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor={`count-${p.product_id}`} className="sr-only">Cantidad</Label>
                                    <Input
                                        id={`count-${p.product_id}`}
                                        type="number"
                                        placeholder="Cant."
                                        value={counts[p.product_id] || ''}
                                        onChange={(e) => onQuantityChange(p.product_id, e.target.value)}
                                        className="text-right text-2xl h-14 font-bold hide-number-arrows"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        <p className="font-semibold">Este acuerdo no tiene productos autorizados.</p>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
};
