import glob


def inject_script():
    base_dir = "D:/vdplshop/website-clone"
    html_files = glob.glob(f"{base_dir}/**/*.html", recursive=True)

    script_tag = '<script src="/custom-cart-sync.js"></script>'

    for file_path in html_files:
        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        if script_tag not in content and "</body>" in content:
            new_content = content.replace("</body>", f"{script_tag}</body>")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Injected into {file_path}")
        else:
            print(f"Skipped {file_path}")


if __name__ == "__main__":
    inject_script()
