const button = document.querySelector('#btn');
button.addEventListener('click', function () {
    // Get the value of the input field
    const prompt = document.querySelector('#prompt').value;

    // Call API
    let response = api(prompt, get_aria_description())
    

    // Send a message to the background script with the input value
    const message_element = document.querySelector('#message');
    message_element.innerText = "Message: " + inputValue;
});

function onWindowLoad() {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
        var activeTab = tabs[0];
        var activeTabId = activeTab.id;

        return chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            injectImmediately: true,  // uncomment this to make it execute straight away, other wise it will wait for document_idle
            func: get_aria_description,
            // args: ['body']  // you can use this to target what element to get the html for
        });

    }).then(function (results) {
        // message.innerText = results[0].result;
    }).catch(function (error) {
        // message.innerText = 'There was an error injecting script : \n' + error.message;
    });
}

window.onload = onWindowLoad;

function get_html(selector) {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return "ERROR: querySelector failed to find node"
    } else {
        selector = document.documentElement;
    }
    return selector.outerHTML;
}

function respond(prompt) {
    console.log(prompt);
}

// Get all tags with the aria-description attribute and store them in an array with their values, the element's tag name, and the element's xpath.
function get_aria_description(selector) {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return "ERROR: querySelector failed to find node"
    } else {
        selector = document.documentElement;
    }
    var elements = selector.querySelectorAll('[aria-description]');
    var elements_array = [];
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        var element_info = {
            value: element.getAttribute('aria-description'),
            tag: element.tagName,
            id: crypto.randomUUID(),
            // element: element
            // xpath: get_xpath(element)
        };
        elements_array.push(element_info);
    }
    return elements_array;
}

function get_xpath(element) {
    if (element.id!=='')
        return 'id("'+element.id+'")';
    if (element===document.body)
        return element.tagName;

    var ix= 0;
    var siblings= element.parentNode.childNodes;
    for (var i= 0; i<siblings.length; i++) {
        var sibling= siblings[i];
        if (sibling===element)
            return get_xpath(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
        if (sibling.nodeType===1 && sibling.tagName===element.tagName)
            ix++;
    }
}