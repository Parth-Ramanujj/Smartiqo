import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('./custom-cart-sync.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace restoreEditingStateOnLoad to ensure complete Redux state hydration & button label change
old_restore = text.find('function restoreEditingStateOnLoad()')
old_restore_end = text.find('// ─── Attach global click delegation for edit/delete buttons', old_restore)

if old_restore == -1 or old_restore_end == -1:
    print(f'ERROR: restoreEditingStateOnLoad section not found. old_restore={old_restore}, old_restore_end={old_restore_end}')
    sys.exit(1)

new_restore_code = r"""function restoreEditingStateOnLoad() {
    const editingId = localStorage.getItem('sc_editing_item_id');
    if (!editingId) return;

    const rawItemData = localStorage.getItem('sc_editing_item_data');
    if (!rawItemData) return;

    try {
        const item = JSON.parse(rawItemData);
        if (item && window.__store) {
            const store = window.__store;
            console.log('[CartSync] Restoring item into Configuration Wizard for editing:', editingId, item);

            // 1. Restore Step 1 to 7 panel configuration selections
            if (item.cartData) {
                store.dispatch({ type: 'cartData/setCartData', payload: item.cartData });
            }
            // 2. Restore Step 5 placed icons & positions
            if (item.dropped || item.droppedItems) {
                store.dispatch({ type: 'cartData/setDroppedItems', payload: item.dropped || item.droppedItems });
            }
            // 3. Restore Quantity
            if (item.quantity) {
                store.dispatch({ type: 'cartData/setQuantity', payload: item.quantity });
            }
            // 4. Set Active Step to Step 1 (Panel)
            store.dispatch({ type: 'cartData/setActiveStep', payload: 0 });
        }
    } catch(e) {
        console.warn('[CartSync] Error restoring editing item on load:', e);
    }

    // Update finish/save button text to "Update Item"
    setInterval(() => {
        const isStillEditing = !!localStorage.getItem('sc_editing_item_id');
        if (!isStillEditing) return;

        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (txt === 'add to cart' || txt === 'add to cart🛒') {
                btn.textContent = 'Update Item ✏️';
                btn.style.background = '#10B981';
                btn.style.color = '#ffffff';
            }
        });
    }, 500);
}

"""

text = text[:old_restore] + new_restore_code + text[old_restore_end:]

with open('./custom-cart-sync.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated restoreEditingStateOnLoad in custom-cart-sync.js!')
