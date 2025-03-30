// 

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

                    // Call to create the download link
                    createDownloadLink(audioBlob);
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
            messageElement.innerText = 'Recording stopped. You can download the file now.';
        }
    }

    // Create a download link for the recorded audio
    function createDownloadLink(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);

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

    // Get all ARIA description elements (unchanged from your original code)
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
            };
            elements_array.push(element_info);
        }
        return elements_array;
    }

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
});
