def remove_blocks(file_path):
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    # Block 1
    str_to_replace = '}),(0,a.jsxs)("div",{className:"flex items-center gap-3 cursor-pointer select-none rounded-lg px-3 py-2 transition hover:bg-gray-100",role:"button",tabIndex:0,onClick:()=>{ee?(q((0,x.pm)({allowed:!0})),tz(!1)):t8()},onKeyDown:e=>{("Enter"===e.key||" "===e.key)&&(e.preventDefault(),ee?(q((0,x.pm)({allowed:!0})),tz(!1)):t8())},children:[(0,a.jsx)(tq,{checked:!!ee&&tE,disabled:!ee,onChange:e=>{e.stopPropagation(),ee&&(q((0,x.pm)({allowed:!0})),tz(!1))},inputProps:{"aria-label":ee?"Toggle Auto (AI) Mode":"Auto (AI) Mode coming soon"}}),(0,a.jsxs)("div",{className:"flex items-center gap-2",children:[(0,a.jsx)("span",{className:"text-xl font-semibold text-gray-800",children:"Auto (AI) Mode"}),ee?(0,a.jsx)("span",{className:"rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm",children:"Super Admin"}):(0,a.jsx)("span",{className:"rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm",children:"Coming soon"})]})]})'

    if str_to_replace in content:
        content = content.replace(str_to_replace, "})")
        print("Block 1 replaced successfully")
    else:
        print("Block 1 string mismatch")

    # Block 2
    target2 = '!ee&&tP&&(0,a.jsx)("div",{className:"px-4",children:(0,a.jsxs)("div",{className:"relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-700 p-[1px] shadow-2xl",children:[(0,a.jsx)("div",{className:"absolute -right-16 -top-20 h-44 w-44 rounded-full bg-white/15 blur-3xl"}),(0,a.jsx)("div",{className:"absolute -left-20 bottom-[-56px] h-44 w-44 rounded-full bg-blue-400/25 blur-3xl"}),(0,a.jsxs)("div",{className:"relative flex flex-col gap-4 rounded-2xl bg-white/95 p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between",children:[(0,a.jsxs)("div",{className:"flex items-start gap-3",children:[(0,a.jsx)("div",{className:"flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-700 text-white shadow-lg ring-2 ring-indigo-100",children:(0,a.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 24 24",className:"h-6 w-6",fill:"none",stroke:"currentColor",strokeWidth:"1.6",children:[(0,a.jsx)("rect",{x:"5",y:"5",width:"14",height:"14",rx:"3"}),(0,a.jsx)("path",{d:"M9 9h6v6H9z"}),(0,a.jsx)("path",{d:"M12 3v2M12 19v2M3 12h2M19 12h2M7 3v2M17 3v2M7 19v2M17 19v2M3 7h2M3 17h2M19 7h2M19 17h2"})]})}),(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)("p",{className:"text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600",children:"Auto (AI) Mode"}),(0,a.jsx)("p",{className:"text-lg font-semibold text-slate-900",children:"Coming soon"}),(0,a.jsx)("p",{className:"text-sm text-slate-600",children:"We\'re polishing AI-assisted layouts. For now, keep building with the manual designer - your current flow stays exactly the same."}),(0,a.jsx)("p",{className:"text-sm font-semibold text-slate-800",children:"Beta access will open to Premium users first."})]})]}),(0,a.jsxs)("div",{className:"flex flex-col items-start gap-2 sm:items-end",children:[(0,a.jsx)("span",{className:"rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm",children:"Coming soon"}),(0,a.jsx)("span",{className:"rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm",children:"Premium beta first"}),(0,a.jsx)("span",{className:"rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg",children:"Manual builder is live"}),(0,a.jsx)("button",{type:"button",onClick:t7,className:"mt-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50",children:"Hide this"})]})]})]})})'

    if target2 in content:
        content = content.replace(target2, "null")
        print("Block 2 replaced successfully")
    else:
        print("Block 2 string mismatch")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


remove_blocks("website-clone/_next/static/chunks/4998-5b09f1363ba04a04.js")
