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
        // localStorage.setItem('aria_description', JSON.stringify(results));
        console.log("Results: ", results[0].result);
    }).catch(function (error) {
        // message.innerText = 'There was an error injecting script : \n' + error.message;
    });
}

window.onload = onWindowLoad;

function get_xpath(element) {
    if (element.id !== '')
        return 'id("' + element.id + '")';
    if (element === document.body)
        return element.tagName;

    var ix = 0;
    var siblings = element.parentNode.childNodes;
    for (var i = 0; i < siblings.length; i++) {
        var sibling = siblings[i];
        if (sibling === element)
            return get_xpath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
            ix++;
    }
}

function get_aria_description(selector) {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return "ERROR: querySelector failed to find node";
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
            element: element,
            // xpath: get_xpath(element),
        };
        elements_array.push(element_info);
    }
    return elements_array;
}

function get_element_from_uuid(uuid) {
    selector = document.documentElement;
    var elements = selector.querySelectorAll('[aria-description]');
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        if (element.getAttribute("aria-description") === ARIA_MAP[uuid].value) {
            return element;
        }
    }
}

function get_dom_aria(selector) {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return "ERROR: querySelector failed to find node";
    } else {
        selector = document.documentElement;
    }
    var elements = selector.querySelectorAll('[aria-description]');
    return elements;
}

// Wait for the DOM content to be loaded before interacting with the DOM
window.addEventListener('DOMContentLoaded', (event) => {
    const button = document.querySelector('#btn');
    const messageElement = document.querySelector('#message');
    let mediaRecorder;
    let audioChunks = [];

    // Ensure the button exists before adding event listener
    if (button) {
        button.addEventListener('click', function () {
            if (button.innerText === 'Listen') {
                // Change the button text to indicate recording
                button.innerText = 'Recording...';

                // Start recording audio
                startRecording();
            } else {
                // Stop recording when clicked again
                button.innerText = 'Listen';
                stopRecording();
            }
        });
    } else {
        console.error("Button element not found");
    }

    // Start recording audio
    function startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                console.log('Microphone access granted');
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = event => {
                    console.log('Data available: ', event.data); // Debugging: log the audio chunks
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    console.log('Recording stopped');
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);

                    // TODO: Download the audio file
                    // createDownloadLink(audioBlob);
                    const download_uuid = downloadBlobAutomatically(audioBlob);
                    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            injectImmediately: true,  // uncomment this to make it execute straight away, other wise it will wait for document_idle
                            func: () => {
                                const aria_elements = document.documentElement.querySelectorAll("[aria-description]");
                                const body_data = [];
                                for (let i = 0; i < aria_elements.length; i++) {
                                    const element = aria_elements[i];
                                    const element_info = {
                                        value: element.getAttribute('aria-description'),
                                        tag: element.tagName,
                                        id: crypto.randomUUID(),
                                    };
                                    body_data.push(element_info);
                                }
                                return body_data;
                            }
                        }).then(function (results) {
                            const data_arr = results[0].result;
                            data_map = data_arr.reduce((acc, element) => {
                                acc[element.id] = element;
                                return acc;
                            }, {});
                            console.log("POST BEFORE RESULTS: ", data_arr, JSON.stringify(data_arr));
                            setTimeout(() => {
                                console.log("Sending data to backend...");
                                fetch("http://localhost:8000/flow", {
                                    method: "POST",
                                    // mode: 'no-cors',
                                    headers: {
                                        "Content-Type": "application/json",
                                        "id": download_uuid,
                                    },
                                    body: JSON.stringify(data_arr),
                                }).then(response => {
                                    // console.log("Response: ", response);
                                    response.json().then(data => {
                                        console.log("Response data: ", data);
                                        task = data["task"];
                                        let data_arr = task["data"];

                                        data_map = data_arr.reduce((acc, element) => {
                                            acc[element.id] = element;
                                            return acc;
                                        }, {});

                                        map_desc = data_map[task.id].value;
                                        if (task.action === "type") {
                                            chrome.storage.local.set({"task": {"desc": map_desc, "value": task.value}}, function () {
                                                console.log("Task saved: ", task);
                                                chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
                                                    chrome.scripting.executeScript({
                                                        target: { tabId: tabs[0].id },
                                                        injectImmediately: true,  // uncomment this to make it execute straight away, other wise it will wait for document_idle
                                                        func: () => {
                                                            const value = chrome.storage.local.get("task", function (result) {
                                                                console.log("RESULT: ", result);
                                                                document.querySelectorAll("[aria-description]").forEach((element) => {
                                                                    console.log("DOM_ELEMENT: ", element.getAttribute("aria-description"));
                                                                    if (element.getAttribute("aria-description") === result.task.desc) {
                                                                        console.log("Element found: ", element);
                                                                        element.value = result.task.value;
                                                                        console.log("Element value set to: ", result.task.value);
                                                                    }
                                                                });
                                                            });
                                                        }
                                                    });
                                                });
                                            });
                                        } else if (task.action === "click") {
                                            chrome.storage.local.set({"task": {"desc": map_desc}}, function () {
                                                console.log("Task saved: ", task);
                                                chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
                                                    chrome.scripting.executeScript({
                                                        target: { tabId: tabs[0].id },
                                                        injectImmediately: true,  // uncomment this to make it execute straight away, other wise it will wait for document_idle
                                                        func: () => {
                                                            const value = chrome.storage.local.get("task", function (result) {
                                                                console.log("RESULT: ", result);
                                                                document.querySelectorAll("[aria-description]").forEach((element) => {
                                                                    console.log("DOM_ELEMENT: ", element.getAttribute("aria-description"));
                                                                    if (element.getAttribute("aria-description") === result.task.desc) {
                                                                        console.log("Element found: ", element);
                                                                        element.click();
                                                                        console.log("Element clicked");
                                                                    }
                                                                });
                                                            });
                                                        }
                                                    });
                                                });
                                            });
                                        }
                                    });

                                    
                                }).catch(error => {
                                    console.error("Error fetching data from backend: ", error);
                                })
                            }, 2000);
                        });
                    });

                    // TODO: Call the backend API
                    // response = backend_api_call(ariaElements);

                    // task = {
                    //     "action": "type",
                    //     "id": "5",
                    //     "value": "John Doe",
                    // }

                    // task = {
                    //     "action": "click",
                    //     "id": "1",
                    // }

                //     response.forEach(task => {
                //         map_desc = ARIA_MAP[task.id];
                //         console.log("MAP_DESC: ", map_desc.value);
                //         chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
                //             var activeTab = tabs[0];
                //             var activeTabId = activeTab.id;
                //             return chrome.scripting.executeScript({
                //                 target: { tabId: activeTabId },
                //                 injectImmediately: true,  // uncomment this to make it execute straight away, other wise it will wait for document_idle
                //                 func: () => {
                //                     const dom_elements = document.documentElement.querySelectorAll("[aria-description]");
                //                     for (let i = 0; i < dom_elements.length; i++) {
                //                         console.log("DOM_ELEMENT: ", dom_elements[i].getAttribute("aria-description"));
                //                         if (dom_elements[i].getAttribute("aria-description") === map_desc.value) {
                //                             console.log("Element found: ", dom_elements[i]);
                //                             const element = dom_elements[i];
                //                             if (task.action === "type") {
                //                                 element.value = task.value;
                //                                 console.log("Element found: ", element);
                //                                 console.log("Element value set to: ", task.value);
                //                             }
                //                         }
                //                     }
                //                 }
                //                 // args: ['body']  // you can use this to target what element to get the html for
                //             });
                //         }).then(function (results) {
                //             console.log("Results: ", results[0].result);
                //             // for (let i = 0; i < dom_elements.length; i++) {
                //             //     if (dom_elements[i].value === map_desc.value) {
                //             //         console.log("DOM_ELEMENT: ", dom_elements[i]);
                //             //         const element = dom_elements[i].element;
                //             //         if (task.action === "type") {
                //             //             element.value = task.value;
                //             //             console.log("Element found: ", element);
                //             //             console.log("Element value set to: ", task.value);
                //             //         }
                //             //     }
                //             // }
                //         }).catch(function (error) {
                //             message.innerText = 'There was an error injecting script : \n' + error.message;
                //         });
                //         // doc_elements = document.documentElement.querySelectorAll("[aria-description]");
                //         // console.log(document.outerHTML);
                //         // console.log("DOC_ELEMENTS: ", doc_elements);
                //         // console.log("DOC_ELEMENTS: ", doc_elements.length);
                //         // for (let i = 0; i < doc_elements.length; i++) {
                //         //     console.log("DOC_ELEMENT: ", doc_elements[i].getAttribute("aria-description"));
                //         //     if (doc_elements[i].getAttribute("aria-description") === map_desc.value) {
                //         //         console.log("Element found: ", doc_elements[i]);
                //         //     }
                //         // }
                //     });
                };

                mediaRecorder.start();
                console.log('Recording started');
            })
            .catch((error) => {
                console.error('Error accessing the microphone: ', error);
                if (messageElement) {
                    messageElement.innerText = 'Error: Unable to access microphone. Please check your microphone settings.';
                }
            });
    }

    // Stop recording audio
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        if (messageElement) {
            messageElement.innerText = 'Recording stopped';
        }
    }

    // Create a download link for the recorded audio
    function createDownloadLink(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        chrome.downloads.download({
            url: audioUrl,
            filename: "/Users/supradparashar/Downloads/audiodevhacks.wav" // Optional
        });

        // Create the download link
        const downloadLink = document.createElement('a');
        downloadLink.href = audioUrl;
        downloadLink.download = 'recorded_audio.wav';  // Set the name of the file
        downloadLink.innerText = 'Click here to download the audio file';  // Link text

        // Append the link to the message element
        if (messageElement) {
            messageElement.innerHTML = 'Recording stopped. You can download the file now. ';
            messageElement.appendChild(downloadLink); // Add the download link to the message
        }
    }

    function downloadBlobAutomatically(blob) {
        const url = URL.createObjectURL(blob);
        const uuid = crypto.randomUUID();
        chrome.downloads.download({
            url: url,
            filename: "tmp/recorded_audio_" + uuid + ".wav", // or "myfolder/recorded_audio.wav"
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Download failed:", chrome.runtime.lastError);
            } else {
                console.log("Download initiated, ID:", downloadId);
            }
            URL.revokeObjectURL(url);
        });
        return uuid;
    }
});
