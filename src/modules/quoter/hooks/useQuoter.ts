/**
 * @fileoverview Custom hook `useQuoter` for managing the state and logic of the QuoterPage component.
 * This hook encapsulates the entire business logic of the quoting tool, including state management for
 * quote lines, customer data, currency, calculations, and actions like generating PDFs and saving drafts.
 * This separation of concerns makes the `QuoterPage` component cleaner and focused only on rendering the UI.
 */
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/modules/core/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import type { Customer, Product, Company, User, QuoteDraft, QuoteLine, Exemption, HaciendaExemptionApiResponse, ExemptionLaw, StockInfo } from "@/modules/core/types";
import { logError, logInfo, logWarn } from "@/modules/core/lib/logger";
import {
  saveQuoteDraft,
  getAllQuoteDrafts,
  deleteQuoteDraft,
  saveCompanySettings,
  getAllExemptions,
  getExemptionLaws,
} from "@/modules/core/lib/db";
import { getExemptionStatus } from "@/modules/core/lib/api-actions";
import { format, parseISO, isValid } from 'date-fns';
import { useDebounce } from "use-debounce";
import { useAuth } from "@/modules/core/hooks/useAuth";

/**
 * Defines the initial state for a new quote.
 * This object is used to reset the form.
 */
const initialQuoteState = {
  lines: [] as QuoteLine[],
  selectedCustomer: null as Customer | null,
  customerDetails: "",
  deliveryAddress: "",
  deliveryDate: "",
  sellerName: "",
  quoteDate: new Date().toISOString().substring(0, 10), // Initialize here to avoid hydration issues
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
  const { user: currentUser, customers, products, companyData: authCompanyData, stockLevels, exchangeRateData, refreshAuth, isLoading: isAuthLoading } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currency, setCurrency] = useState("CRC");
  const [lines, setLines] = useState<QuoteLine[]>(initialQuoteState.lines);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialQuoteState.selectedCustomer);
  const [customerDetails, setCustomerDetails] = useState(initialQuoteState.customerDetails);
  const [deliveryAddress, setDeliveryAddress] = useState(initialQuoteState.deliveryAddress);
  const [exchangeRate, setExchangeRate] = useState<number | null>(exchangeRateData.rate);
  const [exemptionLaws, setExemptionLaws] = useState<ExemptionLaw[]>([]);
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
  const [allExemptions, setAllExemptions] = useState<Exemption[]>([]);
  const [showInactiveCustomers, setShowInactiveCustomers] = useState(false);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [selectedLineForInfo, setSelectedLineForInfo] = useState<QuoteLine | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<(QuoteDraft & { customer: Customer | null})[]>([]);
  const [decimalPlaces, setDecimalPlaces] = useState(initialQuoteState.decimalPlaces);
  const [exemptionInfo, setExemptionInfo] = useState<ExemptionInfo | null>(null);
  
  // State for search popovers
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isProductSearchOpen, setProductSearchOpen] = useState(false);
  const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);

  const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, companyData?.searchDebounceTime ?? 500);
  const [debouncedProductSearch] = useDebounce(productSearchTerm, companyData?.searchDebounceTime ?? 500);


  // --- REFS FOR KEYBOARD NAVIGATION ---
  const productInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const lineInputRefs = useRef<Map<string, LineInputRefs>>(new Map());

  // Derived state for the quote number
  const quoteNumber = useMemo(() => {
    if (!companyData) return "";
    return `${companyData.quotePrefix ?? "COT-"}${(companyData.nextQuoteNumber ?? 1).toString().padStart(4, "0")}`;
  }, [companyData]);

  const checkExemptionStatus = useCallback(async (authNumber?: string) => {
    if (!authNumber) return;

    setExemptionInfo(prev => {
        if (!prev) return null;
        return { ...prev, isLoading: true, apiError: false };
    });

    try {
        const data = await getExemptionStatus(authNumber);
        
        if (data.error) {
            throw new Error(data.message || "Error desconocido al verificar la exoneración.");
        }
        
        setExemptionInfo(prev => {
             if (!prev) return null;
             return {
                ...prev,
                haciendaExemption: data as HaciendaExemptionApiResponse,
                isHaciendaValid: new Date((data as HaciendaExemptionApiResponse).fechaVencimiento) > new Date(),
                isLoading: false,
             }
        });
    } catch (error: any) {
        logError("Error verificando exoneración en Hacienda", { error: error.message, authNumber });
        setExemptionInfo(prev => {
            if (!prev) return null;
            return { ...prev, isLoading: false, apiError: true }
        });
        toast({ title: "Error de API", description: `No se pudo consultar la exoneración. ${error.message}`, variant: "destructive" });
    }
  }, [toast]);
  

  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
        setIsRefreshing(true);
        await refreshAuth(); // This will re-fetch all data in the context
    }
    
    try {
      const [dbExemptions, dbLaws] = await Promise.all([
          getAllExemptions(),
          getExemptionLaws()
      ]);
      setAllExemptions(dbExemptions || []);
      setExemptionLaws(dbLaws || []);

      if (isRefresh) {
          toast({ title: "Datos Refrescados", description: "Los clientes, productos y exoneraciones han sido actualizados." });
      }

    } catch (error) {
      logError("Failed to load initial quoter data", { error });
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
    } finally {
        if(isRefresh) {
            setIsRefreshing(false);
        }
    }
  }, [toast, refreshAuth]);

  useEffect(() => {
    setTitle("Cotizador");
    loadInitialData();
  }, [setTitle, loadInitialData]);

  useEffect(() => {
    // Set dates on client side to avoid hydration errors on complex scenarios,
    // though simple ones are fine.
    const today = new Date();
    setDeliveryDate(today.toISOString().substring(0, 16));
    setValidUntilDate(new Date(new Date().setDate(today.getDate() + 8)).toISOString().substring(0, 10));
  }, []);

  useEffect(() => {
    if (sellerType === "user" && currentUser) {
      setSellerName(currentUser.name);
    } else if (sellerType === "manual") {
      setSellerName("");
    }
  }, [sellerType, currentUser]);

  useEffect(() => {
      setCompanyData(authCompanyData);
      setExchangeRate(exchangeRateData.rate);
      setApiExchangeRate(exchangeRateData.rate);
  }, [authCompanyData, exchangeRateData]);


  // Focus qty input of the newest line
  useEffect(() => {
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const lastLineRefs = lineInputRefs.current.get(lastLine.id);
        lastLineRefs?.qty?.focus();
    }
  }, [lines.length]);

  // --- ACTIONS ---
  const addLine = (product: Product) => {
    const newLineId = new Date().toISOString();

    let taxRate = 0.13; // Default tax
    // Auto-set tax to 0 if there's a valid exemption for 13%
    if (exemptionInfo && (exemptionInfo.isErpValid || exemptionInfo.isHaciendaValid) && exemptionInfo.erpExemption.percentage === 13) {
      taxRate = 0;
    }
    // Set tax to 1% if it's a basic good
    if (product.isBasicGood === 'S') {
        taxRate = 0.01;
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
    const prefix = currency === "CRC" ? "₡" : "$";
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
              isLoading: !isSpecial, // Only load if it's not a special law
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

  const incrementAndSaveQuoteNumber = async () => {
    if (!companyData) return;
    const newCompanyData = { ...companyData, nextQuoteNumber: (companyData.nextQuoteNumber || 0) + 1 };
    await saveCompanySettings(newCompanyData);
    setCompanyData(newCompanyData);
  };

  const handleSaveDecimalPlaces = async () => {
    if (!companyData) return;
    const newCompanyData = { ...companyData, decimalPlaces };
    await saveCompanySettings(newCompanyData);
    setCompanyData(newCompanyData);
    toast({ title: "Precisión Guardada", description: `La nueva precisión de ${decimalPlaces} decimales se ha guardado.` });
    await logInfo("Default decimal places updated", { newPrecision: decimalPlaces });
  };
  
  const generatePDF = () => {
    if (isAuthLoading || !companyData) {
        toast({ title: "Por favor espere", description: "Los datos aún se están cargando.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);

    try {
        const doc = new jsPDF();
        const currentQuoteNumber = quoteNumber;

        const addHeaderAndContent = () => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            doc.setFontSize(18);
            doc.text("COTIZACIÓN", pageWidth / 2, 22, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text(`Nº: ${currentQuoteNumber}`, pageWidth - margin, 22, { align: 'right' });
            doc.setFontSize(10);
            doc.text(`Fecha: ${format(parseISO(quoteDate), "dd/MM/yyyy")}`, pageWidth - margin, 28, { align: 'right' });
            doc.text(`Válida hasta: ${format(parseISO(validUntilDate), "dd/MM/yyyy")}`, pageWidth - margin, 34, { align: 'right' });
            if (purchaseOrderNumber) doc.text(`Nº OC: ${purchaseOrderNumber}`, pageWidth - margin, 40, { align: 'right' });
            let startY = 40;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(companyData.name, margin, startY);
            doc.setFont('helvetica', 'normal');
            startY += 6;
            doc.text(`Cédula: ${companyData.taxId}`, margin, startY);
            startY += 6;
            const splitAddress = doc.splitTextToSize(companyData.address, 80);
            doc.text(splitAddress, margin, startY);
            startY += (splitAddress.length * 5);
            doc.text(`Tel: ${companyData.phone}`, margin, startY);
            startY += 6;
            doc.text(`Email: ${companyData.email}`, margin, startY);
            let sellerStartY = 46;
            doc.setFont('helvetica', 'bold');
            doc.text("Vendedor:", pageWidth - margin, sellerStartY, { align: 'right' });
            sellerStartY += 6;
            doc.setFont('helvetica', 'normal');
            if (sellerType === 'user' && currentUser) {
                doc.text(currentUser.name, pageWidth - margin, sellerStartY, { align: 'right' });
                sellerStartY += 6;
                if (currentUser.phone) doc.text(`Tel: ${currentUser.phone}`, pageWidth - margin, sellerStartY, { align: 'right' });
                sellerStartY += 6;
                if (currentUser.whatsapp) doc.text(`WhatsApp: ${currentUser.whatsapp}`, pageWidth - margin, sellerStartY, { align: 'right' });
                sellerStartY += 6;
                doc.text(currentUser.email, pageWidth - margin, sellerStartY, { align: 'right' });
            } else {
                doc.text(sellerName, pageWidth - margin, sellerStartY, { align: 'right' });
            }

            autoTable(doc, {
                startY: 95,
                head: [['Cliente', 'Entrega']],
                body: [[customerDetails, `Dirección: ${deliveryAddress}\nFecha Entrega: ${deliveryDate ? format(parseISO(deliveryDate), "dd/MM/yyyy HH:mm") : 'N/A'}`]],
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: {top: 0, right: 0, bottom: 2, left: 0}, fontStyle: 'normal' },
                headStyles: { fontStyle: 'bold' }
            });

            const tableColumn = ["Código", "Descripción", "Cant.", "Und", "Cabys", "Precio", "Imp.", "Total"];
            const tableRows: any[][] = lines.map(line => [
                line.product.id,
                { content: line.product.description, styles: { cellWidth: 'auto' } },
                line.quantity,
                line.product.unit,
                line.product.cabys,
                formatCurrency(line.price),
                `${(line.tax * 100).toFixed(0)}%`,
                formatCurrency(line.quantity * line.price * (1 + line.tax)),
            ]);
            
            const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
                const pageHeight = doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.getWidth();
                doc.setFontSize(8);
                doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
            };

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 15, halign: 'right' },
                    3: { cellWidth: 15 }, 4: { cellWidth: 25 }, 5: { cellWidth: 25, halign: 'right' },
                    6: { cellWidth: 15, halign: 'center' }, 7: { cellWidth: 25, halign: 'right' },
                },
                margin: { top: 80, bottom: 30 },
                didDrawPage: (data) => {
                    const addPageHeader = (doc: jsPDF) => {
                        if (companyData.logoUrl) {
                            doc.addImage(companyData.logoUrl, 'PNG', 14, 15, 50, 15);
                        }
                    };
                    if (data.pageNumber > 1) {
                        addPageHeader(doc);
                    }
                },
                didParseCell: (data) => {
                    if (data.section === 'head') {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY;
            doc.setPage(doc.getNumberOfPages());
            let bottomContentY = finalY > doc.internal.pageSize.getHeight() - 70 ? 20 : finalY + 10;
            if (bottomContentY > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                bottomContentY = 20;
            }
            const totalsX = doc.internal.pageSize.getWidth() - margin;
            doc.setFontSize(10);
            doc.text(`Subtotal: ${formatCurrency(totals.subtotal)}`, totalsX, bottomContentY, { align: 'right' });
            bottomContentY += 6;
            doc.text(`Impuestos: ${formatCurrency(totals.totalTaxes)}`, totalsX, bottomContentY, { align: 'right' });
            bottomContentY += 8;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total: ${formatCurrency(totals.total)}`, totalsX, bottomContentY, { align: 'right' });

            const paymentInfo = paymentTerms === 'credito' ? `Crédito ${creditDays} días` : 'Contado';
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Condiciones de Pago:', margin, bottomContentY - 14);
            doc.setFont('helvetica', 'normal');
            doc.text(paymentInfo, margin, bottomContentY - 8);
            doc.setFont('helvetica', 'bold');
            doc.text('Notas:', margin, bottomContentY);
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(notes, 100);
            doc.text(splitNotes, margin, bottomContentY + 6);
            
            for (let i = 1; i <= doc.getNumberOfPages(); i++) {
                doc.setPage(i);
                addFooter(doc, i, doc.getNumberOfPages());
            }

            doc.save(`${currentQuoteNumber}.pdf`);
            toast({ title: "Cotización Generada", description: `El PDF de la cotización Nº ${currentQuoteNumber} ha sido descargado.` });
            logInfo(`Cotización generada: ${currentQuoteNumber}`, { customer: selectedCustomer?.name, total: totals.total });
            incrementAndSaveQuoteNumber();
        };

        if (companyData.logoUrl) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = companyData.logoUrl;
            img.onload = () => {
                doc.addImage(img, 'PNG', 14, 15, 50, 15);
                addHeaderAndContent();
            };
            img.onerror = () => {
                addHeaderAndContent();
            };
        } else {
            addHeaderAndContent();
        }

    } catch (e: any) {
        logError("Error generating PDF", { error: e.message });
        toast({ title: "Error al generar PDF", description: "No se pudo crear el documento.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
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
    setExchangeRate(apiExchangeRate); // Reset to the fetched API rate
    setSellerType("user");
    setPaymentTerms(initialQuoteState.paymentTerms);
    setCreditDays(initialQuoteState.creditDays);
    setValidUntilDate(new Date(new Date().setDate(new Date().getDate() + 8)).toISOString().substring(0, 10));
    setNotes(initialQuoteState.notes);
    setProductSearchTerm("");
    setCustomerSearchTerm("");
    setExemptionInfo(null);
    if (companyData) {
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
          lines: lines.map(({ displayQuantity, displayPrice, ...rest }) => rest), // Remove display values
          totals: totals,
          notes: notes,
          currency: currency,
          exchangeRate: exchangeRate,
          purchaseOrderNumber: purchaseOrderNumber,
          // Add missing fields from form state
          customerDetails: customerDetails,
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
    setLines(draft.lines.map((line: Omit<QuoteLine, 'displayQuantity' | 'displayPrice'>) => ({
      ...line,
      displayQuantity: String(line.quantity),
      displayPrice: String(line.price),
    })));
    if (draft.customerId) handleSelectCustomer(draft.customerId);
    else {
      setSelectedCustomer(null);
      setCustomerDetails(draft.customerDetails || "");
      setExemptionInfo(null);
    }
    setDeliveryAddress(draft.deliveryAddress || "");
    setDeliveryDate(draft.deliveryDate || "");
    setSellerName(draft.sellerName || "");
    setQuoteDate(draft.quoteDate || new Date().toISOString().substring(0, 10));
    setValidUntilDate(draft.validUntilDate || "");
    setPaymentTerms(draft.paymentTerms || "contado");
    setCreditDays(draft.creditDays || 0);
    setNotes(draft.notes);
    setPurchaseOrderNumber(draft.purchaseOrderNumber || "");
    setCurrency(draft.currency);
    setExchangeRate(draft.exchangeRate);
    toast({ title: "Borrador Cargado", description: `La cotización Nº ${draft.id} ha sido cargada.` });
  };

  const handleDeleteDraft = async (draftId: string) => {
    await deleteQuoteDraft(draftId);
    await logInfo(`Quote draft deleted: ${draftId}`);
    await loadDrafts(); // Refresh list
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

  const handleProductInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectors.productOptions.length > 0) { e.preventDefault(); handleSelectProduct(selectors.productOptions[0].value); }
  };

  const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectors.customerOptions.length > 0) { e.preventDefault(); handleSelectCustomer(selectors.customerOptions[0].value); }
  }


  // --- MEMOIZED SELECTORS ---
  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => acc + (line.quantity * line.price), 0);
    const totalTaxes = lines.reduce((acc, line) => acc + (line.quantity * line.price * line.tax), 0);
    const total = subtotal + totalTaxes;
    return { subtotal, totalTaxes, total };
  }, [lines, decimalPlaces]);

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
      setShowInactiveProducts, setSelectedLineForInfo, setDecimalPlaces,
      setProductSearchTerm, setCustomerSearchTerm, setProductSearchOpen, setCustomerSearchOpen,
      addLine, removeLine, updateLine, updateLineProductDetail, handleCurrencyToggle, formatCurrency,
      handleSelectCustomer, handleSelectProduct, incrementAndSaveQuoteNumber, handleSaveDecimalPlaces,
      generatePDF, resetQuote, saveDraft, loadDrafts, handleLoadDraft, handleDeleteDraft, handleNumericInputBlur,
      handleCustomerDetailsChange, loadInitialData, handleLineInputKeyDown, checkExemptionStatus, handleProductInputKeyDown,
    },
    refs: { productInputRef, customerInputRef, lineInputRefs },
    selectors: { totals, customerOptions, productOptions },
  };
};
