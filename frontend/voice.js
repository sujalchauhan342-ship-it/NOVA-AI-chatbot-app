(() => {
  const input = document.getElementById("message");
  const sendButton = document.getElementById("send-btn");
  const composer = document.querySelector(".composer");

  if (!input || !sendButton || !composer) {
    console.error("Chat composer not found.");
    return;
  }

  if (document.getElementById("voice-mic-btn")) return;

  let recognition = null;
  let finalTranscript = "";
  let listening = false;

  let voiceOutputEnabled =
    localStorage.getItem("my_ai_voice_output") === "true";

  // Create language selector
  const language = document.createElement("select");
  language.id = "voice-language";
  language.innerHTML = `
    <option value="en-IN">EN</option>
    <option value="hi-IN">HI</option>
  `;
  language.title = "Voice language";

  // Create microphone button
  const mic = document.createElement("button");
  mic.id = "voice-mic-btn";
  mic.className = "voice-control";
  mic.type = "button";
  mic.textContent = "🎤";
  mic.title = "Speak your message";

  // Create speaker button
  const speaker = document.createElement("button");
  speaker.id = "voice-speaker-btn";
  speaker.className = "voice-control";
  speaker.type = "button";

  function updateSpeaker() {
    speaker.textContent = voiceOutputEnabled ? "🔊" : "🔇";
    speaker.title = voiceOutputEnabled
      ? "Turn voice replies off"
      : "Turn voice replies on";
  }

  updateSpeaker();

  // Add controls to composer
  composer.insertBefore(language, sendButton);
  composer.insertBefore(speaker, sendButton);
  composer.insertBefore(mic, sendButton);

  // Voice status
  const status = document.createElement("div");
  status.id = "voice-status";
  status.className = "voice-status";

  composer.parentElement.insertBefore(
    status,
    composer.nextSibling
  );

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    mic.disabled = true;
    status.textContent =
      "Voice input is not supported in this browser. Use Chrome or Edge.";
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listening = true;
      finalTranscript = "";
      mic.classList.add("recording");
      mic.textContent = "⏹️";
      status.textContent = "Listening... Speak now";
    };

    recognition.onresult = event => {
      let interim = "";
      finalTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const words = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += words + " ";
        } else {
          interim += words;
        }
      }

      input.value = (finalTranscript + interim).trim();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    recognition.onerror = event => {
      status.textContent =
        event.error === "not-allowed"
          ? "Microphone permission denied. Allow microphone access."
          : "Voice error: " + event.error;
    };

    recognition.onend = () => {
      listening = false;
      mic.classList.remove("recording");
      mic.textContent = "🎤";

      if (finalTranscript.trim()) {
        input.value = finalTranscript.trim();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        status.textContent = "Sending your voice message...";
        sendButton.click();
      } else {
        status.textContent = "Voice input stopped.";
      }
    };

    mic.addEventListener("click", () => {
      if (listening) {
        recognition.stop();
        return;
      }

      recognition.lang = language.value;

      try {
        recognition.start();
      } catch (error) {
        status.textContent = "Could not start microphone: " + error.message;
      }
    });
  }

  // Text to speech
  function speak(text) {
    if (!voiceOutputEnabled || !("speechSynthesis" in window)) return;

    const cleanText = text
      .replace(/```[\s\S]*?```/g, " Code block omitted. ")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*#`]/g, "")
      .trim();

    if (!cleanText) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    const isHindi = /[\u0900-\u097F]/.test(cleanText);
    utterance.lang = isHindi ? "hi-IN" : "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.toLowerCase().startsWith(isHindi ? "hi" : "en")
    );

    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  speaker.addEventListener("click", () => {
    voiceOutputEnabled = !voiceOutputEnabled;

    localStorage.setItem(
      "my_ai_voice_output",
      String(voiceOutputEnabled)
    );

    updateSpeaker();

    if (!voiceOutputEnabled) {
      window.speechSynthesis.cancel();
      status.textContent = "Voice replies turned off.";
    } else {
      status.textContent = "Voice replies turned on.";
    }
  });

  // Automatically speak new AI responses
  const chatBox = document.getElementById("chat-box");

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("message") &&
          node.classList.contains("assistant") &&
          !node.classList.contains("pending") &&
          !node.classList.contains("error")
        ) {
          speak(node.innerText || node.textContent || "");
        }
      }
    }
  });

  observer.observe(chatBox, { childList: true });

  window.myAIStopVoice = () => {
    window.speechSynthesis?.cancel();
    if (listening) recognition?.stop();
  };

  window.myAISpeak = speak;

})();
