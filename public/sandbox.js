const sandbox = (() => {
  const textarea = document.getElementById("sandbox-code");
  const output = document.getElementById("sandbox-output");
  const status = document.getElementById("sandbox-status");
  const runButton = document.getElementById("sandbox-run");
  const resetButton = document.getElementById("sandbox-reset");
  const snippetButtons = Array.from(document.querySelectorAll("[data-snippet]"));

  const samples = {
    hello: `.needs <std>
// Basic hello world that proves the plumbing works.
import {print} from "String" under str;

fn main() -> int {
    str.print("Hello from the sandbox!");
    return 0;
};`,
    dice: `.needs <std>
// Use the math Random helper to roll a six-sided die.
import Random from "math";
import {print} from "String" under str;

fn main() -> int {
    Random rng = new Random();
    const int roll = rng.nextInt(6) + 1;
    str.print(\`You rolled a {roll}!\`);
    return 0;
};`,
    error: `.needs <std>
// Demonstrates how a panic surfaces as a sandbox failure.
import {print} from "String" under str;

fn main() -> int {
    str.print("About to panic...");
    panic("boom");
};`,
    bubble: `.needs <std>
// Bubble operator sample: devide() returns Error which short-circuits callers.

import { openFile, createFile } from "files" under fs;
import result from "Utils/result";
import {accept, reject, resultWrapper} from "Utils/result" under res;
import {print} from "String" under str;
import string from "String";
import Error from "Utils/Error";

fn devide(int a, int b) -> int! {
    if b == 0 return new Error("Cannot Devide by 0");
    return a / b;
};

fn ratioOfParts(int total, int partitions, int chunks) -> int! {
    let perPartition = devide(total, partitions)!;

    let perChunk = devide(perPartition, chunks)!;
    return perChunk;
};

fn showCase(int total, int partitions, int chunks, string label) {
    match ratioOfParts(total, partitions, chunks) {
        Ok(val) => str.print(\`{label} succeeded: {val}\\n\`),
        Err(e) => str.print(\`{label} failed: {e}\\n\`)
    };
};

fn main() {
    // This run hits the divide-by-zero Error and bubbles it to showCase.
    showCase(10, 0, 2, "Zero partitions");
    // This run succeeds and proves the happy-path output.
    showCase(10, 5, 2, "Even split");
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
