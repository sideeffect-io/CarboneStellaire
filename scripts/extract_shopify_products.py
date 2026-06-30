#!/usr/bin/env python3
import argparse
import csv
import mimetypes
import re
import sys
import tempfile
import urllib.request
from collections import OrderedDict
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


BLOCK_TAGS = {
    "address",
    "article",
    "aside",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul",
}

IGNORED_TAGS = {"script", "style"}


class PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in IGNORED_TAGS:
            self.ignored_depth += 1
            return
        if tag == "br":
            self._newline()
        elif tag == "li":
            self._newline()
            self.parts.append("- ")
        elif tag in BLOCK_TAGS:
            self._newline()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in IGNORED_TAGS and self.ignored_depth:
            self.ignored_depth -= 1
            return
        if tag in BLOCK_TAGS:
            self._newline()

    def handle_data(self, data: str) -> None:
        if self.ignored_depth:
            return
        text = re.sub(r"\s+", " ", unescape(data)).strip()
        if not text:
            return
        if self.parts and not self.parts[-1].endswith(("\n", " ", "- ")):
            self.parts.append(" ")
        self.parts.append(text)

    def _newline(self) -> None:
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = [line.strip() for line in raw.splitlines()]
        compact_lines: list[str] = []
        last_blank = False
        for line in lines:
            if not line:
                if compact_lines and not last_blank:
                    compact_lines.append("")
                last_blank = True
                continue
            compact_lines.append(line)
            last_blank = False
        return "\n\n".join(line for line in compact_lines if line)


@dataclass
class ImageEntry:
    url: str
    position: int | None
    row_number: int
    filename: str = ""


@dataclass
class Product:
    handle: str
    title: str = ""
    body_html: str = ""
    price: str = ""
    images: list[ImageEntry] = field(default_factory=list)
    image_urls: set[str] = field(default_factory=set)


def html_to_text(html: str) -> str:
    parser = PlainTextParser()
    parser.feed(html or "")
    parser.close()
    return parser.text()


def parse_int(value: str) -> int | None:
    try:
        return int(float(value.strip()))
    except (TypeError, ValueError, AttributeError):
        return None


def image_extension(url: str, content_type: str | None = None) -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix and re.fullmatch(r"\.[a-z0-9]{2,6}", suffix):
        return suffix

    if content_type:
        mime = content_type.split(";", 1)[0].strip().lower()
        guessed = mimetypes.guess_extension(mime)
        if guessed:
            return guessed

    return ".jpg"


def read_products(csv_path: Path) -> OrderedDict[str, Product]:
    products: OrderedDict[str, Product] = OrderedDict()
    with csv_path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required = ["Handle", "Title", "Body (HTML)", "Variant Price", "Image Src", "Image Position"]
        missing = [column for column in required if column not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        for row_number, row in enumerate(reader, start=2):
            handle = (row.get("Handle") or "").strip()
            if not handle:
                continue

            product = products.setdefault(handle, Product(handle=handle))
            if not product.title and (row.get("Title") or "").strip():
                product.title = (row.get("Title") or "").strip()
            if not product.body_html and (row.get("Body (HTML)") or "").strip():
                product.body_html = (row.get("Body (HTML)") or "").strip()
            if not product.price and (row.get("Variant Price") or "").strip():
                product.price = (row.get("Variant Price") or "").strip()

            image_url = (row.get("Image Src") or "").strip()
            if image_url and image_url not in product.image_urls:
                product.image_urls.add(image_url)
                product.images.append(
                    ImageEntry(
                        url=image_url,
                        position=parse_int(row.get("Image Position") or ""),
                        row_number=row_number,
                    )
                )

    return products


def sorted_images(product: Product) -> list[ImageEntry]:
    return sorted(
        product.images,
        key=lambda image: (
            image.position is None,
            image.position if image.position is not None else image.row_number,
            image.row_number,
        ),
    )


def download_image(url: str, destination_without_extension: Path) -> Path:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyExportExtractor/1.0)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        content_type = response.headers.get("Content-Type")
        extension = image_extension(url, content_type)
        destination = destination_without_extension.with_suffix(extension)
        with tempfile.NamedTemporaryFile(delete=False, dir=destination.parent) as tmp_file:
            tmp_path = Path(tmp_file.name)
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                tmp_file.write(chunk)
        tmp_path.replace(destination)
    return destination


def markdown_for(product: Product) -> str:
    description = html_to_text(product.body_html)
    lines = [f"# {product.title or product.handle}", ""]
    lines.append(f"Handle: `{product.handle}`")
    if product.price:
        lines.append(f"Price: {product.price} EUR TTC")
    lines.append("")

    lines.append("## Description")
    lines.append("")
    lines.append(description or "_No description found in the Shopify export._")
    lines.append("")

    lines.append("## Images")
    lines.append("")
    if product.images:
        for index, image in enumerate(sorted_images(product), start=1):
            lines.append(f"{index}. `{image.filename}`")
    else:
        lines.append("_No images found in the Shopify export._")
    lines.append("")
    return "\n".join(lines)


def extract(csv_path: Path, output_root: Path) -> tuple[int, int]:
    products = read_products(csv_path)
    total_images = 0
    failures: list[str] = []

    for product in products.values():
        product_dir = output_root / product.handle
        product_dir.mkdir(parents=True, exist_ok=True)

        for index, image in enumerate(sorted_images(product), start=1):
            base_name = product_dir / f"image-{index:03d}"
            try:
                downloaded = download_image(image.url, base_name)
                image.filename = downloaded.name
                total_images += 1
            except Exception as exc:
                failures.append(f"{product.handle}: {image.url} ({exc})")
                image.filename = f"{base_name.name}{image_extension(image.url)}"

        (product_dir / "index.md").write_text(markdown_for(product), encoding="utf-8")

    if failures:
        for failure in failures:
            print(f"Download failed: {failure}", file=sys.stderr)
        raise RuntimeError(f"{len(failures)} image download(s) failed")

    return len(products), total_images


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract Shopify products into per-handle folders.")
    parser.add_argument("--csv", type=Path, default=Path("Products/Products.csv"))
    parser.add_argument("--output", type=Path, default=Path("Products"))
    args = parser.parse_args()

    if not args.csv.exists():
        raise FileNotFoundError(args.csv)

    product_count, image_count = extract(args.csv, args.output)
    print(f"Extracted {product_count} products and downloaded {image_count} images into {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
