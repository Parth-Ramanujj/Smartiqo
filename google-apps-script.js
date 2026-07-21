/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║          SmartiQo – Google Apps Script for Panel Order Tracking             ║
 * ║  Paste this entire file into: Google Sheet → Extensions → Apps Script       ║
 * ║  Then click: Deploy → New deployment → Web app → Execute as Me →           ║
 * ║  Anyone can access → Deploy → Copy the web app URL                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * SHEET STRUCTURE (auto-created on first request):
 *  Sheet 1: "Orders"         — Each field stored in its own separate column
 *  Sheet 2: "User Activity"  — Step-by-step user journey tracking
 *  Sheet 3: "Users"          — Login/logout activity
 */

// ─── Configuration ─────────────────────────────────────────────────────────────
var SHEET_NAME_ORDERS   = "Orders";
var SHEET_NAME_ACTIVITY = "User Activity";
var SHEET_NAME_USERS    = "Users";

// ─── ORDERS sheet columns (EVERY FIELD HAS ITS OWN SEPARATE COLUMN) ───────────
var ORDER_HEADERS = [
  "Date",                   // A: Date (DD/MM/YYYY)
  "Time",                   // B: Time (HH:MM:SS IST)
  "Order ID",               // C: Unique order identifier (ORD-XXXXXX)
  "User Email",             // D: User's email address
  "User Name",              // E: User's display name
  "Product / Order Name",   // F: Custom product name given by user
  "Panel Type",             // G: Touch Panel / Edge / Color / etc.
  "Material",               // H: Glass, Acrylic, Aluminum, Wood, etc.
  "Size / Module",          // I: 2 Module, 4 Module, 6 Module, 8 Module, etc.
  "Glass / Panel Color",    // J: Glass or Panel face color
  "Border / Frame Color",   // K: Edge or border frame color
  "Button / Icon Color",    // L: Touch button / LED color
  "Accessories",            // M: Individual accessories selected
  "Icons Count",            // N: Number of icons placed on panel
  "Icon Names / Layout",    // O: Names of icons placed on panel
  "Technology",             // P: Touch, Mechanical, Smart, Zigbee, WiFi, etc.
  "Quantity",               // Q: Number of units ordered
  "Unit Price (₹)",         // R: Price per single unit
  "Total Price (₹)",        // S: Total price (Quantity * Unit Price)
  "Savings (₹)",            // T: Total savings or discount applied
  "Status",                 // U: Cart / Confirmed / Processing / Completed
  "Product Sequence",       // V: Internal product sequence code
  "Image Preview URL",      // W: Preview image URL / Data URL
  "Raw JSON Data"           // X: Full raw JSON payload for reference
];

// ─── USER ACTIVITY sheet columns ───────────────────────────────────────────────
var ACTIVITY_HEADERS = [
  "Date",         // A
  "Time",         // B
  "Session ID",   // C
  "User Email",   // D
  "Step Name",    // E: Panel / Material / Size / Accessories / Icons / Color / Tech / Cart
  "Selection",    // F: What the user selected in this step
  "Details",      // G: Additional parameters for this selection
  "Action"        // H: selected / deselected / next / back / add_to_cart
];

// ─── USERS sheet columns ────────────────────────────────────────────────────────
var USER_HEADERS = [
  "Date",         // A
  "Time",         // B
  "User Email",   // C
  "User Name",    // D
  "Action",       // E: login / logout
  "Session ID"    // F
];

// ══════════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ══════════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "getOrders";
  var userEmail = e && e.parameter && e.parameter.email;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "getOrders") {
      var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ORDER_HEADERS);
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse([]);

      var headers = data[0];
      var rows = [];
      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        if (!userEmail || row["User Email"] === userEmail) {
          rows.push(row);
        }
      }
      return jsonResponse(rows);
    }

    if (action === "getActivity") {
      var sheet = getOrCreateSheet(ss, SHEET_NAME_ACTIVITY, ACTIVITY_HEADERS);
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse([]);

      var headers = data[0];
      var rows = [];
      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        if (!userEmail || row["User Email"] === userEmail) {
          rows.push(row);
        }
      }
      return jsonResponse(rows);
    }

    return jsonResponse({ error: "Unknown action: " + action });

  } catch(err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var type = body.type || "order";

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === "order" || type === "cart") {
      return handleOrderData(ss, body);
    }

    if (type === "activity" || type === "step") {
      return handleActivityData(ss, body);
    }

    if (type === "user_login" || type === "user_logout") {
      return handleUserActivity(ss, body);
    }

    // Fallback detection
    if (body.orderId || body.panelType || body.cartData || body.panel) {
      return handleOrderData(ss, body);
    }

    if (body.step || body.stepName) {
      return handleActivityData(ss, body);
    }

    return jsonResponse({ success: true, message: "Received unrecognized type: " + type });

  } catch(err) {
    Logger.log("doPost error: " + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════
// HANDLERS (STORE EVERY FIELD IN SEPARATE INDIVIDUAL COLUMNS)
// ══════════════════════════════════════════════════════════════════════════════════

function handleOrderData(ss, body) {
  var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ORDER_HEADERS);

  var nowObj = new Date();
  var dateStr = nowObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  var timeStr = nowObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

  var orderId     = body.orderId     || body.order_id     || ("ORD-" + Date.now());
  var userEmail   = body.userEmail   || body.user_email   || body.email   || "";
  var userName    = body.userName    || body.user_name    || body.name    || "";
  var productName = body.customName  || body.orderName    || body.itemName || "Custom Switch Panel";

  // Individual Panel Configurations in Separate Fields
  var panelType   = body.panel       || body.panelType    || getProp(body, "cartData.panel.item")    || "";
  var material    = body.material    || body.materialType || getProp(body, "cartData.material.item") || "";
  var size        = body.size        || body.sizeModule   || getProp(body, "cartData.size.item")     || "";

  // Separate Colors (Glass, Frame, Button)
  var glassColor  = body.glassColor  || body.panelColor   || extractColorByType(body, ["glass", "panel", "face"])  || "";
  var frameColor  = body.frameColor  || body.borderColor  || extractColorByType(body, ["border", "frame", "edge"]) || "";
  var buttonColor = body.buttonColor || body.iconColor   || extractColorByType(body, ["button", "icon", "touch"]) || "";

  // Accessories & Icons
  var accessories = body.accessories || extractAccessories(body) || "";
  var iconsCount  = body.iconsCount  || extractIconsCount(body)  || "0";
  var iconNames   = body.iconNames   || extractIconNames(body)   || "";

  // Technology & Pricing
  var technology  = body.technology  || body.techType     || getProp(body, "cartData.technology.item") || "";
  var quantity    = body.quantity    || body.qty          || 1;
  var unitPrice   = body.unitPrice   || body.unit_price   || "";
  var totalPrice  = body.totalPrice  || body.priceFormatted || body.price || "";
  var savings     = body.savings     || "₹ 0.00";
  var status      = body.status      || (body.isOrderConfirmation ? "Confirmed" : "Cart");
  var productSeq  = body.productSequence || body.productId || "";
  var imageUrl    = body.imagePreview|| body.preview      || "";

  var rawJson = "";
  try { rawJson = JSON.stringify(body); } catch(e) { rawJson = ""; }

  // Array formatting to clean strings
  if (Array.isArray(accessories)) accessories = accessories.join(", ");
  if (Array.isArray(iconNames))   iconNames   = iconNames.join(", ");

  var rowData = [
    dateStr, timeStr, orderId, userEmail, userName, productName,
    panelType, material, size, glassColor, frameColor, buttonColor,
    accessories, iconsCount, iconNames, technology, quantity,
    unitPrice, totalPrice, savings, status, productSeq, imageUrl, rawJson
  ];

  // Update existing row if orderId + productName match, otherwise append
  var existingRow = findExistingRow(sheet, orderId, productName);
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    Logger.log("Updated row " + existingRow + " for order " + orderId);
  } else {
    sheet.appendRow(rowData);
    Logger.log("Appended new row for order " + orderId);
  }

  autoFormatSheet(sheet);
  return jsonResponse({ success: true, orderId: orderId, action: existingRow > 0 ? "updated" : "created" });
}

function handleActivityData(ss, body) {
  var sheet = getOrCreateSheet(ss, SHEET_NAME_ACTIVITY, ACTIVITY_HEADERS);

  var nowObj    = new Date();
  var dateStr   = nowObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  var timeStr   = nowObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  var sessionId = body.sessionId   || body.session_id  || "";
  var userEmail = body.userEmail   || body.user_email  || body.email || "";
  var stepName  = body.stepName    || body.step        || "";
  var selection = body.selection   || body.value       || "";
  var details   = body.details     || "";
  var action    = body.action      || "selected";

  if (typeof details === "object") {
    try { details = JSON.stringify(details); } catch(e) { details = ""; }
  }

  sheet.appendRow([dateStr, timeStr, sessionId, userEmail, stepName, selection, details, action]);
  return jsonResponse({ success: true });
}

function handleUserActivity(ss, body) {
  var sheet = getOrCreateSheet(ss, SHEET_NAME_USERS, USER_HEADERS);

  var nowObj    = new Date();
  var dateStr   = nowObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  var timeStr   = nowObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  var userEmail = body.userEmail   || body.user_email  || body.email || "";
  var userName  = body.userName    || body.user_name   || body.name  || "";
  var action    = body.type        || "login";
  var session   = body.sessionId   || body.session     || "";

  sheet.appendRow([dateStr, timeStr, userEmail, userName, action, session]);
  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════════

function extractColorByType(body, keywords) {
  try {
    var colors = body.colorsList || getProp(body, "cartData.color") || [];
    if (typeof body.colors === "string" && body.colors) return body.colors;

    if (Array.isArray(colors)) {
      for (var i = 0; i < colors.length; i++) {
        var optType = (colors[i].optionType || "").toLowerCase();
        for (var k = 0; k < keywords.length; k++) {
          if (optType.indexOf(keywords[k]) !== -1) {
            var opts = colors[i].options || [];
            return opts.map(function(o) { return o.item; }).join(", ");
          }
        }
      }
    }
  } catch(e) {}
  return "";
}

function extractAccessories(body) {
  try {
    var cartData = body.cartData || {};
    var list = [...(cartData.accessories || []), ...(cartData.accessories1 || []), ...(cartData.accessories2 || []), ...(cartData.accessories3 || [])];
    return list.flatMap(function(a) { return (a.options || []).map(function(o) { return o.item; }); }).filter(Boolean).join(", ");
  } catch(e) { return ""; }
}

function extractIconsCount(body) {
  try {
    var dropped = body.dropped || getProp(body, "cartData.dropped") || [];
    return Array.isArray(dropped) ? String(dropped.length) : "0";
  } catch(e) { return "0"; }
}

function extractIconNames(body) {
  try {
    var dropped = body.dropped || getProp(body, "cartData.dropped") || [];
    if (Array.isArray(dropped)) {
      return dropped.map(function(ic) { return ic.title || ic.name || ic.id || "Icon"; }).join(", ");
    }
  } catch(e) { return ""; }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1976d2");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 160);
    }
    Logger.log("Created sheet with separate columns: " + name);
  } else {
    // Ensure header row matches latest headers
    var currentHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (currentHeader[0] !== headers[0] || currentHeader.length < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1976d2").setFontColor("#ffffff");
    }
  }
  return sheet;
}

function findExistingRow(sheet, orderId, productName) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(orderId) && String(data[i][5]) === String(productName)) {
      return i + 1;
    }
  }
  return -1;
}

function autoFormatSheet(sheet) {
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      for (var i = 2; i <= lastRow; i++) {
        var range = sheet.getRange(i, 1, 1, sheet.getLastColumn());
        range.setBackground(i % 2 === 0 ? "#f8f9ff" : "#ffffff");
      }
    }
  } catch(e) {}
}

function getProp(obj, path) {
  try {
    return path.split(".").reduce(function(o, k) { return o && o[k]; }, obj) || "";
  } catch(e) { return ""; }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
