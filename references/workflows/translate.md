# Multilingual Translation Workflow

> **Preread**: `references/image-processing.md` for translate parameters and language codes.

## Scenario

The user has an image containing text, such as a menu, road sign, or document screenshot, and needs it translated into a target language while preserving the original layout.

## Decision Flow

### 1. Confirm Target Language

Infer the `--lang` parameter from the user's request. See `references/image-processing.md` for language codes.

### 2. Single Language vs Multiple Languages

- **Single language**: run `image translate --lang xx -s` once.
- **Multiple language versions**: run the same image through different `--lang` values, using `--save-title` to distinguish outputs.

### 3. Multilingual Chaining Logic

```text
same input file -> run translate N times, each with a different --lang and --save-title
```

## Notes

- Processing can take longer, usually 10-60 seconds. Handle timeouts with the retry strategy.
- Text in the image must be clear enough for accurate recognition and translation.
