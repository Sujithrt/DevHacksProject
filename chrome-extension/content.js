// Utility to generate a UUID.
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Gather aria descriptions from elements on the page.
function getAriaDescriptions() {
  const elements = document.querySelectorAll('[aria-description]');
  const descriptions = [];
  elements.forEach(el => {
    const id = generateUUID();
    // Attach the generated id as a data attribute so it can later be used for automation.
    el.setAttribute('data-id', id);
    descriptions.push({
      id: id,
      tag: el.tagName.toUpperCase(),
      value: el.getAttribute('aria-description')
    });
  });
  return descriptions;
}

// Listen for messages.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAriaDescriptions') {
    sendResponse({ ariaDescriptions: getAriaDescriptions() });
  }
  if (message.action === 'performAction') {
    // For example, if action.type is "click", find the element by the data-id and click it.
    if (message.details.type === 'click') {
      const el = document.querySelector(`[data-id="${message.details.id}"]`);
      if (el) el.click();
    }
    if (message.details.type === 'type') {
      const el = document.querySelector(`[data-id="${message.details.id}"]`);
      if (el) el.value = message.details.text;
    }
  }
});