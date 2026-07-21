(function() {
    const globalStyle = document.createElement('style');
    globalStyle.id = 'sc-global-overlay-fix';
    globalStyle.innerHTML = `
        .branding-hydrator-overlay { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
    `;
    if (document.head) {
        document.head.appendChild(globalStyle);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            if (document.head) document.head.appendChild(globalStyle);
        });
    }
})();

const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzSTmI2W9J58MOC_fUEQad9_IZ0FlHRE2dklrY-YzAvS99_sF_nEjNMDUkl0pnq7G87/exec";

function getWebAppUrl() {
    return localStorage.getItem('googleSheetUrl') || DEFAULT_WEB_APP_URL;
}

function setWebAppUrl(url) {
    localStorage.setItem('googleSheetUrl', url);
}

// ─── User-facing notification (toast) ────────────────────────────────────────
function showNotification(message, type) {
    type = type || 'info';
    if (typeof window.__scShowToast === 'function') {
        window.__scShowToast(message, type);
        return;
    }
    const colors = {
        success: '#10B981',
        error:   '#EF4444',
        warning: '#F59E0B',
        info:    '#3B82F6'
    };
    const toast = document.createElement('div');
    toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:20px', 'z-index:99999',
        'background:' + (colors[type] || colors.info),
        'color:#fff', 'padding:12px 20px', 'border-radius:10px',
        'font-family:Roboto,Helvetica,Arial,sans-serif', 'font-size:14px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
        'max-width:340px', 'word-break:break-word',
        'line-height:1.4', 'cursor:pointer',
        'transition:opacity 0.4s ease',
        'opacity:1'
    ].join(';');
    toast.textContent = message;
    toast.onclick = function() {
        toast.style.opacity = '0';
        setTimeout(function() { if (toast.parentElement) toast.parentElement.removeChild(toast); }, 400);
    };
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() { if (toast.parentElement) toast.parentElement.removeChild(toast); }, 400);
    }, 6000);
}

// ─── Read cart items from Redux-persist localStorage ──────────────────────────
function getCartItemsFromRedux() {
    try {
        if (window.__store) {
            const state = window.__store.getState();
            if (state && state.cartData && Array.isArray(state.cartData.cartItems) && state.cartData.cartItems.length > 0) {
                return state.cartData.cartItems;
            }
        }

        const possibleKeys = ['persist:root', 'persist:cartData', 'persist:cart'];
        let cartItems = [];

        for (const key of possibleKeys) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);

            if (parsed.cartData) {
                const cartData = typeof parsed.cartData === 'string'
                    ? JSON.parse(parsed.cartData)
                    : parsed.cartData;
                if (cartData.cartItems && cartData.cartItems.length > 0) {
                    cartItems = cartData.cartItems;
                    break;
                }
            }

            if (parsed.cartItems && parsed.cartItems.length > 0) {
                cartItems = parsed.cartItems;
                break;
            }
        }

        if (cartItems.length === 0) {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith('persist:')) continue;
                try {
                    const val = JSON.parse(localStorage.getItem(k));
                    if (val && val.cartItems && Array.isArray(val.cartItems) && val.cartItems.length > 0) {
                        cartItems = val.cartItems;
                        break;
                    }
                    for (const subKey of Object.keys(val)) {
                        try {
                            const sub = typeof val[subKey] === 'string' ? JSON.parse(val[subKey]) : val[subKey];
                            if (sub && sub.cartItems && Array.isArray(sub.cartItems) && sub.cartItems.length > 0) {
                                cartItems = sub.cartItems;
                                break;
                            }
                        } catch (e) {}
                    }
                    if (cartItems.length > 0) break;
                } catch (e) {}
            }
        }

        return cartItems;
    } catch (e) {
        console.error('[CartSync] Failed to read Redux state from localStorage:', e);
        return [];
    }
}

// ─── Format price in INR ─────────────────────────────────────────────────────
function formatPrice(num) {
    if (typeof num !== 'number' || isNaN(num)) return '₹ 0.00';
    return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Extract human-readable details string from cart item / design ───────────
function extractProductDetails(itemData) {
    if (!itemData) return 'Custom Switch Panel';
    const detailParts = [];
    if (itemData.panel && itemData.panel.item) detailParts.push(`Panel: ${itemData.panel.item}`);
    if (itemData.material && itemData.material.item) detailParts.push(`Material: ${itemData.material.item}`);
    if (itemData.size && itemData.size.item) detailParts.push(`Size: ${itemData.size.item}`);
    if (itemData.technology && itemData.technology.item) detailParts.push(`Tech: ${itemData.technology.item}`);
    if (itemData.color && itemData.color.length > 0) {
        const colors = itemData.color.flatMap(c => (c.options || []).map(o => o.item)).filter(Boolean).join(', ');
        if (colors) detailParts.push(`Colors: ${colors}`);
    }
    const accessories = [...(itemData.accessories || []), ...(itemData.accessories1 || []), ...(itemData.accessories2 || []), ...(itemData.accessories3 || [])]
        .flatMap(a => (a.options || []).map(o => o.item))
        .filter(Boolean)
        .join(', ');
    if (accessories) detailParts.push(`Accessories: ${accessories}`);
    
    return detailParts.join(' | ') || 'Custom Panel';
}

// ─── Capture Image Preview Data URL from page DOM or item screenshot ────────
function getImagePreviewDataUrl(itemData) {
    if (itemData && itemData.screenshotDataUrl && typeof itemData.screenshotDataUrl === 'string' && itemData.screenshotDataUrl.startsWith('data:image')) {
        return itemData.screenshotDataUrl;
    }
    try {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return canvas.toDataURL('image/png');
        }
    } catch (e) {}
    try {
        const img = document.querySelector('img[alt*="preview"], img[alt*="Panel"], .panel-preview img');
        if (img && img.src) return img.src;
    } catch (e) {}
    return '';
}

// ─── Helper to escape PDF string characters ──────────────────────────────────
function escapePdfText(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ─── Generate PDF Data URI for the Design Flow ────────────────────────────────
function generateFlowPdfDataUrl(customName, details, orderId, priceStr, dateStr) {
    try {
        const textLines = [
            'SmartiQo Custom Panel Order Flow Summary',
            'Order ID: ' + orderId,
            'Date: ' + dateStr,
            'Product Name: ' + customName,
            'Price: ' + priceStr,
            'Flow Details: ' + details
        ];
        
        let streamContent = 'BT\n/F1 16 Tf\n50 750 Td\n(' + escapePdfText(textLines[0]) + ') Tj\n/F1 11 Tf\n';
        let yOffset = -25;
        for (let i = 1; i < textLines.length; i++) {
            streamContent += '0 ' + yOffset + ' Td\n(' + escapePdfText(textLines[i]) + ') Tj\n';
            yOffset = -18;
        }
        streamContent += 'ET';

        const pdfDoc = '%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj\n4 0 obj <</Length ' + streamContent.length + '>> stream\n' + streamContent + '\nendstream\nendobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000246 00000 n\n0000000300 00000 n\ntrailer <</Size 6 /Root 1 0 R>>\nstartxref\n400\n%%EOF';

        const b64 = typeof btoa === 'function' 
            ? btoa(unescape(encodeURIComponent(pdfDoc))) 
            : Buffer.from(pdfDoc, 'utf-8').toString('base64');

        return 'data:application/pdf;base64,' + b64;
    } catch (e) {
        console.warn('[CartSync] PDF generation warning:', e);
        return '';
    }
}

// ─── Build full item payload with all My Cart details ────────────────────────
function buildFullItemPayload(item, orderId, isOrderConfirmation) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const totalPrice = Number(item.totalPrice) || 0;
    const priceStr = formatPrice(totalPrice);
    const unitPriceStr = formatPrice(totalPrice / qty);

    const droppedArr = Array.isArray(item.dropped) ? item.dropped : [];
    const droppedCount = droppedArr.length;
    const savings = droppedCount * 100 * qty;

    const productId = (item.productSequence || '').trim() || item.id || ('PROD-' + Math.floor(1000 + Math.random() * 9000));
    const orderName = (item.orderName || '').trim() || 'Untitled Order';
    const customName = (item.customProductName || '').trim() || orderName;

    const cartData = item.cartData || {};
    const panelType = cartData.panel?.item || '';
    const materialType = cartData.material?.item || '';
    const sizeModule = cartData.size?.item || '';
    const techType = cartData.technology?.item || '';

    // Separate Colors
    let glassColor = '', frameColor = '', buttonColor = '';
    const colorParts = [];
    if (Array.isArray(cartData.color)) {
        cartData.color.forEach(c => {
            const optType = (c.optionType || '').toLowerCase();
            const itemsList = (c.options || []).map(o => o.item).join(', ');
            if (itemsList) {
                colorParts.push(`${c.optionType}: ${itemsList}`);
                if (optType.includes('glass') || optType.includes('panel') || optType.includes('face')) glassColor = itemsList;
                else if (optType.includes('border') || optType.includes('frame') || optType.includes('edge')) frameColor = itemsList;
                else if (optType.includes('button') || optType.includes('icon') || optType.includes('touch')) buttonColor = itemsList;
                else if (!glassColor) glassColor = itemsList;
            }
        });
    }
    const colorsStr = colorParts.join(' | ');

    // Accessories & Icons
    const accessoriesList = [...(cartData.accessories || []), ...(cartData.accessories1 || []), ...(cartData.accessories2 || []), ...(cartData.accessories3 || [])]
        .flatMap(a => (a.options || []).map(o => o.item))
        .filter(Boolean)
        .join(', ');

    const iconNamesList = droppedArr.map(ic => ic.title || ic.name || ic.id || 'Icon').filter(Boolean).join(', ');

    const detailsSummary = extractProductDetails(cartData);
    const panelName = `${customName} (${detailsSummary})`;

    const imgPreview = getImagePreviewDataUrl(item);
    const dateStr = item.createdAt || new Date().toISOString();
    const flowPdfData = generateFlowPdfDataUrl(customName, detailsSummary, orderId, priceStr, dateStr);

    return {
        // My Cart View Columns
        orderId: orderId,
        cartId: orderId,
        productId: productId,
        productSequence: productId,
        orderName: orderName,
        customName: customName,
        itemName: customName,
        panelName: panelName,

        // Media & Specs
        imagePreview: imgPreview,
        preview: imgPreview || detailsSummary,
        flowPdf: flowPdfData,
        pdf: flowPdfData,
        pdfUrl: flowPdfData,

        // Quantities & Prices
        qty: String(qty),
        quantity: String(qty),
        unitPrice: unitPriceStr,
        price: totalPrice,
        priceFormatted: priceStr,
        totalPrice: priceStr,
        savings: savings > 0 ? formatPrice(savings) : '₹ 0.00',
        status: isOrderConfirmation ? 'Confirmed' : 'In Cart',

        // Steps 1 to 8 Specification Columns
        panel: panelType,
        panelType: panelType,
        material: materialType,
        materialType: materialType,
        size: sizeModule,
        sizeModule: sizeModule,
        technology: techType,
        techType: techType,

        glassColor: glassColor,
        frameColor: frameColor,
        buttonColor: buttonColor,
        colors: colorsStr,

        accessories: accessoriesList,
        iconsCount: String(droppedCount),
        iconNames: iconNamesList,
        dropped: droppedArr,

        date: dateStr,
        cartData: cartData
    };
}

// ─── Send a SINGLE object payload to Google Apps Script ───────────────────────
function sendSinglePayloadToGAS(payloadObj) {
    const url = getWebAppUrl();
    console.log('[CartSync] Permanently saving order to file storage & Google Sheets:', payloadObj.orderId);
    // Post to permanent user file storage endpoint (/api/user-orders)
    fetch('/api/user-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadObj)
    }).catch(function(e) {});

    try {
        const localOrders = JSON.parse(localStorage.getItem('sc_local_orders') || '[]');
        localOrders.push({ timestamp: new Date().toISOString(), payload: payloadObj });
        localStorage.setItem('sc_local_orders', JSON.stringify(localOrders));
    } catch (e) {
        console.warn('[CartSync] Could not save local backup:', e);
    }

    // 1. Post to local server relay (/api/sheet-sync) which saves to orders-data/ AND forwards to GAS
    const localRelayPromise = fetch('/api/sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payloadObj, webAppUrl: url })
    }).then(r => r.json()).catch(e => {
        console.warn('[CartSync] Local relay warning:', e);
        return { success: false };
    });

    // 2. Direct fetch to Google Apps Script as well (if URL valid)
    if (url && url.startsWith('http')) {
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payloadObj)
        }).catch(err => {
            console.warn('[CartSync] Direct GAS fetch warning:', err);
        });
    }

    return localRelayPromise.then(res => {
        console.log('[CartSync] Order saved & synced successfully!');
        return { success: true, payload: payloadObj, relay: res };
    });
}

// ─── Main sync function for entire cart (Submit / Confirm / Place Order) ──────
function syncCartToGoogleSheet(isOrderConfirmation = false) {
    const cartItems = getCartItemsFromRedux();
    
    console.log('[CartSync] Found cart items:', cartItems.length);

    if (cartItems.length === 0) {
        console.warn('[CartSync] No cart items found in Redux state.');
        return Promise.resolve({ empty: true });
    }

    const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);

    const promises = cartItems.map(item => {
        const singlePayload = buildFullItemPayload(item, orderId, isOrderConfirmation);
        return sendSinglePayloadToGAS(singlePayload);
    });

    return Promise.all(promises).then(results => {
        const hasError = results.some(r => r && r.error);
        if (hasError) {
            return { error: true, message: 'One or more items failed to sync to Google Sheets.' };
        }
        return { success: true, count: results.length };
    });
}

// ─── Read current customizer state from Redux-persist localStorage ───────────
function getCurrentDesignFromRedux() {
    try {
        if (window.__store) {
            const state = window.__store.getState();
            if (state && state.cartData && state.cartData.cartData && state.cartData.cartData.panel) {
                return {
                    cartData: state.cartData.cartData,
                    quantity: state.cartData.quantity || 1,
                    totalPrice: state.cartData.totalPrice || 0,
                    droppedItems: state.cartData.droppedItems || []
                };
            }
        }

        const possibleKeys = ['persist:root', 'persist:cartData', 'persist:cart'];
        for (const key of possibleKeys) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            
            let cartData = null;
            if (parsed.cartData) {
                cartData = typeof parsed.cartData === 'string'
                    ? JSON.parse(parsed.cartData)
                    : parsed.cartData;
            } else if (parsed.panel) {
                cartData = parsed;
            }

            if (cartData && cartData.panel) {
                let quantity = parsed.quantity || 1;
                if (typeof quantity === 'string') quantity = parseInt(quantity, 10);
                
                let totalPrice = parsed.totalPrice || 0;
                if (typeof totalPrice === 'string') totalPrice = parseFloat(totalPrice);
                
                let droppedItems = parsed.droppedItems || [];
                if (typeof droppedItems === 'string') droppedItems = JSON.parse(droppedItems);
                
                return {
                    cartData,
                    quantity,
                    totalPrice,
                    droppedItems
                };
            }
        }
        
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('persist:')) continue;
            try {
                const val = JSON.parse(localStorage.getItem(k));
                if (val && val.cartData) {
                    const cartData = typeof val.cartData === 'string' ? JSON.parse(val.cartData) : val.cartData;
                    if (cartData && cartData.panel) {
                        let quantity = val.quantity || 1;
                        let totalPrice = val.totalPrice || 0;
                        let droppedItems = val.droppedItems || [];
                        if (typeof quantity === 'string') quantity = parseInt(quantity, 10);
                        if (typeof totalPrice === 'string') totalPrice = parseFloat(totalPrice);
                        if (typeof droppedItems === 'string') droppedItems = JSON.parse(droppedItems);
                        return { cartData, quantity, totalPrice, droppedItems };
                    }
                }
            } catch(e) {}
        }
        return null;
    } catch (e) {
        console.error('[CartSync] Failed to read current design from Redux:', e);
        return null;
    }
}

// ─── Sync single item or handle Update Item ───────────────────────────────────
function syncSingleItemToGoogleSheet(design) {
    if (!design || !design.cartData) {
        console.warn('[CartSync] No active design found to sync.');
        return Promise.resolve({ empty: true });
    }

    const editingId = localStorage.getItem('sc_editing_item_id');
    const isEditing = !!editingId;

    // If item is currently being edited, update existing item in Redux!
    if (isEditing && window.__store) {
        try {
            const state = window.__store.getState();
            const cartItems = (state.cartData && state.cartData.cartItems) ? state.cartData.cartItems : [];
            const idx = cartItems.findIndex(i => i.id === editingId || i.productSequence === editingId);
            
            if (idx !== -1) {
                const updatedItems = [...cartItems];
                updatedItems[idx] = {
                    ...updatedItems[idx],
                    cartData: design.cartData,
                    dropped: design.droppedItems || [],
                    quantity: design.quantity || 1,
                    totalPrice: design.totalPrice || 0,
                    screenshotDataUrl: getImagePreviewDataUrl(design),
                    updatedAt: new Date().toISOString()
                };
                window.__store.dispatch({ type: 'cartData/setCartItems', payload: { items: updatedItems } });
                console.log('[CartSync] Updated existing cart item in Redux:', editingId);
            }
        } catch(e) {
            console.warn('[CartSync] Failed to dispatch Redux update for item:', e);
        }
    }

    const orderId = isEditing ? ("UPD-" + editingId.substring(0, 8)) : ("ADD-" + Math.floor(100000 + Math.random() * 900000));
    const item = {
        id: editingId || '',
        cartData: design.cartData,
        quantity: design.quantity || 1,
        totalPrice: design.totalPrice || 0,
        dropped: design.droppedItems || [],
        createdAt: new Date().toISOString()
    };

    const singlePayload = buildFullItemPayload(item, orderId, false);
    singlePayload.status = isEditing ? 'Updated' : 'Add to Cart';

    // Clear editing flag after sync
    if (isEditing) {
        localStorage.removeItem('sc_editing_item_id');
    }

    return sendSinglePayloadToGAS(singlePayload);
}

// ─── Log error to local server ──────────────────────────────────────────────
function logErrorToServer(message, payload, error) {
    const errorBody = {
        message: message,
        payload: payload,
        details: error && error.stack ? error.stack : String(error)
    };

    fetch('/api/logs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorBody)
    }).catch(function() {});
}

// ─── Trigger sync on Add to Cart / Update Item ───────────────────────────────
function triggerAddToCartSync() {
    const isEditing = !!localStorage.getItem('sc_editing_item_id');
    console.log('[CartSync] Triggering ' + (isEditing ? 'Update Item' : 'Add to Cart') + ' Google Sheets sync...');
    
    setTimeout(() => {
        const currentDesign = getCurrentDesignFromRedux();
        if (!currentDesign) {
            console.warn('[CartSync] Could not fetch current design to sync.');
            showNotification(isEditing ? '✅ Item updated!' : '✅ Item added to cart!', 'success');
            if (isEditing) {
                setTimeout(() => { window.location.href = '/orders?tab=cart'; }, 1000);
            }
            return;
        }
        
        syncSingleItemToGoogleSheet(currentDesign)
            .then(res => {
                if (res && res.success) {
                    console.log('[CartSync] Successfully saved row to Google Sheets!');
                    showNotification(isEditing ? '✅ Item updated in cart & Google Sheet!' : '✅ Item added to cart & saved to Google Sheet!', 'success');
                } else {
                    showNotification(isEditing ? '⚠️ Item updated in cart (saved locally).' : '⚠️ Item added to cart (saved locally).', 'warning');
                }
            })
            .catch(err => {
                console.error('[CartSync] Error syncing single item:', err);
                showNotification(isEditing ? '✅ Item updated in cart!' : '✅ Item added to cart!', 'success');
            })
            .finally(() => {
                if (isEditing) {
                    localStorage.removeItem('sc_editing_item_id');
                    localStorage.removeItem('sc_editing_item_data');
                    setTimeout(() => { window.location.href = '/orders?tab=cart'; }, 1200);
                }
            });
    }, 400);
}

// ─── Trigger sync on Confirm Order / Place Order / Checkout ───────────────────
function triggerConfirmOrderSync() {
    console.log('[CartSync] Triggering Confirm Order Google Sheets sync...');
    setTimeout(() => {
        syncCartToGoogleSheet(true)
            .then(res => {
                if (res && res.empty) {
                    showNotification('⚠️ No cart items found to sync!', 'warning');
                } else if (res && res.error) {
                    showNotification('⚠️ Order saved locally.', 'warning');
                } else {
                    showNotification('✅ All cart items saved to Google Sheet!', 'success');
                }
            })
            .catch(err => {
                console.error('[CartSync] Error syncing order:', err);
            });
    }, 400);
}

// ─── Dynamic Button Label updater & State Restorer for Edit Mode ──────────────
function restoreEditingItemOnDashboardLoad() {
    const isEditing = !!localStorage.getItem('sc_editing_item_id');
    if (!isEditing) return;

    const rawItemData = localStorage.getItem('sc_editing_item_data');
    if (rawItemData && window.__store) {
        try {
            const item = JSON.parse(rawItemData);
            if (item && item.cartData) {
                window.__store.dispatch({
                    type: 'cartData/setCartFromOrder',
                    payload: {
                        cart: item.cartData,
                        dropped: item.dropped || []
                    }
                });
                if (item.quantity) {
                    window.__store.dispatch({
                        type: 'cartData/increaseQuantity',
                        payload: { qty: item.quantity }
                    });
                }
                console.log('[CartSync] Restored editing item into Redux store on load:', item);
            }
        } catch(e) {
            console.warn('[CartSync] Error restoring editing item on load:', e);
        }
    }

    const buttons = Array.from(document.querySelectorAll('button'));
    const addToCartBtn = buttons.find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t === 'add to cart' || t === 'add to quote' || t.includes('update item');
    });

    if (addToCartBtn && !addToCartBtn.textContent.includes('Update Item')) {
        addToCartBtn.textContent = '🔄 Update Item';
        addToCartBtn.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
        addToCartBtn.style.color = '#ffffff';
    }
}

function updateButtonLabelForEditMode() {
    restoreEditingItemOnDashboardLoad();
}

// ─── Global Event Listener for Cart Actions & Edit Item ───────────────────────
document.addEventListener('click', function(e) {
    try {
        const target = e.target;
        if (!target) return;

        const btn = target.closest ? target.closest('button, [role="button"], a, input[type="submit"]') : null;
        if (!btn) return;

        const text = (btn.textContent || btn.value || '').trim().toLowerCase();

        // 1. Detect clicking "Edit Item" on a row in My Cart
        if (text.includes('edit item') || text === 'edit' || btn.getAttribute('aria-label') === 'edit item' || btn.querySelector('svg[data-testid="EditIcon"]')) {
            console.log('[CartSync] Edit Item (Pencil Icon) clicked, processing design restoration into Configurator Wizard...');
            const row = btn.closest('tr');
            let matchedItem = null;

            if (window.__store) {
                try {
                    const state = window.__store.getState();
                    const cartItems = (state.cartData && state.cartData.cartItems) ? state.cartData.cartItems : [];

                    if (row) {
                        const allRows = Array.from(row.parentElement.children);
                        const rowIndex = allRows.indexOf(row);
                        const rowText = row.textContent || '';

                        matchedItem = cartItems.find(item => {
                            const seq = (item.productSequence || '').trim();
                            const id = (item.id || '').trim();
                            const name = (item.customProductName || item.orderName || '').trim();
                            return (seq && rowText.includes(seq)) || (id && rowText.includes(id)) || (name && rowText.includes(name));
                        }) || cartItems[rowIndex] || cartItems[0];
                    }

                    if (!matchedItem && cartItems.length > 0) {
                        matchedItem = cartItems[0];
                    }

                    if (matchedItem) {
                        console.log('[CartSync] Loading item into Configurator Wizard state:', matchedItem);
                        const editId = matchedItem.id || matchedItem.productSequence || 'ITEM-EDIT';
                        localStorage.setItem('sc_editing_item_id', editId);
                        localStorage.setItem('sc_editing_item_data', JSON.stringify(matchedItem));

                        // Hydrate Redux state for Step 1 to 8 Wizard
                        if (matchedItem.cartData) {
                            window.__store.dispatch({
                                type: 'cartData/setCartFromOrder',
                                payload: {
                                    cart: matchedItem.cartData,
                                    dropped: matchedItem.dropped || matchedItem.droppedItems || []
                                }
                            });
                        }
                        if (matchedItem.quantity) {
                            window.__store.dispatch({
                                type: 'cartData/increaseQuantity',
                                payload: { qty: matchedItem.quantity }
                            });
                        }
                        // Reset Wizard to Step 1 (Panel)
                        window.__store.dispatch({
                            type: 'cartData/setActiveStep',
                            payload: 0
                        });

                        showNotification('✏️ Resuming configuration wizard...', 'info');

                        setTimeout(() => {
                            window.location.href = '/Dashboards/userDashboard?edit=' + encodeURIComponent(editId);
                        }, 300);
                        return;
                    }
                } catch (err) {
                    console.error('[CartSync] Error loading item for edit:', err);
                }
            }

            if (row) {
                const idCell = row.querySelector('td:nth-child(2)') || row.querySelector('td');
                if (idCell) {
                    const itemId = idCell.textContent.trim();
                    localStorage.setItem('sc_editing_item_id', itemId);
                    window.location.href = '/Dashboards/userDashboard?edit=' + encodeURIComponent(itemId);
                }
            }
        }
        // 2. Add to Cart / Update Item
        else if (text === 'add to cart' || text === 'add to quote' || text.includes('update item') || text.includes('add to cart')) {
            triggerAddToCartSync();
        } 
        // 3. Order Placement / Checkout / Confirmation in My Cart
        else if (
            text.includes('confirm order') || 
            text.includes('place order') || 
            text.includes('submit order') || 
            text.includes('checkout') || 
            text.includes('place selected') ||
            text.includes('batch order')
        ) {
            triggerConfirmOrderSync();
        }
    } catch(e) {
        console.warn('[CartSync] Event listener warning:', e);
    }
}, false);

// ─── Inject Sync Cart button next to Confirm Order ───────────────────────────
function checkAndInjectSyncButton() {
    const isCartPage = window.location.href.toLowerCase().includes('orders')
        || window.location.href.toLowerCase().includes('cart')
        || window.location.href.toLowerCase().includes('dashboard');

    if (!isCartPage) return;

    updateButtonLabelForEditMode();

    if (document.getElementById('custom-sync-btn')) return;

    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t.includes('confirm order') || t.includes('place order') || t.includes('checkout');
    });

    if (!confirmBtn) return;

    const syncBtn = document.createElement('button');
    syncBtn.id = 'custom-sync-btn';
    syncBtn.style.cssText = `
        margin-left: 10px;
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 18px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(16,185,129,0.4);
        transition: opacity 0.2s;
    `;
    syncBtn.textContent = '📤 Sync to Google Sheet';

    syncBtn.addEventListener('click', () => {
        const originalText = syncBtn.textContent;
        syncBtn.textContent = '⏳ Syncing...';
        syncBtn.disabled = true;

        syncCartToGoogleSheet(false)
            .then(res => {
                if (res && res.empty) {
                    showNotification('⚠️ No cart items found! Please add items to cart before syncing.', 'warning');
                } else if (res && res.error) {
                    showNotification('⚠️ Cart data saved locally. Google Sheets connection failed.', 'warning');
                } else {
                    showNotification('✅ Cart data synced to Google Sheet!', 'success');
                    const container = document.getElementById('custom-orders-view');
                    if (container) {
                        container.remove();
                        setTimeout(checkAndInjectOrdersView, 500);
                    }
                }
            })
            .catch(err => {
                console.error('[CartSync] Sync failed:', err);
                showNotification('❌ Sync failed: ' + err.message + '. Check console for details.', 'error');
            })
            .finally(() => {
                syncBtn.textContent = originalText;
                syncBtn.disabled = false;
            });
    });

    confirmBtn.parentNode.insertBefore(syncBtn, confirmBtn.nextSibling);
    console.log('[CartSync] Sync button injected.');
}

// ─── Profile page: Google Sheet URL configurator ─────────────────────────────
function checkAndInjectProfileInput() {
    if (!window.location.href.toLowerCase().includes('profile')) return;
    if (document.getElementById('custom-sheet-url-container')) return;

    const container = document.createElement('div');
    container.id = 'custom-sheet-url-container';
    container.style.cssText = `
        padding: 20px; margin: 20px auto; max-width: 800px;
        background: #f5f8fa; border: 1px solid #cce5ff; border-radius: 8px;
    `;
    container.innerHTML = `
        <h3 style="margin-top:0;color:#004085;">Google Sheet Database Setup</h3>
        <p style="color:#383d41;">Enter your Google Apps Script Web App URL to sync cart data.</p>
        <input type="text" id="custom-sheet-url-input" value="${getWebAppUrl()}"
            style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;border:1px solid #ced4da;border-radius:4px;">
        <button id="custom-sheet-url-save"
            style="padding:10px 20px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">
            Save URL
        </button>
    `;

    const main = document.querySelector('main') || document.body;
    main.insertBefore(container, main.firstChild);

    document.getElementById('custom-sheet-url-save').addEventListener('click', () => {
        const val = document.getElementById('custom-sheet-url-input').value.trim();
        if (val) {
            setWebAppUrl(val);
            alert('✅ URL Saved!');
        }
    });
}

// ─── Orders/Cart page: Show synced rows from Google Sheet ────────────────────
function getGoogleSheetDocUrl() {
    return localStorage.getItem('googleSheetDocUrl') || 'https://docs.google.com/spreadsheets/d/1pQ85rMRXLC-06FhKCdt7Q4o5EHLos2ZxL7XvhCCfGjY/edit?pli=1&gid=692857449#gid=692857449';
}

function extractRowField(row, possibleKeys) {
    if (!row || typeof row !== 'object') return '';
    for (var i = 0; i < possibleKeys.length; i++) {
        var k = possibleKeys[i];
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
        }
    }
    // Case-insensitive key match
    var rowKeys = Object.keys(row);
    for (var j = 0; j < possibleKeys.length; j++) {
        var pk = possibleKeys[j].toLowerCase();
        for (var m = 0; m < rowKeys.length; m++) {
            if (rowKeys[m].toLowerCase() === pk && row[rowKeys[m]] !== undefined && row[rowKeys[m]] !== null && String(row[rowKeys[m]]).trim() !== '') {
                return String(row[rowKeys[m]]).trim();
            }
        }
    }
    return '';
}

function checkAndInjectOrdersView() {
    const isTargetPage = window.location.href.toLowerCase().includes('orders')
        || window.location.href.toLowerCase().includes('cart');

    if (!isTargetPage) return;
    if (document.getElementById('custom-orders-view')) return;

    // Get current logged-in user email
    let currentUserEmail = (typeof getUserId === 'function' ? getUserId() : '').trim().toLowerCase();
    if (!currentUserEmail && window.__store) {
        try {
            const state = window.__store.getState();
            currentUserEmail = (state.loginSignUpSlice?.userEmail || state.user?.email || '').trim().toLowerCase();
        } catch(e) {}
    }

    const container = document.createElement('div');
    container.id = 'custom-orders-view';
    container.style.cssText = `
        padding: 24px; margin: 24px auto; max-width: 1200px;
        background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.07); border-radius: 16px;
        border: 1px solid rgba(25, 118, 210, 0.12); font-family: 'Inter', sans-serif;
    `;
    container.innerHTML = `<p style="color:#6B7280;font-size:14px;margin:0;">⏳ Fetching orders for ${currentUserEmail || 'your account'}...</p>`;

    const targetParent = document.querySelector('main') || document.querySelector('.MuiContainer-root') || document.body;
    if (targetParent.firstChild) {
        targetParent.insertBefore(container, targetParent.firstChild);
    } else {
        targetParent.appendChild(container);
    }

    // Construct URL for GAS with email filter
    let gasUrl = getWebAppUrl();
    if (currentUserEmail && gasUrl && gasUrl.startsWith('http')) {
        const sep = gasUrl.includes('?') ? '&' : '?';
        gasUrl = gasUrl + sep + 'action=getOrders&email=' + encodeURIComponent(currentUserEmail);
    }

    // Fetch from Google Apps Script and local user storage
    Promise.allSettled([
        fetch(gasUrl).then(r => r.json()),
        fetch('/api/user-orders').then(r => r.json().then(d => d.orders || d)),
        fetch('/api/orders-data').then(r => r.json())
    ]).then(results => {
        let gasRows = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
        let userFileRows = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
        let allLocalRows = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];

        // Combine all rows
        let combinedMap = {};
        userFileRows.forEach((r, i) => {
            let key = extractRowField(r, ['Cart / Order ID', 'Order ID', 'orderId', 'id']) || ('uf_' + i);
            combinedMap[key] = r;
        });
        gasRows.forEach((r, i) => {
            let key = extractRowField(r, ['Cart / Order ID', 'Order ID', 'orderId', 'id']) || ('gas_' + i);
            if (!combinedMap[key]) combinedMap[key] = r;
        });
        allLocalRows.forEach((r, i) => {
            let key = extractRowField(r, ['Cart / Order ID', 'Order ID', 'orderId', 'id']) || ('loc_' + i);
            if (!combinedMap[key]) combinedMap[key] = r;
        });

        let rawRows = Object.values(combinedMap);

        // Map and extract fields across all column naming conventions
        let validRows = rawRows.map((row, index) => {
            const orderId   = extractRowField(row, ['Cart / Order ID', 'Order ID', 'orderId', 'order_id', 'id', 'Cart ID']) || ('ORD-' + (1000 + index));
            const prodId    = extractRowField(row, ['Product ID', 'productId', 'productSequence', 'prodId']) || '—';
            const name      = extractRowField(row, ['Custom Product Name', 'Product / Order Name', 'Panel Name', 'customName', 'orderName', 'itemName', 'panelName', 'Name', 'Item']) || 'Custom Switch Panel';
            const userEmail = extractRowField(row, ['User Email', 'userEmail', 'email', 'User_Email', 'user_email']);

            let rawPrice = extractRowField(row, ['Total Price (₹)', 'Total Price', 'Price', 'unitPrice', 'priceFormatted', 'price', 'Amount', 'Cost']);
            let priceVal = '₹ 0.00';
            if (rawPrice) {
                if (rawPrice.includes('₹')) {
                    priceVal = rawPrice;
                } else {
                    const num = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
                    priceVal = (!isNaN(num) && num > 0) ? formatPrice(num) : (rawPrice || '₹ 0.00');
                }
            }

            const date = extractRowField(row, ['Date', 'date', 'Time', 'time', 'timestamp', 'Timestamp', 'Created At']) || '—';
            const status = extractRowField(row, ['Step 8: Cart Status', 'Status', 'status']) || 'Synced';

            return { orderId, prodId, name, priceVal, date, status, userEmail };
        }).filter(r => r.name || r.orderId);

        // STRICT USER FILTERING: Show ONLY orders belonging to the logged-in user!
        if (currentUserEmail) {
            validRows = validRows.filter(r => {
                const rowEmail = (r.userEmail || '').trim().toLowerCase();
                return !rowEmail || rowEmail === currentUserEmail;
            });
        } else {
            validRows = [];
        }

        // TOP 5 RECORDS ONLY
        const top5 = validRows.slice(0, 5);

        let html = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
                <h3 style="color:#10B981;margin:0;font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;">
                    <span>✅</span> Synced Google Sheet Orders ${currentUserEmail ? ('(' + currentUserEmail + ')') : ''}
                </h3>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:#6B7280;background:#F3F4F6;padding:4px 12px;border-radius:9999px;font-weight:600;">
                        Showing ${top5.length} of ${validRows.length} Records
                    </span>
                    <button onclick="window.open(getGoogleSheetDocUrl(), '_blank')" style="display:inline-flex;align-items:center;gap:6px;background:#10B981;color:#ffffff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:background 0.2s;" onmouseenter="this.style.background='#059669'" onmouseleave="this.style.background='#10B981'">
                        <span>View All in Google Sheet ↗</span>
                    </button>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB;">
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Order ID</th>
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Product ID</th>
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Custom Name</th>
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Price</th>
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Date</th>
                            <th style="padding:10px 14px;font-weight:600;color:#374151;text-align:left;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (top5.length === 0) {
            html += `<tr><td colspan="6" style="padding:24px;text-align:center;color:#9CA3AF;">No synced orders found for ${currentUserEmail || 'this account'}. Add items to cart to see data here.</td></tr>`;
        } else {
            top5.forEach(item => {
                html += `
                    <tr style="border-bottom:1px solid #F3F4F6;transition:background 0.15s;" onmouseenter="this.style.background='#F9FAFB'" onmouseleave="this.style.background='transparent'">
                        <td style="padding:10px 14px;font-weight:600;color:#1976D2;">${item.orderId}</td>
                        <td style="padding:10px 14px;color:#4B5563;font-weight:500;">${item.prodId}</td>
                        <td style="padding:10px 14px;color:#111827;font-weight:500;">${item.name}</td>
                        <td style="padding:10px 14px;font-weight:700;color:#059669;">${item.priceVal}</td>
                        <td style="padding:10px 14px;color:#6B7280;">${item.date}</td>
                        <td style="padding:10px 14px;">
                            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;background:${item.status.includes('Confirmed') ? '#DEF7EC' : '#E0F2FE'};color:${item.status.includes('Confirmed') ? '#03543F' : '#0369A1'};">
                                ${item.status}
                            </span>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
            ${validRows.length > 5 ? `
                <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #F3F4F6;">
                    <button onclick="window.open(getGoogleSheetDocUrl(), '_blank')" style="background:transparent;color:#10B981;border:1px solid #10B981;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background='#10B981';this.style.color='#ffffff';" onmouseleave="this.style.background='transparent';this.style.color='#10B981';">
                        View All ${validRows.length} Records in Google Sheet ↗
                    </button>
                </div>
            ` : ''}
        `;

        container.innerHTML = html;
    }).catch(err => {
        console.warn('[CartSync] Orders view load error:', err);
        container.innerHTML = `<p style="color:#EF4444;font-size:13px;margin:0;">⚠️ Could not load synced data. Check network or server connection.</p>`;
    });
}
// ─── SPA Observer: re-run checks on route/DOM changes ────────────────────────
let _lastHref = '';
const observer = new MutationObserver(() => {
    if (window.location.href !== _lastHref) {
        _lastHref = window.location.href;
        ['custom-sync-btn', 'custom-orders-view', 'custom-sheet-url-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }
    checkAndInjectSyncButton();
    checkAndInjectProfileInput();
    checkAndInjectOrdersView();
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

window.addEventListener('load', () => {
    _lastHref = window.location.href;
    checkAndInjectSyncButton();
    checkAndInjectProfileInput();
    checkAndInjectOrdersView();
});

// Expose for manual debugging in browser console
window.__cartSync = {
    syncNow: () => syncCartToGoogleSheet(false),
    getItems: () => getCartItemsFromRedux(),
    getUrl: getWebAppUrl,
    setUrl: setWebAppUrl,
};
console.log('[CartSync] Loaded with Edit Item tracking & Update Item sync. Ready.');

// ─── Header Cart Badge Updater ───────────────────────────────────────────────
function updateHeaderCartBadge() {
    try {
        const items = getCartItemsFromRedux();
        const count = items ? items.length : 0;
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => {
            if (count > 0) {
                b.textContent = count;
                b.style.display = 'flex';
            } else {
                b.style.display = 'none';
            }
        });
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', updateHeaderCartBadge);
setInterval(updateHeaderCartBadge, 1000);


// ─── Server-side Cart Persistence (survives cache clears, per-user) ──────────
(function() {
    'use strict';

    var CART_API = '/api/cart';
    var SYNC_DEBOUNCE_MS = 1500;
    var syncTimer = null;
    var lastSavedHash = null;
    var isLoading = false;

    function getUserId() {
        try {
            if (window.__store) {
                var state = window.__store.getState();
                if (state && state.loginSignUpSlice && state.loginSignUpSlice.userEmail)
                    return state.loginSignUpSlice.userEmail;
                if (state && state.user && state.user.email)
                    return state.user.email;
            }
        } catch(e) {}
        // Fallback: read from session
        return null;
    }

    function cartItemsHash(items) {
        try { return JSON.stringify(items || []); } catch(e) { return '[]'; }
    }

    // ── Load cart FROM server and inject into Redux / localStorage ────────────
    function loadCartFromServer() {
        if (isLoading) return;
        isLoading = true;
        fetch(CART_API, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            isLoading = false;
            if (!data || !Array.isArray(data.cartItems) || data.cartItems.length === 0) return;

            var serverItems = data.cartItems;
            var serverHash = cartItemsHash(serverItems);

            // Merge with existing local cart (union by id, server wins on conflict)
            var localItems = getCartItemsFromRedux() || [];
            var mergedMap = {};
            localItems.forEach(function(item) {
                var key = item.id || item.cartItemId || JSON.stringify(item);
                mergedMap[key] = item;
            });
            serverItems.forEach(function(item) {
                var key = item.id || item.cartItemId || JSON.stringify(item);
                mergedMap[key] = item; // server overrides local on conflict
            });
            var merged = Object.values(mergedMap);

            // Write back to localStorage so Redux-persist picks it up
            injectCartIntoLocalStorage(merged);
            lastSavedHash = cartItemsHash(merged);

            // Dispatch to Redux store if available
            try {
                if (window.__store && typeof window.__store.dispatch === 'function') {
                    window.__store.dispatch({ type: 'cartData/setCartItems', payload: merged });
                }
            } catch(e) {}

            updateHeaderCartBadge();
            console.log('[CartSync] Loaded', merged.length, 'items from server');
        })
        .catch(function(e) {
            isLoading = false;
            console.warn('[CartSync] Load failed:', e);
        });
    }

    // ── Save cart TO server ────────────────────────────────────────────────────
    function saveCartToServer(items) {
        var hash = cartItemsHash(items);
        if (hash === lastSavedHash) return; // nothing changed
        lastSavedHash = hash;

        var userId = getUserId();
        var headers = { 'Content-Type': 'application/json' };
        if (userId) headers['X-User-Id'] = userId;

        fetch(CART_API, {
            method: 'POST',
            credentials: 'include',
            headers: headers,
            body: JSON.stringify({ cartItems: items })
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            if (data && data.success)
                console.log('[CartSync] Saved', items.length, 'items to server');
        })
        .catch(function(e) {
            console.warn('[CartSync] Save failed:', e);
        });
    }

    // ── Write merged items back into localStorage for Redux-persist ───────────
    function injectCartIntoLocalStorage(items) {
        try {
            // Try to update persist:root first
            var raw = localStorage.getItem('persist:root');
            if (raw) {
                var root = JSON.parse(raw);
                var cartData = root.cartData ? JSON.parse(root.cartData) : {};
                cartData.cartItems = items;
                root.cartData = JSON.stringify(cartData);
                localStorage.setItem('persist:root', JSON.stringify(root));
                return;
            }
            // Fallback: write persist:cartData
            var cartDataObj = { cartItems: items };
            localStorage.setItem('persist:cartData', JSON.stringify(cartDataObj));
        } catch(e) {
            console.warn('[CartSync] localStorage inject failed:', e);
        }
    }

    // ── Debounced watcher: poll Redux state and sync changes to server ─────────
    function scheduleSync() {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(function() {
            var items = getCartItemsFromRedux() || [];
            if (items.length > 0 || lastSavedHash !== '[]') {
                saveCartToServer(items);
            }
        }, SYNC_DEBOUNCE_MS);
    }

    // ── Start: load server cart, then watch for changes ────────────────────────
    function init() {
        // Load from server first (restores data after cache clear)
        setTimeout(loadCartFromServer, 800);

        // Poll cart state every 2s and sync on changes
        setInterval(function() {
            var items = getCartItemsFromRedux() || [];
            var hash = cartItemsHash(items);
            if (hash !== lastSavedHash) {
                scheduleSync();
            }
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


// ─── Header Cart Button Enforcer (v3 - Robust MutationObserver) ─────────────
(function() {
    var CART_BTN_ID = 'header-cart-btn';
    var NOTIF_ID = 'notification-bell';

    var CART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#1976d2" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2M1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2"/></svg>';

    function buildCartBtn() {
        var btn = document.createElement('button');
        btn.id = CART_BTN_ID;
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Cart');
        btn.setAttribute('title', 'Cart');
        btn.style.cssText = [
            'position:relative',
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:40px',
            'height:40px',
            'border:none',
            'border-radius:12px',
            'background:linear-gradient(135deg,rgba(25,118,210,0.14),rgba(156,39,176,0.20))',
            'color:#1976d2',
            'box-shadow:0 4px 16px rgba(25,118,210,0.20)',
            'cursor:pointer',
            'margin-left:6px',
            'margin-right:6px',
            'padding:0',
            'transition:transform 0.18s,box-shadow 0.18s',
            'flex-shrink:0',
        ].join(';');
        btn.innerHTML = CART_SVG;
        btn.addEventListener('mouseenter', function() {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 8px 24px rgba(25,118,210,0.32)';
        });
        btn.addEventListener('mouseleave', function() {
            btn.style.transform = '';
            btn.style.boxShadow = '0 4px 16px rgba(25,118,210,0.20)';
        });
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.location.href = '/orders?tab=cart';
        });
        return btn;
    }

    function injectCartBtn() {
        try {
            // Don't inject if already exists and positioned correctly
            var existing = document.getElementById(CART_BTN_ID);
            var notifBell = document.getElementById(NOTIF_ID);
            if (!notifBell) return;

            var parent = notifBell.parentElement;
            if (!parent) return;

            if (existing) {
                // Check it's still the sibling right before notification bell
                if (existing.nextElementSibling === notifBell) return;
                existing.remove();
            }

            var btn = buildCartBtn();
            parent.insertBefore(btn, notifBell);
        } catch(e) {
            console.error('[CartEnforcer] Error:', e);
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectCartBtn);
    } else {
        injectCartBtn();
    }

    // Run every 300ms for the first 10s after load to catch React hydration
    var attempts = 0;
    var maxAttempts = 40;
    var interval = setInterval(function() {
        injectCartBtn();
        attempts++;
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            // After initial burst, use MutationObserver for SPA navigation
            var observer = new MutationObserver(function() {
                injectCartBtn();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }, 300);
})();


// ─── Real-time Panel Configurator Step 1 to 8 Tracker ────────────────────────
(function() {
    'use strict';

    var lastConfigHash = null;
    var debounceTimer = null;

    function sendStepActivity(cartData) {
        try {
            var hash = JSON.stringify(cartData || {});
            if (hash === lastConfigHash) return;
            lastConfigHash = hash;

            var webAppUrl = typeof getWebAppUrl === 'function' ? getWebAppUrl() : '';

            // Extract Step 1 to 8 individual details
            var step1Panel = cartData.panel ? (cartData.panel.item || '') : '';
            var step2Mat   = cartData.material ? (cartData.material.item || '') : '';
            var step3Size  = cartData.size ? (cartData.size.item || '') : '';

            var accessoriesList = [...(cartData.accessories || []), ...(cartData.accessories1 || []), ...(cartData.accessories2 || []), ...(cartData.accessories3 || [])]
                .flatMap(function(a) { return (a.options || []).map(function(o) { return o.item; }); })
                .filter(Boolean)
                .join(', ');

            var droppedArr = Array.isArray(cartData.dropped) ? cartData.dropped : [];
            var iconNamesList = droppedArr.map(function(ic) { return ic.title || ic.name || ic.id || 'Icon'; }).join(', ');
            var step5Icons = droppedArr.length > 0 ? (droppedArr.length + ' icons (' + iconNamesList + ')') : '0 icons';

            var colorParts = [];
            if (Array.isArray(cartData.color)) {
                cartData.color.forEach(function(c) {
                    var itemsList = (c.options || []).map(function(o) { return o.item; }).join(', ');
                    if (itemsList) colorParts.push(c.optionType + ': ' + itemsList);
                });
            }
            var step6Color = colorParts.join(' | ');
            var step7Tech  = cartData.technology ? (cartData.technology.item || '') : '';

            var payload = {
                type: 'step_config',
                step1Panel: step1Panel,
                step2Mat: step2Mat,
                step3Size: step3Size,
                step4Acc: accessoriesList,
                step5Icons: step5Icons,
                step6Color: step6Color,
                step7Tech: step7Tech,
                step8Status: 'Configuring',
                details: cartData,
                webAppUrl: webAppUrl
            };

            fetch('/api/sheet-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(function(e) {});

        } catch(e) {}
    }

    function watchConfiguratorState() {
        if (!window.__store || typeof window.__store.subscribe !== 'function') return;

        window.__store.subscribe(function() {
            try {
                var state = window.__store.getState();
                var cartData = state && state.cartData && state.cartData.cartData;
                if (cartData) {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(function() {
                        sendStepActivity(cartData);
                    }, 1200);
                }
            } catch(e) {}
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(watchConfiguratorState, 1500); });
    } else {
        setTimeout(watchConfiguratorState, 1500);
    }
})();


// ─── Real-time Cart Item Deletion & Sync to Google Sheets ────────────────────
(function() {
    'use strict';

    var knownCartItems = {}; // { itemKey -> itemObj }
    var isInitialized = false;

    function getItemKey(item) {
        if (!item) return '';
        return item.orderId || item.id || item.productSequence || (item.customProductName + '_' + (item.totalPrice || 0));
    }

    function notifyServerAndDeleteFromGAS(removedItem) {
        try {
            var webAppUrl = typeof getWebAppUrl === 'function' ? getWebAppUrl() : '';
            var payload = {
                type: 'delete_item',
                orderId: removedItem.orderId || removedItem.id || '',
                productId: removedItem.productSequence || removedItem.id || '',
                customName: removedItem.customProductName || removedItem.orderName || removedItem.itemName || '',
                webAppUrl: webAppUrl
            };

            console.log('[CartSync] Item removed from cart! Deleting from Google Sheet & server:', payload);

            // 1. Send delete request to local server (/api/sheet-sync)
            fetch('/api/sheet-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(function(e) {});

            // 2. Direct fetch to Google Apps Script
            if (webAppUrl && webAppUrl.startsWith('http')) {
                fetch(webAppUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify(payload)
                }).catch(function(e) {});
            }
        } catch(e) {
            console.warn('[CartSync] Error notifying server of item deletion:', e);
        }
    }

    function notifyClearCartFromGAS() {
        try {
            var webAppUrl = typeof getWebAppUrl === 'function' ? getWebAppUrl() : '';
            var payload = { type: 'clear_cart', webAppUrl: webAppUrl };

            console.log('[CartSync] Cart cleared! Deleting all cart rows from Google Sheet & server');

            fetch('/api/sheet-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(function(e) {});

            if (webAppUrl && webAppUrl.startsWith('http')) {
                fetch(webAppUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify(payload)
                }).catch(function(e) {});
            }
        } catch(e) {}
    }

    function checkCartDeletions() {
        try {
            if (typeof getCartItemsFromRedux !== 'function') return;
            var currentItems = getCartItemsFromRedux() || [];
            var currentKeysMap = {};

            currentItems.forEach(function(item) {
                var key = getItemKey(item);
                if (key) currentKeysMap[key] = item;
            });

            if (!isInitialized) {
                knownCartItems = currentKeysMap;
                isInitialized = true;
                return;
            }

            // Check if any previously known item is no longer in current cart
            var knownKeys = Object.keys(knownCartItems);
            knownKeys.forEach(function(key) {
                if (!currentKeysMap[key]) {
                    var removedItem = knownCartItems[key];
                    delete knownCartItems[key];
                    notifyServerAndDeleteFromGAS(removedItem);
                }
            });

            // Update known items map with current items
            knownCartItems = currentKeysMap;

        } catch(e) {}
    }

    // Check for deleted items every 1.5s
    setInterval(checkCartDeletions, 1500);

    // Also attach global hook for clear cart buttons
    document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target) return;
        var btn = target.closest('button, a, [role="button"]');
        if (btn) {
            var txt = (btn.textContent || '').toLowerCase();
            var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (txt.includes('clear cart') || txt.includes('delete all') || aria.includes('clear cart')) {
                setTimeout(notifyClearCartFromGAS, 300);
            }
        }
    }, true);
})();


// ─── Direct Step Navigation: Allow users to click any step tab directly ─────
function enableDirectStepNavigation() {
    const isDashboardPage = window.location.href.toLowerCase().includes('userdashboard')
        || window.location.href.toLowerCase().includes('vdplshop.in');

    if (!isDashboardPage) return;

    // Find all MUI step labels / stepper items
    const stepElements = document.querySelectorAll('.MuiStep-root, .MuiStepLabel-root, [class*="MuiStep"]');
    if (!stepElements || stepElements.length === 0) return;

    stepElements.forEach((el, index) => {
        if (el.dataset.directNavAttached) return;
        el.dataset.directNavAttached = "true";
        el.style.cursor = "pointer";
        el.title = "Click to jump directly to this step";

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[CartSync] Direct step click detected for index:', index);

            if (window.__store) {
                try {
                    window.__store.dispatch({
                        type: 'cartData/setActiveStep',
                        payload: index
                    });
                } catch(err) {
                    console.warn('[CartSync] Direct step dispatch error:', err);
                }
            }

            // Fallback DOM click simulation if Redux action differs
            const targetButton = document.querySelectorAll('.MuiStep-root')[index];
            if (targetButton && targetButton !== el) {
                targetButton.click();
            }
        });
    });
}

// Periodically check and make stepper tabs directly clickable
setInterval(enableDirectStepNavigation, 800);

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║       SmartiQo UI/UX Polish Layer v2 (MutationObserver Edition)          ║
// ║  • Auto-select toggle  • Cart icon  • Loading overlay  • Page transitions ║
// ║  • Hover / active feedback • Accessibility • Responsive polish           ║
// ║  KEY FIX: MutationObserver keeps our <style> LAST so it beats MUI JSS   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

(function injectSmartiQoUX() {
    'use strict';

    const STYLE_ID = 'sc-ux-polish-v2';

    // ─── CSS ──────────────────────────────────────────────────────────────────
    const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --sc-p: #1976d2;
  --sc-pd: #115293;
  --sc-ok: #10b981;
  --sc-r: 10px;
  --sc-sh: 0 2px 12px rgba(0,0,0,.10);
  --sc-shh: 0 6px 24px rgba(25,118,210,.18);
  --sc-t: .22s cubic-bezier(.4,0,.2,1);
  --sc-f: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Typography */
body,.MuiTypography-root,.MuiButton-root,input,select,textarea{
  font-family:var(--sc-f)!important;
}

/* ── SWITCH / TOGGLE ─────────────────────────────────────────────── */
.MuiSwitch-root{cursor:pointer!important;}
.MuiSwitch-switchBase{transition:transform 220ms cubic-bezier(.4,0,.2,1)!important;}
.MuiSwitch-track{
  transition:background-color 220ms cubic-bezier(.4,0,.2,1)!important;
  border-radius:99px!important;
  opacity:1!important;
}
.MuiSwitch-switchBase.Mui-checked+.MuiSwitch-track{
  background-color:#10b981!important;
  opacity:1!important;
}
.MuiSwitch-thumb{
  box-shadow:0 1px 4px rgba(0,0,0,.25)!important;
}
.MuiSwitch-root:hover{opacity:.88!important;}
.MuiSwitch-root:focus-within{
  outline:2px solid var(--sc-p)!important;
  outline-offset:2px!important;
  border-radius:14px!important;
}
.MuiFormControlLabel-root{cursor:pointer!important;user-select:none!important;}

/* ── BUTTONS ─────────────────────────────────────────────────────── */
.MuiButton-root{
  font-family:var(--sc-f)!important;
  font-weight:600!important;
  border-radius:8px!important;
  transition:transform var(--sc-t),box-shadow var(--sc-t),background-color var(--sc-t)!important;
  will-change:transform,box-shadow!important;
}
.MuiButton-root:hover:not(:disabled){
  transform:translateY(-1px)!important;
  box-shadow:var(--sc-shh)!important;
}
.MuiButton-root:active:not(:disabled){
  transform:translateY(0) scale(.98)!important;
  box-shadow:none!important;
}
.MuiButton-root:focus-visible{
  outline:2px solid var(--sc-p)!important;
  outline-offset:3px!important;
}
.MuiButton-containedPrimary{
  background:linear-gradient(135deg,#1976d2 0%,#115293 100%)!important;
}
.MuiButton-containedPrimary:hover:not(:disabled){
  background:linear-gradient(135deg,#1e88e5 0%,#1976d2 100%)!important;
}

/* ── CARDS ───────────────────────────────────────────────────────── */
.MuiCard-root{
  border-radius:var(--sc-r)!important;
  transition:box-shadow var(--sc-t),transform var(--sc-t)!important;
}
.MuiCard-root:hover{
  box-shadow:var(--sc-shh)!important;
  transform:translateY(-2px)!important;
}

/* ── INPUTS ──────────────────────────────────────────────────────── */
.MuiOutlinedInput-root{
  border-radius:8px!important;
  transition:box-shadow var(--sc-t)!important;
}
.MuiOutlinedInput-root.Mui-focused{
  box-shadow:0 0 0 3px rgba(25,118,210,.18)!important;
}

/* ── STEPPER ─────────────────────────────────────────────────────── */
.MuiStep-root,.MuiStepLabel-root,.MuiStepIcon-root{cursor:pointer!important;}
.MuiStep-root:hover .MuiStepLabel-label{color:var(--sc-p)!important;font-weight:600!important;}
.MuiStepIcon-root{transition:transform var(--sc-t)!important;}
.MuiStep-root:hover .MuiStepIcon-root{transform:scale(1.1)!important;}
.MuiStepIcon-root.Mui-active{filter:drop-shadow(0 2px 6px rgba(25,118,210,.35))!important;}

/* ── TABLE ROWS ──────────────────────────────────────────────────── */
.MuiTableRow-root:not(.MuiTableRow-head):hover td,
.MuiTableRow-root:not(.MuiTableRow-head):hover th{
  background:rgba(25,118,210,.04)!important;
}

/* ── ICON BUTTONS ────────────────────────────────────────────────── */
.MuiIconButton-root{
  transition:background var(--sc-t),transform var(--sc-t)!important;
  will-change:transform!important;
}
.MuiIconButton-root:hover{
  transform:scale(1.12)!important;
  background:rgba(25,118,210,.10)!important;
}
.MuiIconButton-root:active{transform:scale(.92)!important;}

/* ── SIDEBAR NAV ─────────────────────────────────────────────────── */
.MuiListItemButton-root{
  border-radius:8px!important;
  margin:2px 8px!important;
  transition:background var(--sc-t),transform var(--sc-t)!important;
}
.MuiListItemButton-root:hover{
  background:rgba(25,118,210,.08)!important;
  transform:translateX(3px)!important;
}
.MuiListItemButton-root.Mui-selected{background:rgba(25,118,210,.14)!important;}

/* ── MENU ITEMS ──────────────────────────────────────────────────── */
.MuiMenuItem-root{
  border-radius:6px!important;
  margin:2px 4px!important;
  transition:background var(--sc-t),padding-left var(--sc-t)!important;
}
.MuiMenuItem-root:hover{
  background:rgba(25,118,210,.08)!important;
  padding-left:20px!important;
}
.MuiMenuItem-root.Mui-selected{
  background:rgba(25,118,210,.14)!important;
  font-weight:600!important;
}

/* ── CHIPS ───────────────────────────────────────────────────────── */
.MuiChip-root{
  font-family:var(--sc-f)!important;
  transition:transform var(--sc-t),box-shadow var(--sc-t)!important;
}
.MuiChip-root:hover{transform:scale(1.04)!important;box-shadow:0 2px 8px rgba(0,0,0,.12)!important;}

/* ── DIALOG ──────────────────────────────────────────────────────── */
.MuiDialog-paper{
  border-radius:14px!important;
  animation:sc-dialogIn 240ms cubic-bezier(.34,1.56,.64,1) both!important;
}
@keyframes sc-dialogIn{
  from{opacity:0;transform:scale(.94) translateY(8px);}
  to{opacity:1;transform:scale(1) translateY(0);}
}

/* ── CART ICON ───────────────────────────────────────────────────── */
#sc-cart-btn{
  cursor:pointer!important;
  border-radius:50%!important;
  padding:6px!important;
  transition:transform var(--sc-t),box-shadow var(--sc-t),background var(--sc-t)!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
}
#sc-cart-btn:hover{
  transform:scale(1.15)!important;
  background:rgba(25,118,210,.10)!important;
  box-shadow:0 2px 12px rgba(25,118,210,.18)!important;
}
#sc-cart-btn:active{transform:scale(.95)!important;}

/* ── LOADING OVERLAY ─────────────────────────────────────────────── */
#sc-loading-overlay{
  position:fixed;inset:0;z-index:99999;
  display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.72);
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
  opacity:0;pointer-events:none;
  transition:opacity 220ms cubic-bezier(.4,0,.2,1);
}
#sc-loading-overlay.sc-visible{opacity:1;pointer-events:all;}
.sc-spinner{
  width:44px;height:44px;
  border:3.5px solid rgba(25,118,210,.18);
  border-top-color:#1976d2;
  border-radius:50%;
  animation:sc-spin .72s linear infinite;
  box-shadow:0 4px 16px rgba(25,118,210,.18);
}
@keyframes sc-spin{to{transform:rotate(360deg);}}

/* ── PAGE FADE ───────────────────────────────────────────────────── */
.sc-page-fade{animation:sc-fadeIn 300ms cubic-bezier(.4,0,.2,1) both;}
@keyframes sc-fadeIn{
  from{opacity:0;transform:translateY(6px);}
  to{opacity:1;transform:translateY(0);}
}

/* ── TOOLTIP ─────────────────────────────────────────────────────── */
.MuiTooltip-tooltip{
  font-family:var(--sc-f)!important;
  font-size:12px!important;font-weight:500!important;
  border-radius:6px!important;padding:5px 10px!important;
  background:rgba(20,20,30,.88)!important;
}

/* ── ACCORDION ───────────────────────────────────────────────────── */
.MuiAccordion-root{border-radius:8px!important;transition:box-shadow var(--sc-t)!important;}
.MuiAccordion-root.Mui-expanded{box-shadow:0 4px 20px rgba(0,0,0,.10)!important;}
.MuiAccordionSummary-root:hover{background:rgba(25,118,210,.04)!important;}

/* ── SCROLLBAR ───────────────────────────────────────────────────── */
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(25,118,210,.28);border-radius:99px;}
::-webkit-scrollbar-thumb:hover{background:rgba(25,118,210,.55);}

/* ── RESPONSIVE ──────────────────────────────────────────────────── */
@media(max-width:768px){
  .MuiButton-root{min-height:42px!important;font-size:14px!important;}
  .sc-spinner{width:36px!important;height:36px!important;}
}
@media(hover:none){
  .MuiButton-root:hover,.MuiCard-root:hover,.MuiIconButton-root:hover{
    transform:none!important;
  }
}
`;

    // ─── Inject <style> & keep it LAST in <head> via MutationObserver ─────────
    function createStyle() {
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = CSS;
        return el;
    }

    let styleEl = null;

    function ensureStylesLast() {
        const head = document.head;
        if (!head) return;
        let el = document.getElementById(STYLE_ID);
        if (!el) {
            el = createStyle();
            styleEl = el;
            head.appendChild(el);
        } else if (el !== head.lastElementChild) {
            head.appendChild(el); // re-append → moves to end without duplicating
        }
        styleEl = el;
    }

    // Initial injection
    if (document.head) {
        ensureStylesLast();
    } else {
        document.addEventListener('DOMContentLoaded', ensureStylesLast);
    }

    // Watch <head> – MUI JSS will inject many <style> tags; each time, we move ours to end
    const headObserver = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.addedNodes.length) { ensureStylesLast(); break; }
        }
    });
    if (document.head) headObserver.observe(document.head, { childList: true });

    // Safety net: re-check every 2s
    setInterval(ensureStylesLast, 2000);

    // ─── 2. LOADING OVERLAY ───────────────────────────────────────────────────
    let overlayEl = null;
    let _loadingTimer = null;
    let _isLoading = false;

    function ensureOverlay() {
        if (!overlayEl) {
            overlayEl = document.getElementById('sc-loading-overlay');
            if (!overlayEl && document.body) {
                overlayEl = document.createElement('div');
                overlayEl.id = 'sc-loading-overlay';
                overlayEl.setAttribute('role', 'status');
                overlayEl.setAttribute('aria-label', 'Loading');
                overlayEl.innerHTML = '<div class="sc-spinner"></div>';
                document.body.appendChild(overlayEl);
            }
        }
        return overlayEl;
    }

    function scShowLoading(duration) {
        const el = ensureOverlay();
        if (!el) return;
        _isLoading = true;
        el.classList.add('sc-visible');
        if (_loadingTimer) clearTimeout(_loadingTimer);
        if (duration) _loadingTimer = setTimeout(scHideLoading, duration);
    }

    function scHideLoading() {
        _isLoading = false;
        const el = document.getElementById('sc-loading-overlay');
        if (el) el.classList.remove('sc-visible');
        if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
    }

    window.scShowLoading = scShowLoading;
    window.scHideLoading = scHideLoading;

    // ─── 3. PAGE FADE ─────────────────────────────────────────────────────────
    function applyPageFade() {
        const main = document.querySelector('main, .MuiContainer-root, #__next > div, [class*="Layout"]');
        if (main && !main.classList.contains('sc-page-fade')) {
            main.classList.add('sc-page-fade');
        }
    }

    // ─── 4. NAV LOADING HANDLERS ──────────────────────────────────────────────
    function attachNavLoadingHandlers() {
        document.querySelectorAll(
            '.MuiListItemButton-root:not([data-sc-nav]), ' +
            'a[href]:not([data-sc-nav]):not([href^="#"]):not([href^="javascript"]):not([href^="mailto"]):not([href^="tel"])'
        ).forEach(el => {
            if (el.dataset.scNav) return;
            el.dataset.scNav = '1';
            el.addEventListener('click', () => {
                const href = el.href || el.getAttribute('href') || '';
                if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
                    scShowLoading(4000);
                }
            });
        });

        document.querySelectorAll('.MuiButton-root:not([data-sc-step])').forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (['next','back','previous','finish'].includes(txt)) {
                btn.dataset.scStep = '1';
                btn.addEventListener('click', () => scShowLoading(1200));
            }
        });
    }

    // ─── 5. CART ICON ─────────────────────────────────────────────────────────
    function enhanceCartIcon() {
        const cartBtn = document.getElementById('sc-cart-btn');
        if (cartBtn && !cartBtn.dataset.scUxCart) {
            cartBtn.dataset.scUxCart = '1';
            cartBtn.setAttribute('title', 'View Orders & Cart');
            cartBtn.setAttribute('aria-label', 'Go to Cart / Orders');
            cartBtn.setAttribute('role', 'button');
            cartBtn.setAttribute('tabindex', '0');
            cartBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cartBtn.click(); }
            });
        }
    }

    // ─── 6. TOGGLE SWITCHES ───────────────────────────────────────────────────
    function enhanceToggles() {
        document.querySelectorAll('.MuiSwitch-root:not([data-sc-ux])').forEach(sw => {
            sw.dataset.scUx = '1';
            sw.setAttribute('role', 'switch');
            const input = sw.querySelector('input[type="checkbox"]');
            if (input) {
                sw.setAttribute('aria-checked', input.checked ? 'true' : 'false');
                sw.setAttribute('tabindex', '0');
                input.addEventListener('change', () => sw.setAttribute('aria-checked', input.checked ? 'true' : 'false'));
                sw.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); input.click(); }
                });
            }
        });
    }

    // ─── 7. SPA ROUTE WATCH ───────────────────────────────────────────────────
    let _lastHref = window.location.href;
    function watchRoute() {
        if (window.location.href !== _lastHref) {
            _lastHref = window.location.href;
            scShowLoading(2500);
            setTimeout(() => {
                scHideLoading();
                applyPageFade();
                attachNavLoadingHandlers();
                enhanceCartIcon();
                enhanceToggles();
                ensureStylesLast();
            }, 350);
        }
    }

    // ─── INIT ─────────────────────────────────────────────────────────────────
    function init() {
        ensureOverlay();
        applyPageFade();
        attachNavLoadingHandlers();
        enhanceCartIcon();
        enhanceToggles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Main polling loop
    setInterval(() => {
        watchRoute();
        if (_isLoading) {
            const vis = document.querySelector('main h1,main h2,main table,main .MuiCard-root');
            if (vis) scHideLoading();
        }
        attachNavLoadingHandlers();
        enhanceCartIcon();
        enhanceToggles();
    }, 700);

    window.addEventListener('popstate', () => setTimeout(scHideLoading, 350));

})();
