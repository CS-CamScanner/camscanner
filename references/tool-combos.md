# Tool Combination Quick Reference

## Basic Combinations

| User Need | Recommended Command | Notes |
|-----------|---------------------|-------|
| Recognize text in an image | `image ocr photo.jpg` | Prints to terminal |
| Convert one image to a document | `image convert photo.jpg --format word -s` | Saves to cloud |
| Convert multiple images to a document | `image merge-word "page1.jpg" "page2.jpg" "page3.jpg" -s` | Multi-page merge; list files explicitly |
| Convert PDF to editable format | `pdf convert doc.pdf --format word -s` | |
| Improve a photo | `image hd blurry.jpg -s` | |
| Protect a document | `pdf watermark file.pdf --text "CONFIDENTIAL" -s` | |

## Multi-Step Combinations

### Merge Batch Scans into a PDF

```bash
# Step 1: merge multiple scans into a PDF and save to cloud.
camscanner-cli image merge-pdf scan_001.jpg scan_002.jpg scan_003.jpg -s
```

### Extract Table Data from Images into Excel

```bash
# Step 1: merge multiple table images into Excel.
camscanner-cli image merge-excel table_page1.jpg table_page2.jpg -s
```

### Add Watermark Protection Before Sharing a Document

```bash
# Step 1: add a watermark to the PDF.
camscanner-cli pdf watermark contract.pdf --text "INTERNAL USE ONLY" -s --save-title "Contract-Watermarked"
```

### Multilingual Document Translation Workflow

```bash
# Step 1: translate text in the image while preserving the original layout.
camscanner-cli image translate document.jpg --lang en -s --save-title "Translation-English"
```

### Convert After OCR Extraction

```bash
# Option 1: convert directly to Markdown. Recommended because it preserves structure.
camscanner-cli image convert document.jpg --format md -s

# Option 2: extract plain text with OCR, then save as Word.
camscanner-cli image ocr document.jpg > extracted.txt
camscanner-cli txt to-word extracted.txt -s --save-title "OCR Extraction Result"
```

### Split a PDF into Individual Images

```bash
# Split into an image directory.
camscanner-cli pdf to-images report.pdf -d ./pages

# Or split into a ZIP package.
camscanner-cli pdf to-images-zip report.pdf -o report_pages.zip
```

### Image Authenticity Check

```bash
# Detect Photoshop/tampering.
camscanner-cli image validate suspect.jpg --mode 1

# Detect AI-generated content.
camscanner-cli image validate ai_photo.jpg --mode 2
```

### Image Text Editing: Replace, Delete, or Move

```bash
# Step 1: scan layout structure and character indexes.
camscanner-cli image scan document.jpg

# Step 2: locate start_char_idx and end_char_idx for the target text in the JSON returned by scan.
# Search in result.document_info.sections[].columns[].paragraphs[].lines[].characters.

# Step 3: execute the edit. This example replaces text.
camscanner-cli image edit \
  --input-image "<result.urls.input_image>" \
  --document-info "<result.urls.document_info>" \
  --edit-request '{"edit_type":"update","start_char_idx":39,"end_char_idx":42,"target_text":"West"}' \
  -o edited.jpg
```

## Scenario Mapping

| Scenario | Best Approach |
|----------|---------------|
| Meeting whiteboard photo -> editable document | `image convert whiteboard.jpg --format word -s` |
| Paper scans -> Markdown | `image merge-text "page1.jpg" "page2.jpg" --format md -o paper.md` or `image convert --format md -s` |
| Invoice photo -> Excel spreadsheet | `image convert invoice.jpg --format excel -s` |
| Contract PDF -> editable Word document | `pdf convert contract.pdf --format word -s` |
| Business card photo -> text extraction | `image ocr namecard.jpg` |
| Foreign-language menu -> Chinese translation | `image translate menu.jpg --lang zh -s` |
| Handwritten notes -> electronic document | `image enhance notes.jpg --mode 9 -o clean.jpg`, then `image convert clean.jpg --format word -s` |
| Blurry ID photo -> higher clarity | `image hd id_photo.jpg -s` |
| Old photo restoration | `image restore vintage.jpg -s` |
| Multi-page exam paper -> merged PDF | `image merge-pdf q1.jpg q2.jpg q3.jpg -s` |
