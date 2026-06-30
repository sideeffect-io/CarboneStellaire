let state = null;
let activeTab = "site";
let selectedCategoryId = null;
let selectedProductHandle = null;
let productUploads = [];

const panels = {
  site: document.querySelector("#panel-site"),
  categories: document.querySelector("#panel-categories"),
  products: document.querySelector("#panel-products"),
  deploy: document.querySelector("#panel-deploy")
};

const deployStatus = document.querySelector("#deploy-status");
const deployLog = document.querySelector("#deploy-log");
const previewLink = document.querySelector("#preview-link");

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function setMessage(element, text, kind = "") {
  element.textContent = text;
  element.dataset.kind = kind;
}

function updateDeploy(deploy = state?.deploy) {
  if (!deploy) return;
  deployStatus.textContent = deploy.status;
  deployLog.textContent = (deploy.log || []).join("\n");
  if (deploy.previewUrl) {
    previewLink.hidden = false;
    previewLink.href = deploy.previewUrl;
  } else {
    previewLink.hidden = true;
  }
}

async function refresh() {
  state = await api("/api/state");
  selectedCategoryId ||= state.categories[0]?.id;
  selectedProductHandle ||= state.products[0]?.handle;
  render();
  updateDeploy(state.deploy);
}

function render() {
  for (const [name, panel] of Object.entries(panels)) {
    panel.hidden = name !== activeTab;
  }
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === activeTab);
  });
  renderSite();
  renderCategories();
  renderProducts();
  renderDeployPanel();
}

function renderSectionEditor(section, locale) {
  const id = `section-${locale}-${section.id}`;
  return `
    <section class="section-editor" data-section-id="${section.id}">
      <label>
        <span>Titre</span>
        <input id="${id}-title" type="text" value="${escapeHtml(section.title)}" data-locale="${locale}" data-section-title="${section.id}" />
      </label>
      <label>
        <span>Markdown</span>
        <textarea id="${id}-body" rows="8" data-locale="${locale}" data-section-body="${section.id}">${escapeHtml(section.body)}</textarea>
      </label>
    </section>`;
}

function renderSite() {
  panels.site.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Source</p>
        <h2>Contenu du site</h2>
      </div>
      <button type="button" class="button button--primary" data-action="save-site">Enregistrer</button>
    </div>
    <label class="checkbox-line">
      <input type="checkbox" id="show-prices" ${state.site.showPrices ? "checked" : ""} />
      Afficher les prix sur le site public
    </label>
    <div class="grid grid--two form-band">
      <div>
        <div class="locale-title"><h3>Français</h3><span>${state.site.sections.fr.length} sections</span></div>
        <div class="grid">${state.site.sections.fr.map((section) => renderSectionEditor(section, "fr")).join("")}</div>
      </div>
      <div>
        <div class="locale-title"><h3>English</h3><span>${state.site.sections.en.length} sections</span></div>
        <div class="grid">${state.site.sections.en.map((section) => renderSectionEditor(section, "en")).join("")}</div>
      </div>
    </div>
    <p class="message" id="site-message"></p>
  `;
}

function selectedCategory() {
  if (!selectedCategoryId) return null;
  return state.categories.find((category) => category.id === selectedCategoryId) || state.categories[0];
}

function renderCategories() {
  const category = selectedCategory();
  panels.categories.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Catalogue</p>
        <h2>Gammes</h2>
      </div>
      <button type="button" class="button button--ghost" data-action="new-category">Nouvelle gamme</button>
    </div>
    <div class="grid grid--sidebar">
      <div class="list">
        ${state.categories
          .map(
            (item) => `
              <button type="button" class="${item.id === selectedCategoryId ? "is-selected" : ""}" data-category="${item.id}">
                ${escapeHtml(item.name)}
                <small>${escapeHtml(item.id)}${item.fallback ? " · fallback" : ""}</small>
              </button>`
          )
          .join("")}
      </div>
      <form class="grid" id="category-form">
        <div class="grid grid--two">
          <label><span>ID</span><input name="id" value="${escapeHtml(category?.id || "")}" ${category ? "readonly" : ""} /></label>
          <label><span>Préfixe de handle</span><input name="prefix" value="${escapeHtml(category?.prefix || "")}" /></label>
          <label><span>Nom</span><input name="name" value="${escapeHtml(category?.name || "")}" /></label>
          <label class="checkbox-line"><input type="checkbox" name="fallback" ${category?.fallback ? "checked" : ""} /> Fallback</label>
        </div>
        <div class="grid grid--two">
          <label><span>Résumé FR</span><textarea name="shortFr" rows="4">${escapeHtml(category?.short.fr || "")}</textarea></label>
          <label><span>Summary EN</span><textarea name="shortEn" rows="4">${escapeHtml(category?.short.en || "")}</textarea></label>
          <label><span>Histoire FR</span><textarea name="detailFr" rows="10">${escapeHtml(category?.detail.fr || "")}</textarea></label>
          <label><span>Story EN</span><textarea name="detailEn" rows="10">${escapeHtml(category?.detail.en || "")}</textarea></label>
        </div>
        <div class="toolbar">
          <button type="submit" class="button button--primary">${category ? "Enregistrer la gamme" : "Créer la gamme"}</button>
          <p class="message" id="category-message"></p>
        </div>
      </form>
    </div>
  `;
}

function selectedProduct() {
  if (!selectedProductHandle) return null;
  return state.products.find((product) => product.handle === selectedProductHandle) || state.products[0];
}

function suggestedHandle(title, categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  const titleSlug = slugify(title);
  if (!category?.prefix) return titleSlug;
  if (!titleSlug) return `${category.prefix}-`;
  return titleSlug.startsWith(category.prefix) ? titleSlug : `${category.prefix}-${titleSlug}`;
}

function renderProducts() {
  const product = selectedProduct();
  const isNew = !product;
  panels.products.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Catalogue</p>
        <h2>Couteaux</h2>
      </div>
      <button type="button" class="button button--ghost" data-action="new-product">Nouveau couteau</button>
    </div>
    <div class="grid grid--sidebar">
      <div class="list">
        ${state.products
          .map(
            (item) => `
              <button type="button" class="${item.handle === selectedProductHandle ? "is-selected" : ""}" data-product="${item.handle}">
                ${escapeHtml(item.title.fr)}
                <small>${escapeHtml(item.handle)}</small>
              </button>`
          )
          .join("")}
      </div>
      <form class="grid" id="product-form">
        <div class="grid grid--two">
          <label><span>Gamme</span>
            <select name="category">
              ${state.categories.map((category, index) => `<option value="${category.id}" ${category.id === product?.category || (isNew && index === 0) ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}
            </select>
          </label>
          <label><span>Handle</span><input name="handle" value="${escapeHtml(product?.handle || "")}" ${isNew ? "" : "readonly"} /></label>
          <label><span>Titre FR</span><input name="titleFr" value="${escapeHtml(product?.title.fr || "")}" /></label>
          <label><span>Title EN</span><input name="titleEn" value="${escapeHtml(product?.title.en || "")}" /></label>
          <label><span>Prix</span><input name="price" value="${escapeHtml(product?.price || "")}" placeholder="000.00 EUR TTC" /></label>
        </div>
        <div class="grid grid--two">
          <label><span>Description FR</span><textarea name="descriptionFr" rows="12">${escapeHtml(product?.description.fr || "")}</textarea></label>
          <label><span>Description EN</span><textarea name="descriptionEn" rows="12">${escapeHtml(product?.description.en || "")}</textarea></label>
        </div>
        <div class="grid grid--two">
          <label><span>Images publiées, dans l'ordre</span><textarea name="images" rows="7">${escapeHtml((product?.images || []).join("\n"))}</textarea></label>
          <label><span>Ajouter des images</span><input name="uploads" type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" /><textarea name="uploadList" rows="4" readonly>${escapeHtml(productUploads.map((file) => file.filename).join("\n"))}</textarea></label>
        </div>
        <div class="toolbar">
          <button type="submit" class="button button--primary">${isNew ? "Créer le couteau" : "Enregistrer le couteau"}</button>
          <p class="message" id="product-message"></p>
        </div>
      </form>
    </div>
  `;
}

function renderDeployPanel() {
  panels.deploy.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Build</p>
        <h2>Déploiement local</h2>
      </div>
      <button type="button" class="button button--primary" data-action="deploy">Déployer localement</button>
    </div>
    <div class="notice">
      <strong>Pipeline:</strong> validate:content, build, preview local.
    </div>
  `;
}

function collectSections(locale) {
  return [...panels.site.querySelectorAll(`[data-locale="${locale}"][data-section-title]`)].map((input) => {
    const id = input.dataset.sectionTitle;
    const body = panels.site.querySelector(`[data-locale="${locale}"][data-section-body="${id}"]`);
    return { title: input.value, body: body.value };
  });
}

async function saveSite() {
  const message = document.querySelector("#site-message");
  try {
    const payload = {
      showPrices: document.querySelector("#show-prices").checked,
      sections: { fr: collectSections("fr"), en: collectSections("en") }
    };
    const result = await api("/api/site", { method: "PUT", body: JSON.stringify(payload) });
    state.site = result.site;
    setMessage(message, "Contenu enregistré.", "ok");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const field = (name) => form.elements.namedItem(name);
  const message = document.querySelector("#category-message");
  const payload = {
    id: field("id").value,
    prefix: field("prefix").value,
    name: field("name").value,
    fallback: field("fallback").checked,
    short: { fr: field("shortFr").value, en: field("shortEn").value },
    detail: { fr: field("detailFr").value, en: field("detailEn").value }
  };
  try {
    const isNew = !selectedCategoryId;
    const result = await api(isNew ? "/api/categories" : `/api/categories/${selectedCategoryId}`, {
      method: isNew ? "POST" : "PUT",
      body: JSON.stringify(payload)
    });
    state = result.state;
    selectedCategoryId = result.category.id;
    render();
    setMessage(document.querySelector("#category-message"), "Gamme enregistrée.", "ok");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

function readFiles(files) {
  return Promise.all(
    [...files].map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ filename: file.name, dataBase64: reader.result });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const field = (name) => form.elements.namedItem(name);
  const message = document.querySelector("#product-message");
  const isNew = !selectedProductHandle;
  const payload = {
    handle: field("handle").value,
    categoryId: field("category").value,
    title: { fr: field("titleFr").value, en: field("titleEn").value },
    price: field("price").value,
    description: { fr: field("descriptionFr").value, en: field("descriptionEn").value },
    images: field("images").value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    uploads: productUploads
  };
  try {
    const result = await api(isNew ? "/api/products" : `/api/products/${selectedProductHandle}`, {
      method: isNew ? "POST" : "PUT",
      body: JSON.stringify(payload)
    });
    state = result.state;
    selectedProductHandle = result.product.handle;
    productUploads = [];
    render();
    setMessage(document.querySelector("#product-message"), "Couteau enregistré.", "ok");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

async function deploy() {
  await api("/api/deploy/local", { method: "POST", body: "{}" });
  await pollDeploy();
}

async function pollDeploy() {
  const result = await api("/api/deploy/status");
  state.deploy = result.deploy;
  updateDeploy(result.deploy);
  if (result.deploy.running) setTimeout(pollDeploy, 1600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    activeTab = tab.dataset.tab;
    render();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "refresh") await refresh();
  if (action === "save-site") await saveSite();
  if (action === "deploy") await deploy();
  if (action === "new-category") {
    selectedCategoryId = null;
    render();
  }
  if (action === "new-product") {
    selectedProductHandle = null;
    productUploads = [];
    render();
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    selectedCategoryId = categoryButton.dataset.category;
    render();
  }

  const productButton = event.target.closest("[data-product]");
  if (productButton) {
    selectedProductHandle = productButton.dataset.product;
    productUploads = [];
    render();
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id === "category-form") await saveCategory(event);
  if (event.target.id === "product-form") await saveProduct(event);
});

document.addEventListener("input", (event) => {
  const form = event.target.closest("#product-form");
  if (!form || selectedProductHandle) return;
  if (event.target.name === "titleFr" || event.target.name === "category") {
    form.elements.namedItem("handle").value = suggestedHandle(
      form.elements.namedItem("titleFr").value,
      form.elements.namedItem("category").value
    );
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.name !== "uploads") return;
  const form = event.target.closest("#product-form");
  const uploads = await readFiles(event.target.files);
  productUploads = [...productUploads, ...uploads];
  const filenames = new Set(
    form.elements.namedItem("images").value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  for (const upload of uploads) filenames.add(upload.filename);
  form.elements.namedItem("images").value = [...filenames].join("\n");
  form.elements.namedItem("uploadList").value = productUploads.map((file) => file.filename).join("\n");
});

refresh().catch((error) => {
  deployLog.textContent = error.message;
});
