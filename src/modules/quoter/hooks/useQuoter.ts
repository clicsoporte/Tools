/**
 * @fileoverview Custom hook `useQuoter` for managing the state and logic of the QuoterPage component.
 * This hook encapsulates the entire business logic of the quoting tool, including state management for
 * quote lines, customer data, currency, calculations, and actions like generating PDFs and saving drafts.
 * This separation of concerns makes the `QuoterPage` component cleaner and focused only on rendering the UI.
 */
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/modules/core/hooks/use-toast";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import type { Customer, Product, Company, User, QuoteDraft, QuoteLine, Exemption, HaciendaExemptionApiResponse, ExemptionLaw, StockInfo } from "@/modules/core/types";
import { logError, logInfo, logWarn } from "@/modules/core/lib/logger";
import {
  saveQuoteDraft,
  getAllQuoteDrafts,
  deleteQuoteDraft,
  saveCompanySettings,
} from "@/modules/core/lib/db";
import { format, parseISO, isValid } from 'date-fns';
import { useDebounce } from "use-debounce";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { generateDocument } from "@/modules/core/lib/pdf-generator";
import { getExemptionStatus } from "@/modules/hacienda/lib/actions";
import type { RowInput } from "jspdf-autotable";

/**
 * Defines the initial state for a new quote.
 */
const initialQuoteState = {
  lines: [] as QuoteLine[],
  selectedCustomer: null as Customer | null,
  customerDetails: "",
  deliveryAddress: "",
  deliveryDate: "",
  sellerName: "",
  quoteDate: "",
  validUntilDate: "",
  paymentTerms: "contado",
  creditDays: 0,
  notes: "Precios sujetos a cambio sin previo aviso.",
  decimalPlaces: 2,
  purchaseOrderNumber: "",
};

type ExemptionInfo = {
    erpExemption: Exemption;
    haciendaExemption: HaciendaExemptionApiResponse | null;
    isLoading: boolean;
    isErpValid: boolean;
    isHaciendaValid: boolean;
    isSpecialLaw: boolean;
    apiError: boolean;
};

interface LineInputRefs {
  qty: HTMLInputElement | null;
  price: HTMLInputElement | null;
}

type ErrorResponse = { error: boolean; message: string; status?: number };

function isErrorResponse(data: any): data is ErrorResponse {
  return (data as ErrorResponse).error !== undefined;
}


/**
 * Normalizes a string value into a number.
 * It handles both commas and dots as decimal separators and strips invalid characters.
 * @param {string} value - The string to convert.
 * @returns {number} The parsed number, or 0 if invalid.
 */
const normalizeNumber = (value: string): number => {
    if (typeof value !== 'string' || !value.trim()) return 0;
    const standardizedValue = value.replace(/,/g, '.');
    const validNumberString = standardizedValue.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    const parsed = parseFloat(validNumberString);
    return isNaN(parsed) ? 0 : parsed;
};


/**
 * Main hook for the Quoter component.
 * @returns An object containing the quoter's state, actions, refs, and memoized selectors.
 */
export const useQuoter = () => {
  const { toast } = useToast();
  const { setTitle } = usePageTitle();
  const { 
    user: currentUser, customers, products, companyData: authCompanyData, 
    stockLevels, exchangeRateData, allExemptions, exemptionLaws,
    refreshAuth, isLoading: isAuthLoading 
  } = useAuth();
  
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currency, setCurrency] = useState("CRC");
  const [lines, setLines] = useState<QuoteLine[]>(initialQuoteState.lines);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialQuoteState.selectedCustomer);
  const [customerDetails, setCustomerDetails] = useState(initialQuoteState.customerDetails);
  const [deliveryAddress, setDeliveryAddress] = useState(initialQuoteState.deliveryAddress);
  const [exchangeRate, setExchangeRate] = useState<number | null>(exchangeRateData.rate);
  const [apiExchangeRate, setApiExchangeRate] = useState<number | null>(exchangeRateData.rate);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(initialQuoteState.purchaseOrderNumber);
  const [deliveryDate, setDeliveryDate] = useState(initialQuoteState.deliveryDate);
  const [sellerName, setSellerName] = useState(initialQuoteState.sellerName);
  const [quoteDate, setQuoteDate] = useState(initialQuoteState.quoteDate);
  const [companyData, setCompanyData] = useState<Company | null>(authCompanyData);
  const [sellerType, setSellerType] = useState("user");
  const [paymentTerms, setPaymentTerms] = useState(initialQuoteState.paymentTerms);
  const [creditDays, setCreditDays] = useState(initialQuoteState.creditDays);
  const [validUntilDate, setValidUntilDate] = useState(initialQuoteState.validUntilDate);
  const [notes, setNotes] = useState(initialQuoteState.notes);
  const [showInactiveCustomers, setShowInactiveCustomers] = useState(false);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [selectedLineForInfo, setSelectedLineForInfo] = useState<QuoteLine | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<(QuoteDraft & { customer: Customer | null})[]>([]);
  const [decimalPlaces, setDecimalPlaces] = useState(initialQuoteState.decimalPlaces);
  const [exemptionInfo, setExemptionInfo] = useState<ExemptionInfo | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isProductSearchOpen, setProductSearchOpen] = useState(false);
  const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);

  const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, companyData?.searchDebounceTime ?? 500);
  const [debouncedProductSearch] = useDebounce(productSearchTerm, companyData?.searchDebounceTime ?? 500);


  const productInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const lineInputRefs = useRef<Map<string, LineInputRefs>>(new Map());
  
  useEffect(() => {
    if (authCompanyData) {
        setQuoteNumber(`${authCompanyData.quotePrefix ?? "COT-"}${(authCompanyData.nextQuoteNumber ?? 1).toString().padStart(4, "0")}`);
    }
  }, [authCompanyData]);

  const checkExemptionStatus = useCallback(async (authNumber?: string) => {
    if (!authNumber) return;

    setExemptionInfo(prev => {
        if (!prev) return null;
        return { ...prev, isLoading: true, apiError: false };
    });

    const data = await getExemptionStatus(authNumber);
        
    // --- MANEJO DE ERROR ---
    if (isErrorResponse(data)) {
        logError("Error verifying exemption status", { message: data.message, authNumber });
        setExemptionInfo(prev => {
            if (!prev) return null;
            // Asegúrate de incluir TODAS las propiedades de ExemptionInfo
            return {
                ...prev, // Esto incluye erpExemption, isErpValid, isSpecialLaw
                haciendaExemption: null, // ✅ Siempre null en caso de error
                isHaciendaValid: false,
                isLoading: false,
                apiError: true,
            };
        });
        
        if (data.status === 404) {
            toast({ title: "Exoneración No Encontrada", description: `Hacienda no encontró la autorización ${authNumber}.`, variant: "destructive" });
        } else {
            toast({ title: "Error de API", description: `No se pudo consultar la exoneración. ${data.message}`, variant: "destructive" });
        }
        return;
    }
    
    // --- MANEJO DE ÉXITO ---
    setExemptionInfo(prev => {
         if (!prev) return null;
         return {
            ...prev, // Esto incluye erpExemption, isErpValid, isSpecialLaw
            haciendaExemption: data, // ✅ HaciendaExemptionApiResponse
            isHaciendaValid: new Date(data.fechaVencimiento) > new Date(),
            isLoading: false,
            apiError: false,
         }
    });
  }, [toast]);
  

  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
        setIsRefreshing(true);
        await refreshAuth();
        setIsRefreshing(false);
        toast({ title: "Datos Refrescados", description: "Los clientes, productos y exoneraciones han sido actualizados." });
    }
  }, [toast, refreshAuth]);

  useEffect(() => {
    setTitle("Cotizador");
    if (!isMounted) {
        const today = new Date();
        setQuoteDate(today.toISOString().substring(0, 10));
        setDeliveryDate(today.toISOString().substring(0, 16));
        const validDate = new Date();
        validDate.setDate(today.getDate() + 8);
        setValidUntilDate(validDate.toISOString().substring(0, 10));
        setIsMounted(true);
    }
  }, [setTitle, isMounted]);

  useEffect(() => {
    if (sellerType === "user" && currentUser) {
      setSellerName(currentUser.name);
    } else if (sellerType === "manual") {
      setSellerName("");
    }
  }, [sellerType, currentUser]);

  useEffect(() => {
      setCompanyData(authCompanyData);
      if (exchangeRateData.rate) {
          setExchangeRate(exchangeRateData.rate);
          setApiExchangeRate(exchangeRateData.rate);
      }
      if (authCompanyData) {
          setDecimalPlaces(authCompanyData.decimalPlaces ?? 2);
      }
  }, [authCompanyData, exchangeRateData]);


  useEffect(() => {
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const lastLineRefs = lineInputRefs.current.get(lastLine.id);
        lastLineRefs?.qty?.focus();
    }
  }, [lines.length]);

  const customerOptions = useMemo(() => {
    if (debouncedCustomerSearch.length < 2) return [];
    return (customers || [])
      .filter((c) => 
        (showInactiveCustomers || c.active === "S") &&
        (c.id.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) || c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()))
      )
      .map((c) => ({ value: c.id, label: `${c.id} - ${c.name}` }));
  }, [customers, showInactiveCustomers, debouncedCustomerSearch]);

  const productOptions = useMemo(() => {
    if (debouncedProductSearch.length < 2) return [];
    const searchLower = debouncedProductSearch.toLowerCase();
    return (products || [])
      .filter((p) => {
        const isActive = showInactiveProducts || p.active === "S";
        const matchesSearch = p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower);
        return isActive && matchesSearch;
      })
      .map((p) => {
        const stockInfo = stockLevels.find(s => s.itemId === p.id);
        const stockLabel = stockInfo ? ` (ERP: ${stockInfo.totalStock.toLocaleString()})` : '';
        return {
            value: p.id,
            label: `${p.id} - ${p.description}${stockLabel}`,
            className: p.active === "N" ? "text-red-500" : "",
        }
      });
  }, [products, showInactiveProducts, debouncedProductSearch, stockLevels]);


  // --- ACTIONS ---
  const addLine = (product: Product) => {
    const newLineId = new Date().toISOString();

    let taxRate = 0.13;
    if (product.isBasicGood === 'S') {
        taxRate = 0.01;
    } else if (exemptionInfo && (exemptionInfo.isErpValid || exemptionInfo.isHaciendaValid) && exemptionInfo.erpExemption.percentage > 0) {
      if (exemptionInfo.erpExemption.percentage >= 13) {
        taxRate = 0;
      }
    }
    
    const newLine: QuoteLine = {
      id: newLineId,
      product,
      quantity: 0,
      price: 0,
      tax: taxRate,
      displayQuantity: "",
      displayPrice: "",
    };
    setLines((prev) => [...prev, newLine]);
  };

  const handleSelectProduct = (productId: string) => {
    setProductSearchOpen(false);
    if (!productId) {
      setProductSearchTerm("");
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product) {
      addLine(product);
      setProductSearchTerm("");
    }
  };

  const handleProductInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && productOptions.length > 0) { e.preventDefault(); handleSelectProduct(productOptions[0].value); }
  };

  const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customerOptions.length > 0) { e.preventDefault(); handleSelectCustomer(customerOptions[0].value); }
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
    lineInputRefs.current.delete(id);
  };

  const updateLine = (id: string, updatedField: Partial<QuoteLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...updatedField } : line)));
  };

  const updateLineProductDetail = (id: string, updatedField: Partial<Product>) => {
    setLines((prev) => prev.map((line) =>
      line.id === id ? { ...line, product: { ...line.product, ...updatedField } } : line
    ));
  };

  const handleCurrencyToggle = async () => {
    if (!exchangeRate) {
      toast({ title: "Tipo de cambio no disponible", description: "No se puede cambiar de moneda.", variant: "destructive" });
      await logWarn("Attempted currency toggle without exchange rate");
      return;
    }
    const newCurrency = currency === "CRC" ? "USD" : "CRC";
    const convertedLines = lines.map((line) => {
      const newPrice = newCurrency === "USD" ? line.price / exchangeRate : line.price * exchangeRate;
      return { ...line, price: newPrice, displayPrice: newPrice.toString() };
    });
    setLines(convertedLines);
    setCurrency(newCurrency);
    await logInfo(`Currency changed to ${newCurrency}`);
  };

  const formatCurrency = (amount: number) => {
    const prefix = currency === "CRC" ? "CRC " : "$ ";
    return `${prefix}${amount.toLocaleString("es-CR", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  };

  const handleSelectCustomer = (customerId: string) => {
    setCustomerSearchOpen(false);
    if (!customerId) {
        setSelectedCustomer(null);
        setCustomerDetails("");
        setCustomerSearchTerm("");
        setExemptionInfo(null);
        return;
    }
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setCustomerDetails(`ID: ${customer.id}\nNombre: ${customer.name}\nTel: ${customer.phone}\nEmail: ${customer.email || customer.electronicDocEmail}`);
      setCustomerSearchTerm(`${customer.id} - ${customer.name}`);
      setDeliveryAddress(customer.address);
      const paymentConditionDays = parseInt(customer.paymentCondition, 10);
      if (!isNaN(paymentConditionDays) && paymentConditionDays > 1) {
        setPaymentTerms("credito");
        setCreditDays(paymentConditionDays);
      } else {
        setPaymentTerms("contado");
        setCreditDays(0);
      }

      const customerExemption = allExemptions.find(ex => ex.customer?.trim() === customer.id.trim());
      
      if (customerExemption) {
          const isErpValid = new Date(customerExemption.endDate) > new Date();
          const isSpecial = exemptionLaws.some(law => 
              (law.docType?.trim() && law.docType.trim() === customerExemption.docType?.trim()) || 
              (law.authNumber?.trim() && String(law.authNumber).trim() === String(customerExemption.authNumber).trim())
          );
          
          const initialExemptionState: ExemptionInfo = {
              erpExemption: customerExemption,
              haciendaExemption: null,
              isLoading: !isSpecial,
              isErpValid: isErpValid,
              isHaciendaValid: false,
              isSpecialLaw: isSpecial,
              apiError: false,
          };
          setExemptionInfo(initialExemptionState);

          if (!isSpecial) {
              checkExemptionStatus(customerExemption.authNumber);
          }
      } else {
          setExemptionInfo(null);
      }
    }
  };

  const handleCustomerDetailsChange = (value: string) => {
    setCustomerDetails(value);
    if (selectedCustomer) {
      setSelectedCustomer(null);
      setExemptionInfo(null);
    }
  };

  const incrementAndSaveQuoteNumber = async () => {
    if (!companyData) return;
    const newNextNumber = (companyData.nextQuoteNumber || 0) + 1;
    const newCompanyData = { ...companyData, nextQuoteNumber: newNextNumber };
    await saveCompanySettings(newCompanyData);
    setCompanyData(newCompanyData);
    setQuoteNumber(`${newCompanyData.quotePrefix || "COT-"}${newNextNumber.toString().padStart(4, "0")}`);
  };
  
  const handleSaveDecimalPlaces = async () => {
    if (!companyData) return;
    const newCompanyData = { ...companyData, decimalPlaces };
    await saveCompanySettings(newCompanyData);
    setCompanyData(newCompanyData);
    toast({ title: "Precisión Guardada", description: `La nueva precisión de ${decimalPlaces} decimales se ha guardado.` });
    await logInfo("Default decimal places updated", { newPrecision: decimalPlaces });
  };
  
  const generatePDF = async () => {
    if (isAuthLoading || !companyData) {
        toast({ title: "Por favor espere", description: "Los datos de configuración de la empresa aún se están cargando.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    
    let logoDataUrl: string | null = null;
    if (companyData.logoUrl) {
        try {
            const response = await fetch(companyData.logoUrl);
            const blob = await response.blob();
            logoDataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Error fetching and processing logo:", e);
        }
    }

    const tableRows: RowInput[] = lines.map(line => [
        line.product.id,
        line.product.description,
        { content: `${line.quantity.toLocaleString('es-CR')}\n${line.product.unit}`, styles: { halign: 'center' } as any },
        line.product.cabys,
        { content: formatCurrency(line.price), styles: { halign: 'right' } as any },
        { content: `${(line.tax * 100).toFixed(0)}%`, styles: { halign: 'center' } as any },
        { content: formatCurrency(line.quantity * line.price * (1 + line.tax)), styles: { halign: 'right' } as any },
    ]);
    
    const doc = generateDocument({
        docTitle: "COTIZACIÓN",
        docId: quoteNumber,
        meta: [
            { label: 'Fecha', value: format(parseISO(quoteDate), "dd/MM/yyyy") },
            { label: 'Válida hasta', value: format(parseISO(validUntilDate), "dd/MM/yyyy") },
            ...(purchaseOrderNumber ? [{ label: 'Nº OC', value: purchaseOrderNumber }] : [])
        ],
        companyData: companyData,
        logoDataUrl,
        sellerInfo: {
            name: sellerName,
            email: sellerType === 'user' ? currentUser?.email : undefined,
            phone: sellerType === 'user' ? currentUser?.phone : undefined,
            whatsapp: sellerType === 'user' ? currentUser?.whatsapp : undefined
        },
        blocks: [
            { title: 'Cliente', content: customerDetails },
            { title: 'Entrega', content: `Dirección: ${deliveryAddress}\nFecha Entrega: ${deliveryDate ? format(parseISO(deliveryDate), "dd/MM/yyyy HH:mm") : 'N/A'}` }
        ],
        table: {
            columns: [
                "Código", 
                "Descripción", 
                { content: "Cant. / Und.", styles: { halign: 'center' } }, 
                "Cabys", 
                "Precio", 
                { content: "Imp. %", styles: { halign: 'center' } }, 
                "Total"
            ],
            rows: tableRows,
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 45, halign: 'center' },
                3: { cellWidth: 70 },
                4: { cellWidth: 60, halign: 'right' },
                5: { cellWidth: 30, halign: 'center' },
                6: { cellWidth: 70, halign: 'right' },
            }
        },
        notes: notes,
        paymentInfo: paymentTerms === 'credito' ? `Crédito ${creditDays} días` : 'Contado',
        totals: [
            { label: 'Subtotal:', value: formatCurrency(totals.subtotal) },
            { label: 'Impuestos:', value: formatCurrency(totals.totalTaxes) },
            { label: `Total ${currency}:`, value: formatCurrency(totals.total) },
        ]
    });
    
    doc.save(`${quoteNumber}.pdf`);
    toast({ title: "Cotización Generada", description: `El PDF de la cotización Nº ${quoteNumber} ha sido descargado.` });
    logInfo(`Cotización generada: ${quoteNumber}`, { customer: selectedCustomer?.name, total: totals.total });
    await incrementAndSaveQuoteNumber();
    setIsProcessing(false);
  };

  const resetQuote = async () => {
    const today = new Date();
    setLines(initialQuoteState.lines);
    setSelectedCustomer(initialQuoteState.selectedCustomer);
    setCustomerDetails(initialQuoteState.customerDetails);
    setDeliveryAddress(initialQuoteState.deliveryAddress);
    setDeliveryDate(today.toISOString().substring(0, 16));
    setSellerName(currentUser?.name || initialQuoteState.sellerName);
    setQuoteDate(today.toISOString().substring(0, 10));
    setPurchaseOrderNumber(initialQuoteState.purchaseOrderNumber);
    setExchangeRate(apiExchangeRate);
    setSellerType("user");
    setPaymentTerms(initialQuoteState.paymentTerms);
    setCreditDays(initialQuoteState.creditDays);
    const validDate = new Date();
    validDate.setDate(today.getDate() + 8);
    setValidUntilDate(validDate.toISOString().substring(0, 10));
    setNotes(initialQuoteState.notes);
    setProductSearchTerm("");
    setCustomerSearchTerm("");
    setExemptionInfo(null);
    if (companyData) {
        setQuoteNumber(`${companyData.quotePrefix || "COT-"}${(companyData.nextQuoteNumber || 1).toString().padStart(4, "0")}`);
        setDecimalPlaces(companyData.decimalPlaces ?? 2);
    }
    toast({ title: "Nueva Cotización", description: "El formulario ha sido limpiado." });
    await logInfo("Quoter form cleared.");
  };

  const saveDraft = async () => {
    if (!currentUser) {
      toast({ title: "Error", description: "Debe iniciar sesión para guardar borradores.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
        const draft: QuoteDraft = {
          id: quoteNumber,
          createdAt: new Date().toISOString(),
          userId: currentUser.id,
          customerId: selectedCustomer ? selectedCustomer.id : null,
          customerDetails: customerDetails,
          lines: lines.map(({ displayQuantity, displayPrice, ...rest }) => rest),
          totals: totals,
          notes: notes,
          currency: currency,
          exchangeRate: exchangeRate,
          purchaseOrderNumber: purchaseOrderNumber,
          deliveryAddress: deliveryAddress,
          deliveryDate: deliveryDate,
          sellerName: sellerName,
          sellerType: sellerType,
          quoteDate: quoteDate,
          validUntilDate: validUntilDate,
          paymentTerms: paymentTerms,
          creditDays: creditDays,
        };
        await saveQuoteDraft(draft);
        toast({ title: "Borrador Guardado", description: `La cotización Nº ${quoteNumber} ha sido guardada.` });
        await logInfo(`Quote draft saved: ${quoteNumber}`);
        await incrementAndSaveQuoteNumber();
    } catch (error: any) {
        logError("Failed to save draft", { error: error.message });
        toast({ title: "Error", description: "No se pudo guardar el borrador.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const loadDrafts = async () => {
    if (isAuthLoading || !currentUser) return;
    const draftsFromDb = await getAllQuoteDrafts(currentUser.id);
    const enrichedDrafts = draftsFromDb.map(draft => ({
        ...draft,
        customer: customers.find(c => c.id === draft.customerId) || null
    }));
    setSavedDrafts(enrichedDrafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleLoadDraft = (draft: QuoteDraft) => {
    setQuoteNumber(draft.id);
    setPurchaseOrderNumber(draft.purchaseOrderNumber || "");
    setNotes(draft.notes);
    setCurrency(draft.currency);
    setExchangeRate(draft.exchangeRate);
    setDeliveryAddress(draft.deliveryAddress || "");
    setDeliveryDate(draft.deliveryDate || "");
    setSellerName(draft.sellerName || "");
    setSellerType(draft.sellerType || "user");
    setQuoteDate(draft.quoteDate || "");
    setValidUntilDate(draft.validUntilDate || "");
    setPaymentTerms(draft.paymentTerms || "contado");
    setCreditDays(draft.creditDays || 0);
    
    if (draft.customerId) {
      handleSelectCustomer(draft.customerId);
    } else {
      setSelectedCustomer(null);
      setCustomerDetails(draft.customerDetails || "");
      setExemptionInfo(null);
    }
    
    const draftLines = draft.lines.map((line: Omit<QuoteLine, 'displayQuantity' | 'displayPrice'>) => ({
      ...line,
      displayQuantity: String(line.quantity),
      displayPrice: String(line.price),
    }));
    setLines(draftLines);

    toast({ title: "Borrador Cargado", description: `La cotización Nº ${draft.id} ha sido cargada.` });
  };

  const handleDeleteDraft = async (draftId: string) => {
    await deleteQuoteDraft(draftId);
    await logInfo(`Quote draft deleted: ${draftId}`);
    await loadDrafts();
    toast({ title: "Borrador Eliminado", description: `El borrador Nº ${draftId} ha sido eliminado.`, variant: "destructive" });
  };
  
  const handleNumericInputBlur = (lineId: string, field: 'quantity' | 'price', displayValue: string) => {
    const numericValue = normalizeNumber(displayValue);
    updateLine(lineId, {
        [field]: numericValue,
        [field === 'quantity' ? 'displayQuantity' : 'displayPrice']: String(numericValue)
    });
  };

  const handleLineInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, lineId: string, field: 'qty' | 'price') => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const lineRefs = lineInputRefs.current.get(lineId);
        if (field === 'qty' && lineRefs?.price) {
            lineRefs.price.focus();
        } else if (field === 'price' && productInputRef.current) {
            productInputRef.current.focus();
        }
    }
  };

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => acc + (line.quantity * line.price), 0);
    const totalTaxes = lines.reduce((acc, line) => acc + (line.quantity * line.price * line.tax), 0);
    const total = subtotal + totalTaxes;
    return { subtotal, totalTaxes, total };
  }, [lines, decimalPlaces]);

  
  const selectors = { totals, customerOptions, productOptions };

  return {
    state: {
      currency, lines, selectedCustomer, customerDetails, deliveryAddress, exchangeRate, exchangeRateDate: exchangeRateData.date, exchangeRateLoaded: !!exchangeRateData.rate,
      quoteNumber, deliveryDate, sellerName, quoteDate, companyData, currentUser, sellerType,
      paymentTerms, creditDays, validUntilDate, notes, products, customers, showInactiveCustomers,
      showInactiveProducts, selectedLineForInfo, savedDrafts, decimalPlaces, productSearchTerm, purchaseOrderNumber,
      exemptionInfo, isRefreshing, customerSearchTerm, isProductSearchOpen, isCustomerSearchOpen, isProcessing
    },
    actions: {
      setCurrency, setLines, setSelectedCustomer, setCustomerDetails, setDeliveryAddress, setExchangeRate,
      setPurchaseOrderNumber, setDeliveryDate, setSellerName, setQuoteDate, setSellerType, setPaymentTerms,
      setCreditDays, setValidUntilDate, setNotes, setShowInactiveCustomers,
      setShowInactiveProducts, setSelectedLineForInfo, setDecimalPlaces, setQuoteNumber,
      setProductSearchTerm, setCustomerSearchTerm, setProductSearchOpen, setCustomerSearchOpen,
      addLine, removeLine, updateLine, updateLineProductDetail, handleCurrencyToggle, formatCurrency,
      handleSelectCustomer, handleSelectProduct, incrementAndSaveQuoteNumber, handleSaveDecimalPlaces,
      generatePDF, resetQuote, saveDraft, loadDrafts, handleLoadDraft, handleDeleteDraft, handleNumericInputBlur,
      handleCustomerDetailsChange, loadInitialData, handleLineInputKeyDown, checkExemptionStatus, handleProductInputKeyDown, handleCustomerInputKeyDown,
    },
    refs: { productInputRef, customerInputRef, lineInputRefs },
    selectors,
  };
};
