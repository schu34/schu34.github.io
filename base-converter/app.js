const FIELDS = [
  {
    id: "decimal",
    label: "Decimal",
    base: 10,
    input: document.querySelector("#decimal-input"),
    format: formatDecimal,
  },
  {
    id: "hex",
    label: "hexadecimal",
    base: 16,
    input: document.querySelector("#hex-input"),
    format: formatHex,
  },
  {
    id: "binary",
    label: "binary",
    base: 2,
    input: document.querySelector("#binary-input"),
    format: formatBinary,
  },
];

const status = document.querySelector("#conversion-status");

document.querySelector(".theme-toggle").addEventListener("click", (event) => {
  const isLight = document.body.classList.toggle("light");
  event.currentTarget.setAttribute("aria-pressed", String(!isLight));
  event.currentTarget.querySelector("span:last-child").textContent = isLight ? "Light" : "Dark";
});

for (const field of FIELDS) {
  field.input.addEventListener("input", () => handleInput(field));
  field.input.addEventListener("blur", () => normalizeField(field));
  field.input.addEventListener("focus", () => {
    field.input.removeAttribute("aria-invalid");
    field.input.closest(".number-field").classList.remove("invalid");
  });
}

function handleInput(sourceField) {
  clearInvalidState();

  const result = parseValue(sourceField.input.value, sourceField.base);
  if (result.empty) {
    clearOtherFields(sourceField.id);
    setStatus("Enter a whole, non-negative number.");
    return;
  }

  if (!result.valid) {
    markInvalid(sourceField, result.message);
    return;
  }

  updateConvertedFields(result.value, sourceField.id);
  setStatus(`Converted from ${sourceField.label}.`);
}

function normalizeField(field) {
  const result = parseValue(field.input.value, field.base);
  if (result.empty) {
    field.input.value = "";
    clearOtherFields(field.id);
    setStatus("Enter a whole, non-negative number.");
    return;
  }

  if (!result.valid) {
    markInvalid(field, result.message);
    return;
  }

  clearInvalidState();
  field.input.value = field.format(result.value);
  updateConvertedFields(result.value, field.id);
}

function updateConvertedFields(value, sourceId) {
  for (const field of FIELDS) {
    if (field.id !== sourceId) {
      field.input.value = field.format(value);
    }
  }
}

function clearOtherFields(sourceId) {
  for (const field of FIELDS) {
    if (field.id !== sourceId) {
      field.input.value = "";
    }
  }
}

function parseValue(rawValue, base) {
  const raw = rawValue.trim();
  if (!raw) {
    return { empty: true };
  }

  let normalized = raw;
  if (base === 10) {
    if (!/^\+?[0-9,\s]+$/.test(raw)) {
      return invalidResult("Use decimal digits 0–9, with optional commas.");
    }
    normalized = raw.replace(/[\s,]/g, "");
  } else if (base === 16) {
    normalized = normalized.replace(/^0x/i, "").replace(/^\$/, "").replace(/[\s_]/g, "");
    if (!/^[0-9a-f]+$/i.test(normalized)) {
      return invalidResult("Use hexadecimal digits 0–9 and A–F.");
    }
  } else {
    normalized = normalized.replace(/^0b/i, "").replace(/[\s_]/g, "");
    if (!/^[01]+$/.test(normalized)) {
      return invalidResult("Use binary digits 0 and 1.");
    }
  }

  if (!normalized || normalized === "+") {
    return invalidResult("Enter at least one digit.");
  }

  try {
    return { valid: true, value: BigInt(base === 10 ? normalized : `0${base === 16 ? "x" : "b"}${normalized}`) };
  } catch {
    return invalidResult("That value could not be converted.");
  }
}

function invalidResult(message) {
  return { valid: false, message };
}

function formatDecimal(value) {
  return value.toString(10).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatHex(value) {
  const rawDigits = value.toString(16).toUpperCase();
  const digits = rawDigits.padStart(rawDigits.length % 2 === 0 ? rawDigits.length : rawDigits.length + 1, "0");
  return groupFromRight(digits, 2);
}

function formatBinary(value) {
  const minimumBits = 8;
  const rawBits = value.toString(2);
  const bitCount = Math.max(minimumBits, Math.ceil(rawBits.length / 8) * 8);
  return groupFromRight(rawBits.padStart(bitCount, "0"), 4);
}

function groupFromRight(value, groupSize) {
  const groups = [];
  for (let end = value.length; end > 0; end -= groupSize) {
    groups.unshift(value.slice(Math.max(0, end - groupSize), end));
  }
  return groups.join(" ");
}

function markInvalid(field, message) {
  field.input.setAttribute("aria-invalid", "true");
  field.input.closest(".number-field").classList.add("invalid");
  setStatus(message, true);
}

function clearInvalidState() {
  for (const field of FIELDS) {
    field.input.removeAttribute("aria-invalid");
    field.input.closest(".number-field").classList.remove("invalid");
  }
  status.classList.remove("error");
}

function setStatus(message, isError = false) {
  status.classList.toggle("error", isError);
  status.textContent = message;
}
