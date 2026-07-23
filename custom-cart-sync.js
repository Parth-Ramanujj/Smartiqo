(function () {
  const globalStyle = document.createElement("style");
  globalStyle.id = "sc-global-overlay-fix";
  globalStyle.innerHTML = `
        .branding-hydrator-overlay { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
    `;
  if (document.head) {
    document.head.appendChild(globalStyle);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.head) document.head.appendChild(globalStyle);
    });
  }
})();

// Force local storage override BEFORE React / Redux boots
(function forceRestoreCartItemToPersist() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const cartParamId = urlParams.get('cart');
    let editId = localStorage.getItem("sc_editing_item_id") || cartParamId;
    if (!editId) return;

    let item = null;
    let rawItemData = localStorage.getItem("sc_editing_item_data");
    if (rawItemData) {
      try { item = JSON.parse(rawItemData); } catch (e) {}
    }

    if (!item && cartParamId) {
      // Manually find it in persist
      const possibleKeys = ["persist:root", "persist:cartData", "persist:cart"];
      let allItems = [];
      for (const k of possibleKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed.cartData) {
          const cd = typeof parsed.cartData === "string" ? JSON.parse(parsed.cartData) : parsed.cartData;
          if (cd.cartItems && cd.cartItems.length > 0) { allItems = cd.cartItems; break; }
        }
        if (parsed.cartItems && parsed.cartItems.length > 0) { allItems = parsed.cartItems; break; }
      }
      item = allItems.find(i => i.id === cartParamId || i.productSequence === cartParamId);
      if (item) {
        localStorage.setItem("sc_editing_item_id", editId);
        localStorage.setItem("sc_editing_item_data", JSON.stringify(item));
      }
    }

    if (!item || !item.cartData) return;

    // Inject into local storage persist directly so Redux reads it on boot
    const keys = ["persist:root", "persist:cartData", "persist:cart"];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed.cartData) {
        let cd = typeof parsed.cartData === "string" ? JSON.parse(parsed.cartData) : parsed.cartData;
        cd.cartData = item.cartData;
        cd.droppedItems = item.dropped || [];
        cd.quantity = item.quantity || 1;
        cd.totalPrice = item.totalPrice || 0;
        parsed.cartData = typeof parsed.cartData === "string" ? JSON.stringify(cd) : cd;
        localStorage.setItem(k, JSON.stringify(parsed));
        console.log("[CartSync] Force-injected item into " + k);
        break;
      }
    }
  } catch (e) {
    console.error("[CartSync] Force restore failed:", e);
  }
})();

const DEFAULT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzSTmI2W9J58MOC_fUEQad9_IZ0FlHRE2dklrY-YzAvS99_sF_nEjNMDUkl0pnq7G87/exec";

function getWebAppUrl() {
  return localStorage.getItem("googleSheetUrl") || DEFAULT_WEB_APP_URL;
}

function setWebAppUrl(url) {
  localStorage.setItem("googleSheetUrl", url);}

// ─── User-facing notification (toast) ────────────────────────────────────────
function showNotification(message, type) {
  type = type || "info";
  if (typeof window.__scShowToast === "function") {
    window.__scShowToast(message, type);
    return;
  }
  const colors = {
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
  };
  const toast = document.createElement("div");
  toast.style.cssText = [
    "position:fixed",
    "bottom:24px",
    "right:20px",
    "z-index:99999",
    "background:" + (colors[type] || colors.info),
    "color:#fff",
    "padding:12px 20px",
    "border-radius:10px",
    "font-family:Roboto,Helvetica,Arial,sans-serif",
    "font-size:14px",
    "box-shadow:0 4px 20px rgba(0,0,0,0.25)",
    "max-width:340px",
    "word-break:break-word",
    "line-height:1.4",
    "cursor:pointer",
    "transition:opacity 0.4s ease",
    "opacity:1",
  ].join(";");
  toast.textContent = message;
  toast.onclick = function () {
    toast.style.opacity = "0";
    setTimeout(function () {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 400);
  };
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = "0";
    setTimeout(function () {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 400);
  }, 6000);}

// ─── Read cart items from Redux-persist localStorage ──────────────────────────
function getCartItemsFromRedux() {
  try {
    if (window.__store) {
      const state = window.__store.getState();
      if (
        state &&
        state.cartData &&
        Array.isArray(state.cartData.cartItems) &&
        state.cartData.cartItems.length > 0
      ) {
        return state.cartData.cartItems;
      }
    }

    const possibleKeys = ["persist:root", "persist:cartData", "persist:cart"];
    let cartItems = [];

    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      if (parsed.cartData) {
        const cartData =
          typeof parsed.cartData === "string"
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
        if (!k || !k.startsWith("persist:")) continue;
        try {
          const val = JSON.parse(localStorage.getItem(k));
          if (
            val &&
            val.cartItems &&
            Array.isArray(val.cartItems) &&
            val.cartItems.length > 0
          ) {
            cartItems = val.cartItems;
            break;
          }
          for (const subKey of Object.keys(val)) {
            try {
              const sub =
                typeof val[subKey] === "string"
                  ? JSON.parse(val[subKey])
                  : val[subKey];
              if (
                sub &&
                sub.cartItems &&
                Array.isArray(sub.cartItems) &&
                sub.cartItems.length > 0
              ) {
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
    console.error(
      "[CartSync] Failed to read Redux state from localStorage:",
      e,
    );
    return [];
  }}

// ─── Format price in INR ─────────────────────────────────────────────────────
function formatPrice(num) {
  if (typeof num !== "number" || isNaN(num)) return "₹ 0.00";
  return (
    "₹ " +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );}

// ─── Extract human-readable details string from cart item / design ───────────
function extractProductDetails(itemData) {
  if (!itemData) return "Custom Switch Panel";
  const detailParts = [];
  if (itemData.panel && itemData.panel.item)
    detailParts.push(`Panel: ${itemData.panel.item}`);
  if (itemData.material && itemData.material.item)
    detailParts.push(`Material: ${itemData.material.item}`);
  if (itemData.size && itemData.size.item)
    detailParts.push(`Size: ${itemData.size.item}`);
  if (itemData.technology && itemData.technology.item)
    detailParts.push(`Tech: ${itemData.technology.item}`);
  if (itemData.color && itemData.color.length > 0) {
    const colors = itemData.color
      .flatMap((c) => (c.options || []).map((o) => o.item))
      .filter(Boolean)
      .join(", ");
    if (colors) detailParts.push(`Colors: ${colors}`);
  }
  const accessories = [
    ...(itemData.accessories || []),
    ...(itemData.accessories1 || []),
    ...(itemData.accessories2 || []),
    ...(itemData.accessories3 || []),
  ]
    .flatMap((a) => (a.options || []).map((o) => o.item))
    .filter(Boolean)
    .join(", ");
  if (accessories) detailParts.push(`Accessories: ${accessories}`);

  return detailParts.join(" | ") || "Custom Panel";}

// ─── Capture Image Preview Data URL from page DOM or item screenshot ────────
async function getImagePreviewDataUrl(itemData) {
  if (
    itemData &&
    itemData.screenshotDataUrl &&
    typeof itemData.screenshotDataUrl === "string" &&
    itemData.screenshotDataUrl.startsWith("data:image")
  ) {
    return itemData.screenshotDataUrl;
  }

  const targetNode = document.querySelector(".panel-preview") || document.querySelector(".panel-container") || document.querySelector(".glass-panel-bg")?.parentElement || document.querySelector("canvas")?.parentElement;
  if (!targetNode) return "";

  return new Promise((resolve) => {
    if (typeof window.html2canvas === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = () => doCapture(targetNode, resolve);
      script.onerror = () => resolve("");
      document.head.appendChild(script);
    } else {
      doCapture(targetNode, resolve);
    }

    function doCapture(node, res) {
      window.html2canvas(node, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2
      }).then((canvas) => {
        res(canvas.toDataURL("image/png"));
      }).catch((e) => {
        console.error("html2canvas failed:", e);
        res("");
      });
    }
  });
}

// ─── Helper to escape PDF string characters ──────────────────────────────────
function escapePdfText(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// ─── Generate PDF Data URI for the Design Flow ────────────────────────────────
function generateFlowPdfDataUrl(
  customName,
  details,
  orderId,
  priceStr,
  dateStr,
) {
  try {
    const textLines = [
      "SmartiQo Custom Panel Order Flow Summary",
      "Order ID: " + orderId,
      "Date: " + dateStr,
      "Product Name: " + customName,
      "Price: " + priceStr,
      "Flow Details: " + details,
    ];

    let streamContent =
      "BT\n/F1 16 Tf\n50 750 Td\n(" +
      escapePdfText(textLines[0]) +
      ") Tj\n/F1 11 Tf\n";
    let yOffset = -25;
    for (let i = 1; i < textLines.length; i++) {
      streamContent +=
        "0 " + yOffset + " Td\n(" + escapePdfText(textLines[i]) + ") Tj\n";
      yOffset = -18;
    }
    streamContent += "ET";

    const pdfDoc =
      "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj\n4 0 obj <</Length " +
      streamContent.length +
      ">> stream\n" +
      streamContent +
      "\nendstream\nendobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000246 00000 n\n0000000300 00000 n\ntrailer <</Size 6 /Root 1 0 R>>\nstartxref\n400\n%%EOF";

    const b64 =
      typeof btoa === "function"
        ? btoa(unescape(encodeURIComponent(pdfDoc)))
        : Buffer.from(pdfDoc, "utf-8").toString("base64");

    return "data:application/pdf;base64," + b64;
  } catch (e) {
    console.warn("[CartSync] PDF generation warning:", e);
    return "";
  }}

// ─── Build full item payload with all My Cart details ────────────────────────
async function buildFullItemPayload(item, orderId, isOrderConfirmation) {
  const qty = Math.max(1, Math.floor(item.quantity || 1));
  const totalPrice = Number(item.totalPrice) || 0;
  const priceStr = formatPrice(totalPrice);
  const unitPriceStr = formatPrice(totalPrice / qty);

  const droppedCount = Array.isArray(item.dropped) ? item.dropped.length : 0;
  const savings = droppedCount * 100 * qty;

  const productId =
    (item.productSequence || "").trim() ||
    item.id ||
    "PROD-" + Math.floor(1000 + Math.random() * 9000);
  const orderName = (item.orderName || "").trim() || "Untitled Order";
  const customName = (item.customProductName || "").trim() || orderName;

  const cartData = item.cartData || {};
  const panelType = cartData.panel?.item || "";
  const materialType = cartData.material?.item || "";
  const sizeModule = cartData.size?.item || "";
  const techType = cartData.technology?.item || "";

  const colorParts = [];
  if (Array.isArray(cartData.color)) {
    cartData.color.forEach((c) => {
      if (c.options && c.options.length > 0) {
        colorParts.push(
          `${c.optionType}: ${c.options.map((o) => o.item).join(", ")}`,
        );
      }
    });
  }
  const colorsStr = colorParts.join(" | ");

  const accessoriesList = [
    ...(cartData.accessories || []),
    ...(cartData.accessories1 || []),
    ...(cartData.accessories2 || []),
    ...(cartData.accessories3 || []),
  ]
    .flatMap((a) => (a.options || []).map((o) => o.item))
    .filter(Boolean)
    .join(", ");

  const detailsSummary = extractProductDetails(cartData);
  const panelName = `${customName} (${detailsSummary})`;

  const imgPreview = await getImagePreviewDataUrl(item);
  const dateStr = item.createdAt || new Date().toISOString();
  const flowPdfData = generateFlowPdfDataUrl(
    customName,
    detailsSummary,
    orderId,
    priceStr,
    dateStr,
  );

  return {
    orderId: orderId,
    date: dateStr,
    productId: productId,
    orderName: orderName,
    customName: customName,
    panelName: panelName,
    panel: panelType,
    material: materialType,
    size: sizeModule,
    technology: techType,
    colors: colorsStr,
    accessories: accessoriesList,
    qty: String(qty),
    quantity: String(qty),
    unitPrice: unitPriceStr,
    price: totalPrice,
    priceFormatted: priceStr,
    savings: savings > 0 ? formatPrice(savings) : "₹ 0.00",
    imagePreview: imgPreview,
    preview: imgPreview || detailsSummary,
    flowPdf: flowPdfData,
    pdf: flowPdfData,
    status: isOrderConfirmation ? "Confirmed" : "Cart",
  };}

// ─── Send a SINGLE object payload to Google Apps Script ───────────────────────
function sendSinglePayloadToGAS(payloadObj) {
  const url = getWebAppUrl();
  console.log(
    "[CartSync] Sending payload to Google Sheets:",
    payloadObj.orderId,
  );

  try {
    const localOrders = JSON.parse(
      localStorage.getItem("sc_local_orders") || "[]",
    );
    localOrders.push({
      timestamp: new Date().toISOString(),
      payload: payloadObj,
    });
    localStorage.setItem("sc_local_orders", JSON.stringify(localOrders));
  } catch (e) {
    console.warn("[CartSync] Could not save local backup:", e);
  }

  return fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payloadObj),
  })
    .then(function () {
      console.log("[CartSync] Google Sheet request sent successfully.");
      return { success: true, payload: payloadObj };
    })
    .catch(function (err) {
      console.error("[CartSync] Fetch to Google Sheet failed:", err);
      logErrorToServer("Google Sheet fetch error", payloadObj, err);
      return { error: true, message: err.message };    });
}

// ─── Main sync function for entire cart (Submit / Confirm / Place Order) ──────
function syncCartToGoogleSheet(isOrderConfirmation = false) {
  const cartItems = getCartItemsFromRedux();

  console.log("[CartSync] Found cart items:", cartItems.length);

  if (cartItems.length === 0) {
    console.warn("[CartSync] No cart items found in Redux state.");
    return Promise.resolve({ empty: true });
  }

  const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);

  const promises = cartItems.map(async (item) => {
    const singlePayload = await buildFullItemPayload(
      item,
      orderId,
      isOrderConfirmation,
    );
    return sendSinglePayloadToGAS(singlePayload);
  });

  return Promise.all(promises).then((results) => {
    const hasError = results.some((r) => r && r.error);
    if (hasError) {
      return {
        error: true,
        message: "One or more items failed to sync to Google Sheets.",
      };
    }
    return { success: true, count: results.length };
  });}

// ─── Read current customizer state from Redux-persist localStorage ───────────
function getCurrentDesignFromRedux() {
  try {
    if (window.__store) {
      const state = window.__store.getState();
      if (
        state &&
        state.cartData &&
        state.cartData.cartData &&
        state.cartData.cartData.panel
      ) {
        return {
          cartData: state.cartData.cartData,
          quantity: state.cartData.quantity || 1,
          totalPrice: state.cartData.totalPrice || 0,
          droppedItems: state.cartData.droppedItems || [],
        };
      }
    }

    const possibleKeys = ["persist:root", "persist:cartData", "persist:cart"];
    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      let cartData = null;
      if (parsed.cartData) {
        cartData =
          typeof parsed.cartData === "string"
            ? JSON.parse(parsed.cartData)
            : parsed.cartData;
      } else if (parsed.panel) {
        cartData = parsed;
      }

      if (cartData && cartData.panel) {
        let quantity = parsed.quantity || 1;
        if (typeof quantity === "string") quantity = parseInt(quantity, 10);

        let totalPrice = parsed.totalPrice || 0;
        if (typeof totalPrice === "string") totalPrice = parseFloat(totalPrice);

        let droppedItems = parsed.droppedItems || [];
        if (typeof droppedItems === "string")
          droppedItems = JSON.parse(droppedItems);

        return {
          cartData,
          quantity,
          totalPrice,
          droppedItems,
        };
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("persist:")) continue;
      try {
        const val = JSON.parse(localStorage.getItem(k));
        if (val && val.cartData) {
          const cartData =
            typeof val.cartData === "string"
              ? JSON.parse(val.cartData)
              : val.cartData;
          if (cartData && cartData.panel) {
            let quantity = val.quantity || 1;
            let totalPrice = val.totalPrice || 0;
            let droppedItems = val.droppedItems || [];
            if (typeof quantity === "string") quantity = parseInt(quantity, 10);
            if (typeof totalPrice === "string")
              totalPrice = parseFloat(totalPrice);
            if (typeof droppedItems === "string")
              droppedItems = JSON.parse(droppedItems);
            return { cartData, quantity, totalPrice, droppedItems };
          }
        }
      } catch (e) {}
    }
    return null;
  } catch (e) {
    console.error("[CartSync] Failed to read current design from Redux:", e);
    return null;
  }}

// ─── Sync single item or handle Update Item ───────────────────────────────────
async function syncSingleItemToGoogleSheet(design) {
  if (!design || !design.cartData) {
    console.warn("[CartSync] No active design found to sync.");
    return Promise.resolve({ empty: true });
  }

  const editingId = localStorage.getItem("sc_editing_item_id");
  const isEditing = !!editingId;

  // If item is currently being edited, update existing item in Redux!
  if (isEditing && window.__store) {
    try {
      const state = window.__store.getState();
      const cartItems =
        state.cartData && state.cartData.cartItems
          ? state.cartData.cartItems
          : [];
      const idx = cartItems.findIndex(
        (i) => i.id === editingId || i.productSequence === editingId,
      );

      if (idx !== -1) {
        const existingItem = cartItems[idx];
        const newScreenshotUrl = await getImagePreviewDataUrl(design);
        const updatedItems = [...cartItems];
        updatedItems[idx] = {
          ...updatedItems[idx],
          cartData: design.cartData,
          dropped: design.droppedItems || [],
          quantity: design.quantity || 1,
          totalPrice: design.totalPrice || 0,
          screenshotDataUrl: (newScreenshotUrl && newScreenshotUrl !== "") ? newScreenshotUrl : (existingItem.screenshotDataUrl || ""),
          updatedAt: new Date().toISOString(),
        };
        window.__store.dispatch({
          type: "cartData/setCartItems",
          payload: { items: updatedItems },
        });
        console.log(
          "[CartSync] Updated existing cart item in Redux:",
          editingId,
        );
      }
    } catch (e) {
      console.warn("[CartSync] Failed to dispatch Redux update for item:", e);
    }
  }

  const orderId = isEditing
    ? "UPD-" + editingId.substring(0, 8)
    : "ADD-" + Math.floor(100000 + Math.random() * 900000);
  const item = {
    id: editingId || "",
    cartData: design.cartData,
    quantity: design.quantity || 1,
    totalPrice: design.totalPrice || 0,
    dropped: design.droppedItems || [],
    createdAt: new Date().toISOString(),
  };

  const singlePayload = await buildFullItemPayload(item, orderId, false);
  singlePayload.status = isEditing ? "Updated" : "Add to Cart";

  // Clear editing flag after sync
  if (isEditing) {
    localStorage.removeItem("sc_editing_item_id");
  }

  return sendSinglePayloadToGAS(singlePayload);}

// ─── Log error to local server ──────────────────────────────────────────────
function logErrorToServer(message, payload, error) {
  const errorBody = {
    message: message,
    payload: payload,
    details: error && error.stack ? error.stack : String(error),
  };

  fetch("/api/logs/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(errorBody),
  }).catch(function () {});}

// ─── Trigger sync on Add to Cart / Update Item ───────────────────────────────
function triggerAddToCartSync() {
  const isEditing = !!localStorage.getItem("sc_editing_item_id");
  console.log(
    "[CartSync] Triggering " +
      (isEditing ? "Update Item" : "Add to Cart") +
      " Google Sheets sync...",
  );

  setTimeout(() => {
    const currentDesign = getCurrentDesignFromRedux();
    if (!currentDesign) {
      console.warn("[CartSync] Could not fetch current design to sync.");
      showNotification(
        isEditing ? "✅ Item updated!" : "✅ Item added to cart!",
        "success",
      );
      if (isEditing) {
        setTimeout(() => {
          window.location.href = "/orders?tab=cart";
        }, 1000);
      }
      return;
    }

    syncSingleItemToGoogleSheet(currentDesign)
      .then((res) => {
        if (res && res.success) {
          console.log("[CartSync] Successfully saved row to Google Sheets!");
          showNotification(
            isEditing
              ? "✅ Item updated in cart & Google Sheet!"
              : "✅ Item added to cart & saved to Google Sheet!",
            "success",
          );
        } else {
          showNotification(
            isEditing
              ? "⚠️ Item updated in cart (saved locally)."
              : "⚠️ Item added to cart (saved locally).",
            "warning",
          );
        }
      })
      .catch((err) => {
        console.error("[CartSync] Error syncing single item:", err);
        showNotification(
          isEditing ? "✅ Item updated in cart!" : "✅ Item added to cart!",
          "success",
        );
      })
      .finally(() => {
        if (isEditing) {
          localStorage.removeItem("sc_editing_item_id");
          localStorage.removeItem("sc_editing_item_data");
          setTimeout(() => {
            window.location.href = "/orders?tab=cart";
          }, 1200);
        }
      });
  }, 400);}

// ─── Trigger sync on Confirm Order / Place Order / Checkout ───────────────────
function triggerConfirmOrderSync() {
  console.log("[CartSync] Triggering Confirm Order Google Sheets sync...");
  setTimeout(() => {
    syncCartToGoogleSheet(true)
      .then((res) => {
        if (res && res.empty) {
          showNotification("⚠️ No cart items found to sync!", "warning");
        } else if (res && res.error) {
          showNotification("⚠️ Order saved locally.", "warning");
        } else {
          showNotification(
            "✅ All cart items saved to Google Sheet!",
            "success",
          );
        }
      })
      .catch((err) => {
        console.error("[CartSync] Error syncing order:", err);
      });
  }, 400);}

// ─── Dynamic Button Label updater & State Restorer for Edit Mode ──────────────
function restoreEditingItemOnDashboardLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const cartParamId = urlParams.get('cart');

  let editId = localStorage.getItem("sc_editing_item_id") || cartParamId;
  
  if (!editId) return;

  let rawItemData = localStorage.getItem("sc_editing_item_data");
  let item = null;
  try {
      if (rawItemData) item = JSON.parse(rawItemData);
  } catch(e){}

  if (!item && cartParamId) {
      const cartItems = getCartItemsFromRedux();
      item = cartItems.find(i => i.id === cartParamId || i.productSequence === cartParamId);
      if (item) {
          localStorage.setItem("sc_editing_item_id", editId);
          localStorage.setItem("sc_editing_item_data", JSON.stringify(item));
      }
  }

  if (item && item.cartData && window.__store && !window.__sc_item_restored) {
    try {
      window.__store.dispatch({
        type: "cartData/setCartFromOrder",
        payload: {
          cart: item.cartData,
          dropped: item.dropped || [],
        },
      });
      if (item.quantity) {
        window.__store.dispatch({
          type: "cartData/increaseQuantity",
          payload: { qty: item.quantity },
        });
      }
      console.log("[CartSync] Restored editing item into Redux store on load:", item);
      window.__sc_item_restored = true; // Prevent infinite dispatch loops!
    } catch (e) {
      console.warn("[CartSync] Error restoring editing item on load:", e);
    }
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  const addToCartBtn = buttons.find((b) => {
    const t = (b.textContent || "").trim().toLowerCase();
    return (
      t === "add to cart" || t === "add to quote" || t.includes("update item")
    );
  });

  if (addToCartBtn && !addToCartBtn.textContent.includes("Update Item")) {
    addToCartBtn.textContent = "🔄 Update Item";
    addToCartBtn.style.background =
      "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)";
    addToCartBtn.style.color = "#ffffff";
  }
}

function updateButtonLabelForEditMode() {
  restoreEditingItemOnDashboardLoad();
}

// ─── Global Event Listener for Cart Actions & Edit Item ───────────────────────
document.addEventListener(
  "click",
  function (e) {
    try {
      const target = e.target;
      if (!target) return;

      const btn = target.closest
        ? target.closest('button, [role="button"], a, input[type="submit"]')
        : null;
      if (!btn) return;

      const text = (btn.textContent || btn.value || "").trim().toLowerCase();

      // Removed Edit Item interception to let Next.js handle it natively without full page reloads.
      // 2. Add to Cart / Update Item
      else if (
        text === "add to cart" ||
        text === "add to quote" ||
        text.includes("update item") ||
        text.includes("add to cart")
      ) {
        triggerAddToCartSync();
      }
      // 3. Order Placement / Checkout / Confirmation in My Cart
      else if (
        text.includes("confirm order") ||
        text.includes("place order") ||
        text.includes("submit order") ||
        text.includes("checkout") ||
        text.includes("place selected") ||
        text.includes("batch order")
      ) {
        triggerConfirmOrderSync();
      }
    } catch (e) {
      console.warn("[CartSync] Event listener warning:", e);
    }
  },
  false,
);

// ─── Inject Sync Cart button next to Confirm Order ───────────────────────────
function checkAndInjectSyncButton() {
  const isCartPage =
    window.location.href.toLowerCase().includes("orders") ||
    window.location.href.toLowerCase().includes("cart") ||
    window.location.href.toLowerCase().includes("dashboard");

  if (!isCartPage) return;

  updateButtonLabelForEditMode();

  if (document.getElementById("custom-sync-btn")) return;

  const buttons = Array.from(document.querySelectorAll("button"));
  const confirmBtn = buttons.find((b) => {
    const t = (b.textContent || "").trim().toLowerCase();
    return (
      t.includes("confirm order") ||
      t.includes("place order") ||
      t.includes("checkout")
    );
  });

  if (!confirmBtn) return;

  const syncBtn = document.createElement("button");
  syncBtn.id = "custom-sync-btn";
  syncBtn.style.cssText = `        margin-left: 10px;
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
  syncBtn.textContent = "📤 Sync to Google Sheet";

  syncBtn.addEventListener("click", () => {
    const originalText = syncBtn.textContent;
    syncBtn.textContent = "⏳ Syncing...";
    syncBtn.disabled = true;

    syncCartToGoogleSheet(false)
      .then((res) => {
        if (res && res.empty) {
          showNotification(
            "⚠️ No cart items found! Please add items to cart before syncing.",
            "warning",
          );
        } else if (res && res.error) {
          showNotification(
            "⚠️ Cart data saved locally. Google Sheets connection failed.",
            "warning",
          );
        } else {
          showNotification("✅ Cart data synced to Google Sheet!", "success");
          const container = document.getElementById("custom-orders-view");
          if (container) {
            container.remove();
            // setTimeout(checkAndInjectOrdersView, 500);
          }
        }
      })
      .catch((err) => {
        console.error("[CartSync] Sync failed:", err);
        showNotification(
          "❌ Sync failed: " + err.message + ". Check console for details.",
          "error",
        );
      })
      .finally(() => {
        syncBtn.textContent = originalText;
        syncBtn.disabled = false;
      });
  });

  confirmBtn.parentNode.insertBefore(syncBtn, confirmBtn.nextSibling);
  console.log("[CartSync] Sync button injected.");}

// ─── Profile page: Google Sheet URL configurator ─────────────────────────────
function checkAndInjectProfileInput() {
  if (!window.location.href.toLowerCase().includes("profile")) return;
  if (document.getElementById("custom-sheet-url-container")) return;

  const container = document.createElement("div");
  container.id = "custom-sheet-url-container";
  container.style.cssText = `
        padding: 20px; margin: 20px auto; max-width: 800px;
        background: #f5f8fa; border: 1px solid #cce5ff; border-radius: 8px;
    `;
  container.innerHTML = `        <h3 style="margin-top:0;color:#004085;">Google Sheet Database Setup</h3>
        <p style="color:#383d41;">Enter your Google Apps Script Web App URL to sync cart data.</p>
        <input type="text" id="custom-sheet-url-input" value="${getWebAppUrl()}"
            style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;border:1px solid #ced4da;border-radius:4px;">
        <button id="custom-sheet-url-save"
            style="padding:10px 20px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">
            Save URL
        </button>
    `;

  const main = document.querySelector("main") || document.body;
  main.insertBefore(container, main.firstChild);

  document
    .getElementById("custom-sheet-url-save")
    .addEventListener("click", () => {
      const val = document
        .getElementById("custom-sheet-url-input")
        .value.trim();
      if (val) {
        setWebAppUrl(val);
        alert("✅ URL Saved!");
      }    });
}

// ─── Orders/Cart page: Show synced rows from Google Sheet ────────────────────
function checkAndInjectOrdersView() { return; 
  const isTargetPage =
    window.location.href.toLowerCase().includes("orders") ||
    window.location.href.toLowerCase().includes("cart");

  if (!isTargetPage) return;
  if (document.getElementById("custom-orders-view")) return;

  const container = document.createElement("div");
  container.id = "custom-orders-view";
  container.style.cssText = `
        padding: 25px; margin: 30px auto; max-width: 1200px;
        background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 12px;
    `;
  container.innerHTML = `<p style="color:#888;font-family:sans-serif;">⏳ Loading synced data from Google Sheet...</p>`;

  const main = document.querySelector("main") || document.body;
  main.insertBefore(container, main.firstChild);

  fetch(getWebAppUrl())
    .then((res) => res.json())
    .then((data) => {
      const rows = Array.isArray(data) ? data : [];
      let html = `<h3 style="color:#10B981;margin-top:0;font-family:'Inter',sans-serif;">✅ Synced Google Sheet Orders</h3>`;
      html += `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;font-family:'Inter',sans-serif;">`;
      html += `<thead><tr>`;
      for (const col of ["Order ID", "Panel Name", "Price", "Date"]) {
        html += `<th style="border-bottom:2px solid #E5E7EB;padding:12px;font-weight:600;color:#374151;text-align:left;">${col}</th>`;
      }
      html += `</tr></thead><tbody>`;

      if (rows.length === 0) {
        html += `<tr><td colspan="4" style="padding:20px;text-align:center;color:#9CA3AF;">No data synced yet.</td></tr>`;
      } else {
        rows.forEach((order) => {
          html += `<tr style="border-bottom:1px solid #F3F4F6;">
                        <td style="padding:12px;font-weight:500;color:#1F2937;">${order.orderId || order.orderid || "—"}</td>
                        <td style="padding:12px;color:#4B5563;">${order.panelName || order.panelname || order.customName || "—"}</td>
                        <td style="padding:12px;font-weight:600;color:#111827;">${formatPrice(Number(order.price) || 0)}</td>
                        <td style="padding:12px;color:#6B7280;font-size:12px;">${order.date ? new Date(order.date).toLocaleString() : "—"}</td>
                    </tr>`;
        });
      }

      html += `</tbody></table></div>`;
      container.innerHTML = html;
    })
    .catch((err) => {
      container.innerHTML = `
                <h3 style="color:#dc3545;">❌ Failed to load from Google Sheet</h3>
                <p style="color:#555;">Make sure your Google Apps Script is deployed as a Web App with <strong>"Anyone"</strong> access.</p>
                <p style="font-size:12px;color:#999;">Error: ${err.message}</p>
            `;
    });
}

// ─── SPA Observer: re-run checks on route/DOM changes ────────────────────────
let _lastHref = "";
const observer = new MutationObserver(() => {
  if (window.location.href !== _lastHref) {
    _lastHref = window.location.href;
    [
      "custom-sync-btn",
      "custom-orders-view",
      "custom-sheet-url-container",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
  checkAndInjectSyncButton();
  checkAndInjectProfileInput();
  // // checkAndInjectOrdersView();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

window.addEventListener("load", () => {
  _lastHref = window.location.href;
  checkAndInjectSyncButton();
  checkAndInjectProfileInput();
  // checkAndInjectOrdersView();});

// Expose for manual debugging in browser console
window.__cartSync = {
  syncNow: () => syncCartToGoogleSheet(false),
  getItems: () => getCartItemsFromRedux(),
  getUrl: getWebAppUrl,
  setUrl: setWebAppUrl,
};
console.log(
  "[CartSync] Loaded with Edit Item tracking & Update Item sync. Ready.",
);


// -------------------------------------------------------------------------
// URL-based Cart Item Restoration (Robust fallback)
// -------------------------------------------------------------------------
let _urlCartRestored = false;
let _lastCartId = null;

function restoreCartFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const cartId = params.get("cart");
  
  if (!cartId) {
    _lastCartId = null;
    _urlCartRestored = false;
    return;
  }
  
  if (cartId !== _lastCartId) {
    _lastCartId = cartId;
    _urlCartRestored = false; // Reset if URL changes
  }

  if (_urlCartRestored) return;

  if (window.__store) {
    const state = window.__store.getState();
    if (state && state.cartData && state.cartData.cartItems && state.cartData.cartItems.length > 0) {
      const item = state.cartData.cartItems.find(i => i.id === cartId || i.cartData?.id === cartId || i.productSequence === cartId);
      if (item) {
        window.__store.dispatch({
          type: "cartData/setCartFromOrder",
          payload: { cart: item.cartData || item, dropped: item.dropped || [] }
        });
        _urlCartRestored = true;
        console.log("[CartSync] Restored cart item from URL param:", cartId);
      }
    }
  }
}

// Run it periodically in case Redux state takes time to load from IndexedDB
setInterval(restoreCartFromUrl, 500);

