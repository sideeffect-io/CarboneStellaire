import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const productsRoot = path.join(repoRoot, "Products");
const translationsRoot = path.join(siteRoot, "src", "content", "i18n", "products");

const categoryCopy = {
  "le-sciotot": {
    label: "Le Sciotot",
    noun: "compact table or kitchen knife",
    sentence:
      "The range is shaped as a tribute to Sciotot beach in the north Cotentin, with a compact profile and a wave-like handle cutout."
  },
  "edge-of-space": {
    label: "Edge Of Space",
    noun: "table knife",
    sentence:
      "The range pairs a slim, elegant silhouette with forged steel, visible construction details, and carefully selected handle materials."
  },
  "cyber-edge": {
    label: "Cyber Edge",
    noun: "radical table or kitchen knife",
    sentence:
      "The range blends hand-forged steel with a sharper cybernetic vocabulary: resin, inserts, electronics-inspired details, and precise lines."
  },
  "scifi-legends": {
    label: "SciFi Legends",
    noun: "collector's knife",
    sentence:
      "This piece translates science-fiction references into a functional forged object, with each detail designed as part of the story."
  }
};

function categoryFor(handle) {
  if (handle.startsWith("le-sciotot")) return "le-sciotot";
  if (handle.startsWith("edge-of-space")) return "edge-of-space";
  if (handle.startsWith("cyber-edge")) return "cyber-edge";
  return "scifi-legends";
}

function parseProductMarkdown(raw) {
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const handle = raw.match(/^Handle:\s*`([^`]+)`/m)?.[1]?.trim();
  const price = raw.match(/^Price:\s*(.+)$/m)?.[1]?.trim();
  if (!title || !handle || !price) {
    throw new Error("Product markdown is missing title, handle, or price.");
  }
  return { title, handle, price };
}

function titleToEnglish(title) {
  return title
    .replaceAll("couteau à huitres", "oyster knife")
    .replaceAll("couteau à huîtres", "oyster knife")
    .replaceAll("Couteau de chef", "Chef knife")
    .replaceAll("Dague", "Dagger")
    .replaceAll("dague", "dagger")
    .replaceAll("pliant", "folding")
    .replaceAll("bois de fer", "ironwood")
    .replaceAll("Bois de fer", "Ironwood")
    .replaceAll("loupe", "burl")
    .replaceAll("Loupe", "Burl")
    .replaceAll("Erable", "Maple")
    .replaceAll("Érable", "Maple")
    .replaceAll("erable", "maple")
    .replaceAll("érable", "maple")
    .replaceAll("Chêne des marais", "bog oak")
    .replaceAll("Morta", "bog oak")
    .replaceAll("Noyer", "walnut")
    .replaceAll("Padouk", "padauk")
    .replaceAll("Wengé", "wenge")
    .replaceAll("Bouleau Madré", "curly birch")
    .replaceAll("Buis", "boxwood")
    .replaceAll("Frene", "ash")
    .replaceAll("Frêne", "ash")
    .replaceAll("Hêtre échauffé", "spalted beech")
    .replaceAll("Carbone", "carbon steel")
    .replaceAll("Inox", "stainless steel")
    .replaceAll("Damas", "damascus steel")
    .replaceAll("San Maï", "San Mai")
    .replaceAll("SanMaï", "San Mai")
    .replaceAll("NiMaï", "Ni Mai")
    .replaceAll("GoMaï", "Go Mai");
}

function inferNoun(handle, category) {
  if (handle.includes("pendentif")) return "pendant knife";
  if (handle.includes("huitres")) return "oyster knife";
  if (handle.includes("longboard")) return "longboard-style knife";
  if (handle.includes("pliant")) return "friction-folder knife";
  if (handle.includes("dague")) return "dagger";
  if (handle.includes("chef")) return "chef knife";
  return categoryCopy[category].noun;
}

function inferMaterials(title) {
  const lowered = title.toLowerCase();
  const materials = [];
  const candidates = [
    ["inox", "stainless steel"],
    ["carbone", "carbon steel"],
    ["damas", "damascus steel"],
    ["damax", "Damax stainless damascus"],
    ["san", "San Mai laminated steel"],
    ["nimai", "Ni Mai laminated steel"],
    ["gomai", "Go Mai laminated steel"],
    ["morta", "bog oak"],
    ["chêne", "bog oak"],
    ["erable", "maple"],
    ["érable", "maple"],
    ["wenge", "wenge"],
    ["wengé", "wenge"],
    ["padouk", "padauk"],
    ["bois de fer", "ironwood"],
    ["bouleau", "curly birch"],
    ["red heart", "redheart wood"],
    ["epoxy", "epoxy resin"],
    ["résine", "resin"],
    ["resine", "resin"],
    ["noyer", "walnut"],
    ["buis", "boxwood"],
    ["frene", "ash"],
    ["frêne", "ash"],
    ["if", "yew"],
    ["genevrier", "juniper"],
    ["génévrier", "juniper"],
    ["olivier", "olive burl"],
    ["cyprès", "cypress burl"],
    ["cypres", "cypress burl"],
    ["ébène", "ebony"],
    ["ebene", "ebony"]
  ];

  for (const [needle, label] of candidates) {
    if (lowered.includes(needle) && !materials.includes(label)) materials.push(label);
  }

  if (materials.length === 0) return "";
  return `This version highlights ${materials.slice(0, 4).join(", ")}.`;
}

async function main() {
  await mkdir(translationsRoot, { recursive: true });
  const folders = (await readdir(productsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  let created = 0;
  for (const folder of folders) {
    const raw = await readFile(path.join(productsRoot, folder, "index.md"), "utf8");
    const product = parseProductMarkdown(raw);
    const category = categoryFor(product.handle);
    const translatedTitle = titleToEnglish(product.title);
    const noun = inferNoun(product.handle, category);
    const materialSentence = inferMaterials(product.title);
    const filePath = path.join(translationsRoot, `${product.handle}.en.md`);
    const body = [
      "---",
      `title: ${JSON.stringify(translatedTitle)}`,
      "---",
      "",
      `A hand-forged ${noun} from the ${categoryCopy[category].label} range, made in the Carbone Stellaire workshop.`,
      "",
      categoryCopy[category].sentence,
      "",
      materialSentence,
      "",
      "Each piece is shaped, heat-treated, finished, and assembled by hand. Contact the workshop for availability, care advice, or a custom variation."
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeFile(filePath, body, "utf8");
      created += 1;
    }
  }

  console.log(`Product translation bootstrap complete. Created ${created} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
