(() => {
  "use strict";

  const authScreen = document.getElementById("auth-screen");
  const authFeedback = document.getElementById("auth-feedback");
  const authDemoNote = document.querySelector(".auth-demo-note");
  const authDescription = document.querySelector(".auth-description");
  const signInTab = document.getElementById("sign-in-tab");
  const createAccountTab = document.getElementById("create-account-tab");
  const signInForm = document.getElementById("sign-in-panel");
  const createAccountForm = document.getElementById("create-account-panel");
  const appMain = document.querySelector("main");
  const appFooter = document.getElementById("site-footer");
  const navigation = document.querySelector(".main-navigation");
  const headerAccount = document.getElementById("header-account");
  const accountGreeting = document.getElementById("account-greeting");
  const signOutButton = document.getElementById("sign-out");
  const sessionKey = "colormybook-demo-session";
  const ordersKey = "colormybook-demo-orders";
  const apiBaseSetting = window.COLOR_MY_BOOK_API_BASE || "";
  let apiBaseUrl = "";
  let apiConfigurationError = "";
  let signedInUser = null;
  let ordersRenderVersion = 0;

  if (apiBaseSetting) {
    try {
      const parsedApiBase = new URL(apiBaseSetting);
      const isLocalDevelopment =
        parsedApiBase.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsedApiBase.hostname);
      if ((parsedApiBase.protocol !== "https:" && !isLocalDevelopment) ||
          parsedApiBase.username ||
          parsedApiBase.password ||
          parsedApiBase.search ||
          parsedApiBase.hash) {
        throw new Error("The account API must use HTTPS.");
      }
      apiBaseUrl = parsedApiBase.href.replace(/\/+$/, "");
    } catch (error) {
      apiConfigurationError = "The account API URL must be a valid HTTPS address.";
      console.error("ColorMyBook has an invalid account API configuration.", error);
    }
  }

  // Configure window.COLOR_MY_BOOK_API_BASE before this script. Use HTTPS,
  // HttpOnly cookie sessions, and server-priced order items.
  async function apiRequest(path, options = {}) {
    if (!apiBaseUrl) {
      throw new Error(apiConfigurationError || "The account service is not configured.");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("The account service took too long to respond. Please try again.");
      }
      throw new Error("We couldn't reach the account service. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeoutId);
    }

    let responseData = null;
    const responseText = await response.text();
    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch (error) {
        console.error("ColorMyBook received an invalid response from its account service.", error);
        if (response.ok) {
          throw new Error("The account service returned an unreadable response. Please try again.");
        }
      }
    }

    if (!response.ok) {
      const error = new Error(
        typeof responseData?.message === "string"
          ? responseData.message
          : "We couldn't complete that request. Please check your details and try again."
      );
      error.status = response.status;
      throw error;
    }

    return responseData;
  }

  function normalizeApiUser(responseData) {
    const user = responseData?.user || responseData;
    if (!user || typeof user.email !== "string" || !user.email.includes("@")) {
      throw new Error("The account service returned an invalid user profile.");
    }
    return {
      email: user.email.trim().toLowerCase(),
      name: typeof user.name === "string" && user.name.trim()
        ? user.name.trim().slice(0, 80)
        : user.email.split("@")[0]
    };
  }

  function showAuthFeedback(message) {
    if (!authFeedback) return;
    authFeedback.textContent = message;
    authFeedback.hidden = false;
  }

  function setFormBusy(form, isBusy) {
    if (!(form instanceof HTMLFormElement)) return;
    form.setAttribute("aria-busy", String(isBusy));
    form.querySelectorAll("button[type='submit']").forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function setAuthBusy(isBusy) {
    setFormBusy(signInForm, isBusy);
    setFormBusy(createAccountForm, isBusy);
    if (signInTab) signInTab.disabled = isBusy;
    if (createAccountTab) createAccountTab.disabled = isBusy;
  }

  function setAuthTab(tabName) {
    const showingSignIn = tabName === "sign-in";
    signInTab?.classList.toggle("is-active", showingSignIn);
    signInTab?.setAttribute("aria-selected", String(showingSignIn));
    createAccountTab?.classList.toggle("is-active", !showingSignIn);
    createAccountTab?.setAttribute("aria-selected", String(!showingSignIn));
    if (signInForm) signInForm.hidden = !showingSignIn;
    if (createAccountForm) createAccountForm.hidden = showingSignIn;
    if (authFeedback) authFeedback.hidden = true;
  }

  function showStore(user) {
    signedInUser = user;
    if (authScreen) authScreen.hidden = true;
    if (appMain) appMain.hidden = false;
    if (appFooter) appFooter.hidden = false;
    if (navigation) navigation.hidden = false;
    if (headerAccount) headerAccount.hidden = false;
    const cartElement = document.getElementById("cart");
    if (cartElement) cartElement.hidden = false;
    if (accountGreeting) accountGreeting.textContent = `Hi, ${user.name}`;
    if (authDemoNote) {
      authDemoNote.textContent = apiBaseUrl
        ? "Your account is connected securely. Passwords are sent only to the HTTPS account service and are never saved in this browser."
        : "Front-end demo only: no server account is created, and passwords are never stored.";
    }
    if (authDescription) {
      authDescription.textContent = apiBaseUrl
        ? "Sign in or create an account to browse the collection and place an order."
        : "Sign in or create a demo account to explore the books and place a sample order.";
    }
    void renderOrders();
  }

  function showAuth() {
    signedInUser = null;
    ordersRenderVersion += 1;
    if (authScreen) authScreen.hidden = false;
    if (appMain) appMain.hidden = true;
    if (appFooter) appFooter.hidden = true;
    if (navigation) navigation.hidden = true;
    if (headerAccount) headerAccount.hidden = true;
    const cartElement = document.getElementById("cart");
    if (cartElement) cartElement.hidden = true;
    const cartPanel = document.getElementById("cart-panel");
    if (cartPanel) cartPanel.hidden = true;
    cartElement?.setAttribute("aria-expanded", "false");
    if (authDemoNote) {
      authDemoNote.textContent = apiBaseUrl
        ? "Sign-in uses the secure account service. Passwords are never saved in this browser."
        : "Front-end demo only: no server account is created, and passwords are never stored.";
    }
    if (authDescription) {
      authDescription.textContent = apiBaseUrl
        ? "Sign in or create an account to browse the collection and place an order."
        : "Sign in or create a demo account to explore the books and place a sample order.";
    }
    if (authFeedback) authFeedback.hidden = true;
    setAuthTab("sign-in");
    document.getElementById("sign-in-email")?.focus();
  }

  function saveSession(user) {
    signInForm?.reset();
    createAccountForm?.reset();

    if (apiBaseUrl) {
      showStore(user);
      return;
    }

    try {
      window.sessionStorage.setItem(sessionKey, JSON.stringify(user));
    } catch (error) {
      console.error("ColorMyBook could not save the demo session.", error);
      showMessage("You're signed in for now, but this browser couldn't remember your demo session.");
    }
    showStore(user);
  }

  signInTab?.addEventListener("click", () => setAuthTab("sign-in"));
  createAccountTab?.addEventListener("click", () => setAuthTab("create-account"));

  signInForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!signInForm.reportValidity()) return;
    const formData = new FormData(signInForm);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!email || email.length > 254 || password.length < 8 || password.length > 128) {
      if (authFeedback) {
        authFeedback.textContent = "Enter a valid email and a password between 8 and 128 characters.";
        authFeedback.hidden = false;
      }
      return;
    }
    if (!apiBaseUrl && apiConfigurationError) {
      showAuthFeedback(apiConfigurationError);
      return;
    }
    if (!apiBaseUrl) {
      saveSession({ email, name: email.split("@")[0] || "Reader" });
      return;
    }

    setAuthBusy(true);
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }).then((responseData) => {
      saveSession(normalizeApiUser(responseData));
    }).catch((error) => {
      console.error("ColorMyBook sign-in request failed.", error);
      document.getElementById("sign-in-password").value = "";
      showAuthFeedback(error.message || "We couldn't sign you in. Please try again.");
    }).finally(() => setAuthBusy(false));
  });

  createAccountForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!createAccountForm.reportValidity()) return;
    const formData = new FormData(createAccountForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!name || name.length > 80 || !email || email.length > 254 ||
        password.length < 8 || password.length > 128) {
      if (authFeedback) {
        authFeedback.textContent = "Please enter your name, a valid email, and a password between 8 and 128 characters.";
        authFeedback.hidden = false;
      }
      return;
    }
    if (!apiBaseUrl && apiConfigurationError) {
      showAuthFeedback(apiConfigurationError);
      return;
    }
    if (!apiBaseUrl) {
      saveSession({ email, name });
      return;
    }

    setAuthBusy(true);
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    }).then((responseData) => {
      saveSession(normalizeApiUser(responseData));
    }).catch((error) => {
      console.error("ColorMyBook account creation request failed.", error);
      document.getElementById("create-password").value = "";
      showAuthFeedback(error.message || "We couldn't create your account. Please try again.");
    }).finally(() => setAuthBusy(false));
  });

  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      if (apiBaseUrl) {
        await apiRequest("/auth/logout", { method: "POST" });
      } else {
        window.sessionStorage.removeItem(sessionKey);
      }
      showAuth();
    } catch (error) {
      console.error("ColorMyBook sign-out request failed.", error);
      showMessage(error.message || "We couldn't sign you out. Please try again.");
    } finally {
      signOutButton.disabled = false;
    }
  });

  async function restoreApiSession() {
    try {
      const responseData = await apiRequest("/auth/session");
      showStore(normalizeApiUser(responseData));
    } catch (error) {
      if (error.status === 401) {
        showAuth();
        return;
      }
      console.error("ColorMyBook could not restore the backend session.", error);
      showAuthFeedback(error.message || "We couldn't check your sign-in. Please try again.");
    }
  }

  const cartLink = document.getElementById("cart");
  const cartCount = cartLink?.querySelector(".cart-count");
  const header = document.querySelector(".site-header");

  if (!cartLink || !cartCount || !header) {
    console.error("ColorMyBook cart could not start because its header or cart markup is missing.");
    return;
  }

  const storageKey = "colormybook-cart";
  const products = new Map();
  const cart = new Map();
  let storageAvailable = true;
  let messageTimer;

  document.querySelectorAll(".book-card").forEach((card) => {
    const details = card.querySelector(".book-details");
    const button = card.querySelector(".button-color");
    const title = details?.querySelector("h3")?.textContent?.trim();
    const priceText = details?.querySelector(".book-price")?.textContent?.trim();
    const priceMatch = priceText?.match(/^\$\s*(\d+(?:\.\d{1,2})?)$/);
    const priceCents = priceMatch ? Math.round(Number(priceMatch[1]) * 100) : NaN;

    if (!details?.id || !button?.dataset.book || button.dataset.book !== title ||
        !priceMatch || !Number.isSafeInteger(priceCents) || priceCents <= 0) {
      return;
    }

    products.set(details.id, {
      id: details.id,
      title,
      priceCents,
      category: details.querySelector(".book-category")?.textContent?.trim() || "Books",
      image: card.querySelector(".book-image")?.src || "",
      imageAlt: card.querySelector(".book-image")?.alt || "",
      description: `Discover ${title}, a wonderful pick for your next reading adventure.`
    });
  });

  function formatPrice(priceCents) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(priceCents / 100);
  }

  const panel = document.createElement("section");
  panel.className = "cart-panel";
  panel.id = "cart-panel";
  panel.setAttribute("aria-label", "Shopping cart");
  panel.setAttribute("role", "region");
  panel.hidden = true;

  const panelHeader = document.createElement("div");
  panelHeader.className = "cart-panel-header";

  const panelTitle = document.createElement("h2");
  panelTitle.className = "cart-panel-title";
  panelTitle.textContent = "Your cart";

  const closeButton = document.createElement("button");
  closeButton.className = "cart-panel-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close cart");
  closeButton.textContent = "×";

  const cartItems = document.createElement("ul");
  cartItems.className = "cart-panel-items";

  const emptyMessage = document.createElement("p");
  emptyMessage.className = "cart-empty-message";
  emptyMessage.textContent = "Your cart is waiting for a little color.";

  const cartSummary = document.createElement("div");
  cartSummary.className = "cart-panel-summary";

  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total";

  const totalValue = document.createElement("strong");
  totalValue.className = "cart-panel-total";

  const continueLink = document.createElement("a");
  continueLink.className = "button button-primary cart-continue";
  continueLink.href = "#shop";
  continueLink.textContent = "Keep exploring";

  const checkoutButton = document.createElement("button");
  checkoutButton.className = "button button-color cart-checkout";
  checkoutButton.type = "button";
  checkoutButton.textContent = "Continue to delivery";

  panelHeader.append(panelTitle, closeButton);
  cartSummary.append(totalLabel, totalValue);
  panel.append(panelHeader, cartItems, emptyMessage, cartSummary, checkoutButton, continueLink);
  document.body.append(panel);

  const cartTotal = document.createElement("span");
  cartTotal.className = "cart-total";
  cartTotal.setAttribute("aria-hidden", "true");
  cartLink.append(cartTotal);
  cartLink.setAttribute("aria-controls", panel.id);
  cartLink.setAttribute("aria-expanded", "false");

  const status = document.createElement("div");
  status.className = "cart-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  document.body.append(status);

  function showMessage(message) {
    status.textContent = message;
    status.hidden = false;
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      status.hidden = true;
    }, 4200);
  }

  function getTotalCents() {
    return [...cart.values()].reduce(
      (total, item) => total + item.priceCents * item.quantity,
      0
    );
  }

  function renderCart() {
    const itemCount = [...cart.values()].reduce((count, item) => count + item.quantity, 0);
    const totalCents = getTotalCents();
    const formattedTotal = formatPrice(totalCents);

    cartCount.textContent = String(itemCount);
    cartCount.setAttribute("aria-label", `${itemCount} ${itemCount === 1 ? "item" : "items"} in cart`);
    cartTotal.textContent = formattedTotal;
    cartLink.setAttribute(
      "aria-label",
      `Shopping cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}, total ${formattedTotal}`
    );
    totalValue.textContent = formattedTotal;
    cartItems.replaceChildren();

    for (const item of cart.values()) {
      const row = document.createElement("li");
      row.className = "cart-panel-item";

      const itemInfo = document.createElement("div");
      itemInfo.className = "cart-panel-item-info";

      const itemTitle = document.createElement("span");
      itemTitle.className = "cart-panel-item-title";
      itemTitle.textContent = item.title;

      const itemQuantity = document.createElement("span");
      itemQuantity.className = "cart-panel-item-quantity";
      itemQuantity.textContent = `${item.quantity} × ${formatPrice(item.priceCents)}`;

      const itemSubtotal = document.createElement("strong");
      itemSubtotal.className = "cart-panel-item-subtotal";
      itemSubtotal.textContent = formatPrice(item.priceCents * item.quantity);

      const removeButton = document.createElement("button");
      removeButton.className = "cart-panel-remove";
      removeButton.type = "button";
      removeButton.dataset.removeBook = item.id;
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${item.title} from cart`);

      itemInfo.append(itemTitle, itemQuantity);
      row.append(itemInfo, itemSubtotal, removeButton);
      cartItems.append(row);
    }

    const isEmpty = cart.size === 0;
    emptyMessage.hidden = !isEmpty;
    cartItems.hidden = isEmpty;
    cartSummary.hidden = isEmpty;
    checkoutButton.disabled = isEmpty;
    renderOrderSummary();
  }

  function renderOrderSummary() {
    const summaryItems = document.getElementById("order-summary-items");
    const summaryEmpty = document.getElementById("order-summary-empty");
    const summaryTotal = document.getElementById("order-summary-total");
    if (!summaryItems || !summaryEmpty || !summaryTotal) return;

    summaryItems.replaceChildren();
    for (const item of cart.values()) {
      const row = document.createElement("li");
      const title = document.createElement("span");
      const subtotal = document.createElement("strong");
      title.textContent = `${item.title} × ${item.quantity}`;
      subtotal.textContent = formatPrice(item.priceCents * item.quantity);
      row.append(title, subtotal);
      summaryItems.append(row);
    }
    const isEmpty = cart.size === 0;
    summaryEmpty.hidden = !isEmpty;
    summaryItems.hidden = isEmpty;
    summaryTotal.textContent = formatPrice(getTotalCents());
  }

  async function renderOrders() {
    const orderList = document.getElementById("orders-list");
    const emptyMessage = document.getElementById("orders-empty");
    if (!orderList || !emptyMessage) return;
    const renderVersion = ++ordersRenderVersion;
    const requestEmail = signedInUser?.email;
    orderList.replaceChildren();

    let orders = [];
    try {
      let parsedOrders;
      if (apiBaseUrl) {
        const responseData = await apiRequest("/orders");
        parsedOrders = Array.isArray(responseData)
          ? responseData
          : responseData?.orders;
      } else {
        const savedOrders = window.localStorage.getItem(ordersKey);
        parsedOrders = savedOrders ? JSON.parse(savedOrders) : [];
      }

      if (renderVersion !== ordersRenderVersion || requestEmail !== signedInUser?.email) {
        return;
      }

      if (Array.isArray(parsedOrders)) {
        orders = parsedOrders.filter((order) =>
          order &&
          typeof order.id === "string" &&
          typeof order.date === "string" &&
          Number.isFinite(Date.parse(order.date)) &&
          typeof order.customerName === "string" &&
          typeof order.phone === "string" &&
          typeof order.address === "string" &&
          (apiBaseUrl || order.email === signedInUser?.email) &&
          Array.isArray(order.items) &&
          Number.isSafeInteger(order.totalCents) &&
          order.totalCents >= 0 &&
          order.items.every((item) =>
            item &&
            typeof item.title === "string" &&
            Number.isSafeInteger(item.quantity) &&
            item.quantity > 0 &&
            Number.isSafeInteger(item.priceCents) &&
            item.priceCents >= 0 &&
            Number.isSafeInteger(item.priceCents * item.quantity)
          ) &&
          order.items.reduce((total, item) => total + item.priceCents * item.quantity, 0) === order.totalCents
        );
      } else {
        throw new Error("The account service returned an invalid order list.");
      }
    } catch (error) {
      if (renderVersion !== ordersRenderVersion || requestEmail !== signedInUser?.email) {
        return;
      }
      console.error("ColorMyBook could not load order history.", error);
      emptyMessage.textContent = apiBaseUrl
        ? "Order history couldn't be loaded from your account. Please try again."
        : "Order history couldn't be loaded from this browser.";
      emptyMessage.hidden = false;
      return;
    }

    orders.forEach((order) => {
      const article = document.createElement("article");
      article.className = "order-card";
      const heading = document.createElement("div");
      heading.className = "order-card-heading";
      const orderName = document.createElement("h3");
      orderName.textContent = `Order ${order.id}`;
      const date = document.createElement("time");
      date.dateTime = order.date;
      date.textContent = new Date(order.date).toLocaleString();
      heading.append(orderName, date);

      const itemList = document.createElement("ul");
      itemList.className = "order-card-items";
      order.items.forEach((item) => {
        if (!item || typeof item.title !== "string" ||
            !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
            !Number.isSafeInteger(item.priceCents) || item.priceCents < 0) return;
        const listItem = document.createElement("li");
        listItem.textContent = `${item.title} × ${item.quantity} — ${formatPrice(item.priceCents * item.quantity)}`;
        itemList.append(listItem);
      });
      const total = document.createElement("p");
      total.className = "order-card-total";
      total.textContent = `Total: ${formatPrice(order.totalCents)}`;
      const delivery = document.createElement("div");
      delivery.className = "order-card-delivery";
      const deliveryHeading = document.createElement("h4");
      deliveryHeading.textContent = "Delivery details";
      const recipient = document.createElement("p");
      recipient.textContent = order.customerName;
      const phone = document.createElement("p");
      phone.textContent = order.phone;
      const address = document.createElement("p");
      address.textContent = order.address;
      delivery.append(deliveryHeading, recipient, phone, address);
      article.append(heading, itemList, delivery, total);
      orderList.append(article);
    });
    emptyMessage.hidden = orders.length > 0;
  }

  function showCheckout() {
    const checkout = document.getElementById("checkout");
    const detailSection = document.getElementById("book-detail-section");
    if (cart.size === 0) {
      showMessage("Add a book to your cart before continuing to delivery.");
      return;
    }
    if (checkout) checkout.hidden = false;
    if (detailSection) detailSection.hidden = true;
    setCartOpen(false);
    checkout?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showBookDetails(product) {
    const detailSection = document.getElementById("book-detail-section");
    const image = document.getElementById("book-detail-image");
    const title = document.getElementById("book-detail-title");
    const category = document.getElementById("book-detail-category");
    const description = document.getElementById("book-detail-description");
    const price = document.getElementById("book-detail-price");
    const addButton = document.getElementById("book-detail-add");
    if (!detailSection || !image || !title || !category || !description || !price || !addButton) return;

    image.src = product.image;
    image.alt = product.imageAlt;
    title.textContent = product.title;
    category.textContent = product.category;
    description.textContent = product.description;
    price.textContent = formatPrice(product.priceCents);
    addButton.dataset.addBook = product.id;
    detailSection.hidden = false;
    document.getElementById("checkout").hidden = true;
    detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  checkoutButton.addEventListener("click", showCheckout);

  document.getElementById("close-book-details")?.addEventListener("click", () => {
    const detailSection = document.getElementById("book-detail-section");
    if (detailSection) detailSection.hidden = true;
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("back-to-shop")?.addEventListener("click", () => {
    const checkout = document.getElementById("checkout");
    if (checkout) checkout.hidden = true;
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("order-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const orderForm = event.currentTarget;
    if (!(orderForm instanceof HTMLFormElement) || !orderForm.reportValidity()) return;
    if (cart.size === 0) {
      showMessage("Your cart is empty. Add a book before placing your order.");
      return;
    }

    const formData = new FormData(orderForm);
    const customerName = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const phoneDigits = phone.match(/\d/g) || [];
    if (!customerName || !address) {
      showMessage("Please complete your name, phone number, and delivery address.");
      return;
    }
    if (!/^[+0-9() .-]{7,20}$/.test(phone) || phoneDigits.length < 7) {
      showMessage("Please enter a valid phone number with at least 7 digits.");
      return;
    }

    setFormBusy(orderForm, true);
    try {
      if (apiBaseUrl) {
        await apiRequest("/orders", {
          method: "POST",
          body: JSON.stringify({
            customerName,
            phone,
            address,
            items: [...cart.values()].map((item) => ({
              bookId: item.id,
              quantity: item.quantity
            }))
          })
        });
      } else {
        const order = {
          id: `${Date.now()}`,
          date: new Date().toISOString(),
          email: signedInUser?.email || "",
          customerName,
          phone,
          address,
          items: [...cart.values()].map((item) => ({
            title: item.title,
            priceCents: item.priceCents,
            quantity: item.quantity
          })),
          totalCents: getTotalCents()
        };
        const savedOrders = window.localStorage.getItem(ordersKey);
        const parsedOrders = savedOrders ? JSON.parse(savedOrders) : [];
        if (!Array.isArray(parsedOrders)) {
          throw new Error("Saved order history is not a list.");
        }
        parsedOrders.unshift(order);
        window.localStorage.setItem(ordersKey, JSON.stringify(parsedOrders));
      }
    } catch (error) {
      console.error("ColorMyBook could not place the order.", error);
      setFormBusy(orderForm, false);
      showMessage(apiBaseUrl
        ? error.message || "We couldn't place your order. Your cart is still here; please try again."
        : "We couldn't save this sample order in your browser. Your cart is still here; please try again.");
      return;
    }

    setFormBusy(orderForm, false);
    const checkout = document.getElementById("checkout");
    if (checkout) checkout.hidden = true;
    orderForm.reset();
    cart.clear();
    renderCart();
    const cartSaved = saveCart();
    void renderOrders();
    document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!cartSaved) {
      showMessage(`Thanks, ${customerName}! Your order was placed, but the cart could not be cleared from browser storage.`);
    } else if (apiBaseUrl) {
      showMessage(`Thanks, ${customerName}! Your order has been placed.`);
    } else {
      showMessage(`Thanks, ${customerName}! Your demo order has been saved to My Orders.`);
    }
  });

  function saveCart() {
    if (apiBaseUrl) {
      return true;
    }

    if (!storageAvailable) {
      return false;
    }

    const savedCart = [...cart.values()].map((item) => ({
      id: item.id,
      title: item.title,
      priceCents: item.priceCents,
      quantity: item.quantity
    }));

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(savedCart));
      return true;
    } catch (error) {
      storageAvailable = false;
      console.error("ColorMyBook could not save the cart to localStorage.", error);
      return false;
    }
  }

  function restoreCart() {
    if (apiBaseUrl) {
      return;
    }

    let savedValue;

    try {
      savedValue = window.localStorage.getItem(storageKey);
    } catch (error) {
      storageAvailable = false;
      console.error("ColorMyBook could not read the saved cart from localStorage.", error);
      showMessage("Your cart is available for this visit, but saved cart storage is unavailable.");
      return;
    }

    if (savedValue === null) {
      return;
    }

    let savedItems;
    try {
      savedItems = JSON.parse(savedValue);
    } catch (error) {
      console.error("ColorMyBook found unreadable saved cart data.", error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch (storageError) {
        storageAvailable = false;
        console.error("ColorMyBook could not clear unreadable cart data.", storageError);
      }
      showMessage("We couldn't read your saved cart, so we've started a fresh one.");
      return;
    }

    if (!Array.isArray(savedItems)) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (error) {
        storageAvailable = false;
        console.error("ColorMyBook could not clear invalid cart data.", error);
      }
      showMessage("Your saved cart looked invalid, so we've started a fresh one.");
      return;
    }

    let invalidItemFound = false;
    savedItems.forEach((savedItem) => {
      const product = savedItem && typeof savedItem.id === "string"
        ? products.get(savedItem.id)
        : undefined;

      if (!product ||
          savedItem.title !== product.title ||
          savedItem.priceCents !== product.priceCents ||
          !Number.isSafeInteger(savedItem.quantity) ||
          savedItem.quantity <= 0 ||
          !Number.isSafeInteger(savedItem.priceCents * savedItem.quantity)) {
        invalidItemFound = true;
        return;
      }

      const existing = cart.get(product.id);
      const quantity = (existing?.quantity ?? 0) + savedItem.quantity;
      const lineTotal = product.priceCents * quantity;
      const cartTotal = getTotalCents() -
        (existing ? existing.priceCents * existing.quantity : 0) +
        lineTotal;
      if (!Number.isSafeInteger(quantity) ||
          !Number.isSafeInteger(lineTotal) ||
          !Number.isSafeInteger(cartTotal)) {
        invalidItemFound = true;
        return;
      }

      cart.set(product.id, { ...product, quantity });
    });

    if (invalidItemFound) {
      showMessage("Some saved cart items couldn't be restored. The rest of your cart is ready.");
      saveCart();
    }
  }

  function setCartOpen(isOpen) {
    panel.hidden = !isOpen;
    cartLink.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      closeButton.focus();
    }
  }

  cartLink.addEventListener("click", (event) => {
    event.preventDefault();
    setCartOpen(panel.hidden);
  });

  closeButton.addEventListener("click", () => {
    setCartOpen(false);
    cartLink.focus();
  });

  continueLink.addEventListener("click", () => {
    setCartOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element &&
        !panel.hidden &&
        !panel.contains(event.target) &&
        !cartLink.contains(event.target)) {
      setCartOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setCartOpen(false);
      cartLink.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const detailLink = event.target.closest(".book-image-link");
    if (detailLink) {
      event.preventDefault();
      const bookDetails = detailLink.closest(".book-card")?.querySelector(".book-details");
      const product = bookDetails ? products.get(bookDetails.id) : undefined;
      if (product) showBookDetails(product);
      return;
    }

    const addButton = event.target.closest(".button-color");
    if (!addButton) {
      const removeButton = event.target.closest("[data-remove-book]");
      if (!removeButton) {
        return;
      }

      const item = cart.get(removeButton.dataset.removeBook);
      if (!item) {
        showMessage("That item is no longer in your cart. Please refresh and try again.");
        return;
      }

      cart.delete(item.id);
      renderCart();
      if (saveCart()) {
        showMessage(`${item.title} was removed from your cart.`);
      } else {
        showMessage("Your cart changed, but browser storage is unavailable so it won't be saved.");
      }
      return;
    }

    if (addButton.classList.contains("cart-checkout")) {
      return;
    }

    const detailBookId = addButton.dataset.addBook;
    if (detailBookId) {
      const product = products.get(detailBookId);
      if (!product) {
        showMessage("We couldn't find that book. Please refresh and try again.");
        return;
      }
      addProductToCart(product);
      return;
    }

    const card = addButton.closest(".book-card");
    const details = card?.querySelector(".book-details");
    const product = details ? products.get(details.id) : undefined;

    if (!product || addButton.dataset.book !== product.title) {
      showMessage("We couldn't add that book just now. Please try again.");
      return;
    }

    addProductToCart(product);
  });

  function addProductToCart(product) {
    const existing = cart.get(product.id);
    const quantity = (existing?.quantity ?? 0) + 1;
    if (!Number.isSafeInteger(quantity) ||
        !Number.isSafeInteger(product.priceCents * quantity) ||
        !Number.isSafeInteger(getTotalCents() + product.priceCents)) {
      showMessage("That's quite a collection! This book can't be added again right now.");
      return;
    }

    cart.set(product.id, { ...product, quantity });
    renderCart();

    if (saveCart()) {
      showMessage(`${product.title} added to your cart. Your total is ${formatPrice(getTotalCents())}.`);
    } else {
      showMessage("Your cart is updated for this visit, but browser storage is unavailable.");
    }
  }

  const currentYear = document.getElementById("current-year");
  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  if (apiBaseUrl) {
    if (authDemoNote) {
      authDemoNote.textContent = "Checking your secure account session…";
    }
    void restoreApiSession();
  } else {
    showAuth();
    if (apiConfigurationError) {
      showAuthFeedback(apiConfigurationError);
    } else {
      try {
        const savedSession = window.sessionStorage.getItem(sessionKey);
        if (savedSession) {
          const user = JSON.parse(savedSession);
          if (user &&
              typeof user.email === "string" &&
              user.email.includes("@") &&
              typeof user.name === "string") {
            showStore({
              email: user.email.trim().toLowerCase(),
              name: user.name.trim().slice(0, 80)
            });
          } else {
            window.sessionStorage.removeItem(sessionKey);
          }
        }
      } catch (error) {
        console.error("ColorMyBook could not restore the demo session.", error);
        showAuthFeedback("Your demo session couldn't be restored. Please sign in again.");
      }
    }
  }

  restoreCart();
  renderCart();
})();