import os


def remove_ai_mode_html(file_path):
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    # Block 1: Toggle
    start_str1 = '<div class="flex items-center gap-3 cursor-pointer select-none rounded-lg px-3 py-2 transition hover:bg-gray-100" role="button" tabindex="0">'
    idx1 = content.find(start_str1)
    if idx1 != -1 and "Auto (AI) Mode" in content[idx1 : idx1 + 1500]:
        idx_ai = content.find("Auto (AI) Mode", idx1)
        if idx_ai != -1:
            idx_end = content.find("</div></div></div>", idx_ai)
            if idx_end != -1:
                content = content[:idx1] + content[idx_end + 18 :]
                print(f"Removed Toggle from {file_path}")

    # Block 2: Banner
    start_str2 = '<div class="px-4"><div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-700 p-[1px] shadow-2xl">'
    idx2 = content.find(start_str2)
    if idx2 != -1 and "Auto (AI) Mode" in content[idx2 : idx2 + 2000]:
        idx_end2 = content.find("Hide this</button></div></div></div></div>", idx2)
        if idx_end2 != -1:
            content = content[:idx2] + content[idx_end2 + 42 :]
            print(f"Removed Banner from {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


for f in ["index.html", "pages/vdplshop.in_Dashboards_userDashboard.html"]:
    if os.path.exists(f):
        remove_ai_mode_html(f)
