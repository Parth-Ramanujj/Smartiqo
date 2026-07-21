/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║          SmartiQo – Google Apps Script for Panel Order Tracking             ║
 * ║  Paste this entire file into: Google Sheet → Extensions → Apps Script       ║
 * ║  Then click: Deploy → New deployment → Web app → Execute as Me →           ║
 * ║  Anyone can access → Deploy → Copy the web app URL                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * SHEET STRUCTURE (auto-created on first request):
 *  Sheet 1: "Orders"         — One row per cart item / order
 *  Sheet 2: "User Activity"  — Step-by-step user journey tracking
 *  Sheet 3: "Users"          — Login/logout activity
 */

// ─── Configuration ─────────────────────────────────────────────────────────────
var SHEET_NAME_ORDERS   = "Orders";
var SHEET_NAME_ACTIVITY = "User Activity";
var SHEET_NAME_USERS    = "Users";

// ─── ORDERS sheet columns ──────────────────────────────────────────────────────
var ORDER_HEADERS = [
  "Timestamp",          // A: When the record was created
  "Order ID",           // B: Unique order identifier (ORD-XXXXXX)
  "User Email",         // C: User's email address
  "User Name",          // D: User's display name
  "Item Name",          // E: Product/Order name
  "Panel Type",         // F: Touch Panel / Edge / Color
  "Material",           // G: Material selection
  "Size / Module",      // H: Size or module count
  "Accessories",        // I: List of accessories chosen
  "Icons Count",        // J: Number of icons placed
  "Color Selections",   // K: Colors chosen per zone
  "Technology",         // L: Technology type
  "Quantity",           // M: Number of units
  "Unit Price (₹)",     // N: Price per unit
  "Total Price (₹)",    // O: Total price for this item
  "Status",             // P: In Cart / Ordered / Completed / Cancelled
  "Product Sequence",   // Q: Internal product code
  "Notes",              // R: Any extra notes
  "Image URL",          // S: Preview image URL (if available)
  "Raw JSON"            // T: Full item data as JSON (for reference)
];

// ─── USER ACTIVITY sheet columns ───────────────────────────────────────────────
var ACTIVITY_HEADERS = [
  "Timestamp",    // A
  "Session ID",   // B
  "User Email",   // C
  "Step",         // D: e.g. "1-Panel", "2-Material", "3-Size" ... "8-Cart"
  "Step Name",    // E: e.g. "Panel", "Material", "Size"
  "Selection",    // F: What the user selected
  "Details",      // G: Extra detail (JSON summary)
  "Action"        // H: selected / deselected / next / back / add_to_cart
];

// ─── USERS sheet columns ────────────────────────────────────────────────────────
var USER_HEADERS = [
  "Timestamp",    // A
  "User Email",   // B
  "User Name",    // C
  "Action",       // D: login / logout
  "IP / Session"  // E
];

// ══════════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ══════════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  // Allow reading all orders for display in the app
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
        // Filter by user if email provided
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

    // Fallback: try to detect type from fields
    if (body.orderId || body.panelType || body.cartData) {
      return handleOrderData(ss, body);
    }

    if (body.step || body.stepName) {
      return handleActivityData(ss, body);
    }

    return jsonResponse({ success: true, message: "Received but unrecognized type: " + type });

  } catch(err) {
    Logger.log("doPost error: " + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════════════════════════

function handleOrderData(ss, body) {
  var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ORDER_HEADERS);

  var now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  var orderId     = body.orderId     || body.order_id     || ("ORD-" + Date.now());
  var userEmail   = body.userEmail   || body.user_email   || body.email   || "";
  var userName    = body.userName    || body.user_name    || body.name    || "";
  var itemName    = body.itemName    || body.customProductName || body.orderName || "Custom Panel";
  var panelType   = body.panelType   || getProp(body, "cartData.panel.item")  || "";
  var material    = body.material    || getProp(body, "cartData.material.item") || "";
  var size        = body.size        || getProp(body, "cartData.size.item")   || "";
  var accessories = body.accessories || getProp(body, "cartData.accessories") || "";
  var iconsCount  = body.iconsCount  || body.icons_count  || "";
  var colors      = body.colors      || body.colorSelections || "";
  var technology  = body.technology  || getProp(body, "cartData.technology.item") || "";
  var quantity    = body.quantity    || 1;
  var unitPrice   = body.unitPrice   || body.unit_price   || "";
  var totalPrice  = body.totalPrice  || body.total_price  || "";
  var status      = body.status      || (body.isOrderConfirmation ? "Ordered" : "In Cart");
  var productSeq  = body.productSequence || body.product_sequence || "";
  var notes       = body.notes       || "";
  var imageUrl    = body.imageUrl    || body.image_url    || "";

  // Serialize accessories if array
  if (Array.isArray(accessories)) {
    accessories = accessories.map(function(a) {
      if (typeof a === "object") return (a.item || a.name || JSON.stringify(a));
      return String(a);
    }).join(", ");
  }

  // Serialize colors if array/object
  if (typeof colors === "object") {
    try { colors = JSON.stringify(colors); } catch(e) { colors = String(colors); }
  }

  var rawJson = "";
  try { rawJson = JSON.stringify(body); } catch(e) { rawJson = ""; }

  // Check if this orderId + itemName already exists (update instead of duplicate)
  var existingRow = findExistingRow(sheet, orderId, itemName);
  var rowData = [
    now, orderId, userEmail, userName, itemName,
    panelType, material, size, accessories, iconsCount,
    colors, technology, quantity, unitPrice, totalPrice,
    status, productSeq, notes, imageUrl, rawJson
  ];

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

  var now       = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  var sessionId = body.sessionId   || body.session_id  || "";
  var userEmail = body.userEmail   || body.user_email  || body.email || "";
  var step      = body.step        || "";
  var stepName  = body.stepName    || body.step_name   || "";
  var selection = body.selection   || body.value       || "";
  var details   = body.details     || "";
  var action    = body.action      || "selected";

  if (typeof details === "object") {
    try { details = JSON.stringify(details); } catch(e) { details = ""; }
  }
  if (typeof selection === "object") {
    try { selection = JSON.stringify(selection); } catch(e) { selection = String(selection); }
  }

  sheet.appendRow([now, sessionId, userEmail, step, stepName, selection, details, action]);
  return jsonResponse({ success: true });
}

function handleUserActivity(ss, body) {
  var sheet = getOrCreateSheet(ss, SHEET_NAME_USERS, USER_HEADERS);

  var now       = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  var userEmail = body.userEmail   || body.user_email  || body.email || "";
  var userName  = body.userName    || body.user_name   || body.name  || "";
  var action    = body.type        || "login";
  var session   = body.sessionId   || body.session     || "";

  sheet.appendRow([now, userEmail, userName, action, session]);
  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════════

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add bold header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1976d2");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    // Auto-resize columns
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 160);
    }
    Logger.log("Created sheet: " + name);
  }
  return sheet;
}

function findExistingRow(sheet, orderId, itemName) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(orderId) && String(data[i][4]) === String(itemName)) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

function autoFormatSheet(sheet) {
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Alternate row colors
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
