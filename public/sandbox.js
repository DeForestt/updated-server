const sandbox = (() => {
  const textarea = document.getElementById("sandbox-code");
  const output = document.getElementById("sandbox-output");
  const status = document.getElementById("sandbox-status");
  const runButton = document.getElementById("sandbox-run");
  const resetButton = document.getElementById("sandbox-reset");
  const snippetButtons = Array.from(document.querySelectorAll("[data-snippet]"));

  const samples = {
    hello: `.needs <std>
import {print} from "String" under str;

fn main() -> int {
    str.print("Hello from the sandbox!\n");
    return 0;
};`,
    dice: `.needs <std>
import Random from "math";
import {print} from "String" under str;

fn main() -> int {
    Random rng = new Random();
    const int roll = rng.nextInt(6) + 1;
    str.print(\`You rolled a {roll}!\n\`);
    return 0;
};`,
    error: `.needs <std>
import {print} from "String" under str;

fn main() -> int {
    str.print("About to panic...\n");
    panic("boom");
};`
  };

  const setStatus = (label, tone) => {
    if (!status) return;
    status.textContent = label;
    status.dataset.tone = tone;
  };

  const setOutput = (text) => {
    if (!output) return;
    output.textContent = text || "(no output)";
  };

  const resetSample = () => {
    if (!textarea) return;
    textarea.value = samples.hello;
    setStatus("Sample loaded", "info");
    setOutput('Click "Run code" to see stdout...');
  };

  const run = async () => {
    if (!textarea || !runButton) return;
    const source = textarea.value.trim();
    if (!source) {
      setStatus("Enter code first", "error");
      setOutput("No AFlat source provided.");
      return;
    }

    try {
      runButton.disabled = true;
      setStatus("Running...", "pending");
      setOutput("Building project inside Docker...");

      const response = await fetch("/sandbox/run", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: source
      });

      const text = await response.text();
      if (response.ok) {
        setStatus("Completed", "success");
        setOutput(text);
      } else {
        setStatus("Failed", "error");
        setOutput(text || "Sandbox run failed.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error", "error");
      setOutput("Unable to reach the sandbox endpoint.");
    } finally {
      if (runButton) runButton.disabled = false;
    }
  };

  if (snippetButtons.length && textarea) {
    snippetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.snippet;
        if (key && samples[key]) {
          textarea.value = samples[key];
          setStatus(`Loaded ${btn.textContent}`, "info");
          setOutput("Ready to run.");
        }
      });
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetSample);
  }

  if (runButton) {
    runButton.addEventListener("click", (event) => {
      console.log("running sandbox");
      event.preventDefault();
      run();
    });
  }

  resetSample();
})();
