(() => {
  "use strict";

  const CART_STORAGE_KEY = "colormybook-cart";
  const cartButton = document.getElementById("cart-button");
  const cartCountElement = document.getElementById("cart-count");
  const cartTotalElement = document.getElementById("cart-total");
  const statusMessage = document.getElementById("cart-status");
  const colorButtons = document.querySelectorAll(".color-button");

  if (!cartButton || !cartCountElement || !cartTotalElement || !statusMessage) {
    throw new Error("ColorMyBook cart markup is missing a required element.");
  }

  const products = new Map();
  document.querySelectorAll(".book-card").forEach((card) => {
    const title = card.querySelector(".book-info h3")?.textContent.trim();
    const priceText = card.querySelector(".book-price")?.textContent.trim();
    const price = priceText ? Number(priceText.replace(/[^\d.]/g, "")) : NaN;

    if (title && Number.isFinite(price) && price > 0) {
      products.set(title, { priceCents: Math.round(price * 100) });
    }
  });

  if (products.size === 0) {
    throw new Error("ColorMyBook could not find any valid book products.");
  }

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  const cart = new Map();
  let storageAvailable = true;

  function getCartCount() {
    let count = 0;
    cart.forEach((quantity) => {
      count += quantity;
    });
    return count;
  }

  function getCartTotalCents() {
    let total = 0;
    cart.forEach((quantity, name) => {
      total += products.get(name).priceCents * quantity;
    });
    return total;
  }

  function renderCart() {
    const count = getCartCount();
    const total = currency.format(getCartTotalCents() / 100);
    cartCountElement.textContent = String(count);
    cartTotalElement.textContent = total;
    cartButton.setAttribute(
      "aria-label",
      `Shopping cart, ${count} ${count === 1 ? "item" : "items"}, total ${total}`
    );
  }

  function saveCart() {
    if (!storageAvailable) return false;

    const savedItems = Array.from(cart, ([name, quantity]) => ({ name, quantity }));
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(savedItems));
      return true;
    } catch (error) {
      storageAvailable = false;
      console.error("Could not save the ColorMyBook cart to localStorage.", error);
      return false;
    }
  }

  function loadCart() {
    let savedData;
    try {
      savedData = window.localStorage.getItem(CART_STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      console.error("Could not access localStorage to restore the ColorMyBook cart.", error);
      statusMessage.textContent = "Your cart is ready, but this browser couldn't restore saved items.";
      return;
    }

    if (savedData === null) return;

    let savedItems;
    try {
      savedItems = JSON.parse(savedData);
    } catch (error) {
      console.error("The saved ColorMyBook cart contains invalid JSON.", error);
      statusMessage.textContent = "We couldn't read your saved cart, so we started a fresh one.";
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } catch (removeError) {
        storageAvailable = false;
        console.error("Could not remove invalid saved cart data.", removeError);
      }
      return;
    }

    if (!Array.isArray(savedItems)) {
      statusMessage.textContent = "Your saved cart had an invalid format, so we started a fresh one.";
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } catch (error) {
        storageAvailable = false;
        console.error("Could not remove invalid saved cart data.", error);
      }
      return;
    }

    let skippedItems = false;
    savedItems.forEach((item) => {
      if (
        !item ||
        typeof item.name !== "string" ||
        !products.has(item.name) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        skippedItems = true;
        return;
      }

      const nextQuantity = (cart.get(item.name) || 0) + item.quantity;
      if (!Number.isSafeInteger(nextQuantity)) {
        skippedItems = true;
        return;
      }
      cart.set(item.name, nextQuantity);
    });

    if (skippedItems) {
      statusMessage.textContent = "Some saved cart items were invalid and have been skipped.";
      saveCart();
    }
  }

  loadCart();
  renderCart();

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const bookName = button.dataset.book?.trim();
      const cardTitle = button.closest(".book-card")?.querySelector(".book-info h3")?.textContent.trim();

      if (!bookName || !cardTitle || bookName !== cardTitle || !products.has(bookName)) {
        statusMessage.textContent = "Sorry, we couldn't identify that book. Please try again.";
        return;
      }

      const currentQuantity = cart.get(bookName) || 0;
      if (!Number.isSafeInteger(currentQuantity + 1) || !Number.isSafeInteger(getCartCount() + 1)) {
        statusMessage.textContent = "Your cart has reached its item limit.";
        return;
      }

      cart.set(bookName, currentQuantity + 1);
      renderCart();

      if (saveCart()) {
        statusMessage.textContent = `${bookName} added to your cart. Cart total: ${currency.format(getCartTotalCents() / 100)}.`;
      } else {
        statusMessage.textContent = `${bookName} added to your cart, but this browser couldn't save it for your next visit.`;
      }
    });
  });

  cartButton.addEventListener("click", () => {
    const count = getCartCount();
    if (count === 0) {
      statusMessage.textContent = "Your cart is empty. Choose a book to get started.";
      return;
    }

    statusMessage.textContent = `Your cart has ${count} ${count === 1 ? "book" : "books"} and totals ${currency.format(getCartTotalCents() / 100)}.`;
  });
})();