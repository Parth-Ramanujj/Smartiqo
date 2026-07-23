import re

js_path = 'custom-cart-sync.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

target = 'btn.getAttribute("aria-label") === "edit item"'
replacement = '(btn.getAttribute("aria-label") || "").toLowerCase() === "edit item" || (btn.getAttribute("title") || "").toLowerCase() === "edit item"'

if target in js_content:
    new_js = js_content.replace(target, replacement)
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(new_js)
    print("Fixed custom-cart-sync.js aria-label check")
else:
    print("Target not found.")
