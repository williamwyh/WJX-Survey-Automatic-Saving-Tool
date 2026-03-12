# WJX Helper (问卷星助手)

A Chrome extension that automates repetitive tasks in the Wenjuanxing (wjx.cn) survey management backend.

This tool helps users **batch process surveys**, automatically navigate statistics pages, flip pages, and export data without manual repetitive operations.

---

# Features

- Automatically search for surveys by name
- Automatically open the statistics page
- Automatically set page size to 100 records
- Automatically jump to the last page
- Automatically open survey details
- Automatically export survey data
- Batch process multiple survey tasks
- Skip surveys that cannot be found
- Continue with the next task automatically

---

# Example Workflow

```
Enter task list
↓
Search survey
↓
Open statistics page
↓
Jump to last page
↓
Export records
↓
Continue next survey
```

Example task list:

```
PB-17
PB-17-课后
PB-18
```

---

# Installation

## 1. Download the repository

Clone this repository:

```bash
git clone https://github.com/YOUR_USERNAME/wjx-helper.git
```

Or download the ZIP file.

---

## 2. Open Chrome Extensions

Go to:

```
chrome://extensions/
```

---

## 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

---

## 4. Load the Extension

Click:

```
Load unpacked
```

Then select the project folder:

```
wjx-helper/
```

The extension should now be installed.

---

# Usage

## 1. Open the Wenjuanxing dashboard

```
https://www.wjx.cn/myquestionnaires.aspx
```

---

## 2. Enter tasks

A control panel will appear in the **bottom-right corner of the page**.

Enter survey IDs (one per line).

Example:

```
PB-17
PB-17-课后
PB-18
```

---

## 3. Start automation

Click:

```
Save and Start All Tasks
```

The extension will automatically:

- Search the survey
- Open statistics
- Flip pages
- Export data
- Continue with the next survey

---

# Project Structure

```
wjx-helper
│
├── README.md
├── manifest.json
├── content.js
├── background.js
├── inject.js
└── popup.html
```

| File | Description |
|-----|-------------|
| manifest.json | Chrome extension configuration |
| content.js | Main automation script injected into the page |
| background.js | Background service worker |
| inject.js | Script injected into iframe for exporting data |
| popup.html | Extension popup interface |

---

# How It Works

The extension injects a **content script** into the Wenjuanxing dashboard and automates interactions with the page.

Main logic includes:

1. Reading the task list
2. Searching surveys automatically
3. Matching survey titles
4. Opening the statistics page
5. Changing page size
6. Navigating pages
7. Opening detail windows
8. Injecting scripts to export data

State persistence is handled with:

```
sessionStorage
localStorage
```

This allows the automation process to **resume correctly after page reloads**.

---

# Limitations

- Page structure changes may break the script
- Designed specifically for the Wenjuanxing statistics page
- Chrome browser only

---

# Development

After modifying the code, reload the extension at:

```
chrome://extensions/
```

Click:

```
Reload
```

to apply changes.

---

# License

MIT License

---

# Disclaimer

This project is intended for **personal productivity and educational purposes only**.

Please follow the terms of service of the Wenjuanxing platform when using automation tools.
