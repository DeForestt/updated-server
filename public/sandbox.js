const sandbox = (() => {
  const textarea = document.getElementById("sandbox-code");
  const output = document.getElementById("sandbox-output");
  const status = document.getElementById("sandbox-status");
  const runButton = document.getElementById("sandbox-run");
  const resetButton = document.getElementById("sandbox-reset");
  const snippetButtons = Array.from(document.querySelectorAll("[data-snippet]"));
  const readiness = document.getElementById("sandbox-readiness");
  const readinessTitle = document.getElementById("sandbox-readiness-title");
  const readinessDetail = document.getElementById("sandbox-readiness-detail");
  let sandboxReady = false;

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
};`,
    jsonround: `.needs <std>
import string from "String";
import unordered_map from "Collections/unordered_map";
import { print } from "String" under str;
import vector from "Collections/Vector";
import option from "Utils/option";
import {Some, None, optionWrapper}from "Utils/option" under opt;
import result from "Utils/result";
import {accept, reject}from "Utils/result" under res;
import Box from "Memory";
import {wrap}from "Memory" under box;
import JSON from "JSON";
import {parse}from "JSON/Parse" under parser;
import {Object, String, Number, Boolean, List}from "JSON" under json;
import {wrap}from "Memory" under box;
import {make_tuple}from "Collections/Tuple" under tup;

fn show_roundtrip(string source) -> bool {
    str.print("---Parsing roundtrip---\\n");
    let __roundtrip_unused = match parser.parse(source) {
        Ok(v) => {
            str.print(\`Parsed JSON object:\\n{v.stringify()}\\n\`);
            true;
        },
        Err(e) => {
            str.print(\`Failed to parse sample JSON: {e}\\n\`);
            false;
        },
    };
    return true;
};

fn show_error_sample() -> bool {
    str.print("---Checking error handling---\\n");
    let broken = "{\\"student\\":{\\"name\\":\\"Jane\\",\\"grade\\":\\"A+\\",\\"classes\\":[\\"Math\\",\\"Science\\",{\\"name\\":\\"History\\"]},\\"advisor\\":{\\"name\\":\\"Dr. Smith\\",\\"office\\":{\\"building\\":\\"North\\"}}"; // deeply nested object missing braces/comma
    let __error_unused = match parser.parse(broken) {
        Ok(_) => {
            str.print("Unexpectedly parsed invalid JSON\\n");
            false;
        },
        Err(e) => {
            str.print(\`Expected failure: {e}\\n\`);
            true;
        },
    };
    return true;
};

fn main () -> int {
    let assignments = new vector::<Box::<JSON>>();
    assignments.push_back(box.wrap(json.String("Math Assignment")));
    assignments.push_back(box.wrap(json.String("Science Project")));
    assignments.push_back(box.wrap(json.String("History Essay")));
    let meta = json.Object({
        "author": box.wrap(json.String("John Doe")),
        "version": box.wrap(json.String("1.0.0")),
        "date": box.wrap(json.String("2023-10-01")),
        "extra": box.wrap(json.String("Excellent performance!")),
    });
    let obj = json.Object({
        "name": box.wrap(json.String("Jane")),
        "age": box.wrap(json.Number(42)),
        "grade": box.wrap(json.String("A+")),
        "seat": box.wrap(json.Number(12)),
        "meta": box.wrap(meta),
        "work": box.wrap(json.List(assignments)),
    });
    let obj_str = obj.stringify(1);
    str.print(\`{obj_str}\\n\\n\\n\`);
    show_roundtrip(obj.stringify());
    show_error_sample();
    return 0;
};`
  };

  const setStatus = (label, tone) => {
    if (!status) return;
    status.textContent = label;
    status.dataset.tone = tone;
  };

  const normalizeOutput = (value) => {
    if (value == null || value === "") return "(no output)";
    const text = typeof value === "string" ? value : String(value);

    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\n/g, "\n");
  };

  const setOutput = (text) => {
    if (!output) return;
    output.textContent = normalizeOutput(text);
  };

  const setControlsLocked = (locked) => {
    if (textarea) textarea.disabled = locked;
    if (runButton) runButton.disabled = locked;
    if (resetButton) resetButton.disabled = locked;
    snippetButtons.forEach((btn) => {
      btn.disabled = locked;
    });
  };

  const setReadiness = (ready, detail, tone = "pending") => {
    sandboxReady = ready;
    if (readiness) {
      readiness.dataset.ready = ready ? "true" : "false";
      readiness.dataset.tone = tone;
    }
    if (readinessTitle) {
      readinessTitle.textContent = ready ? "Sandbox ready" : "Preparing sandbox";
    }
    if (readinessDetail) readinessDetail.textContent = detail;
    setControlsLocked(!ready);
  };

  const resetSample = () => {
    if (!textarea) return;
    textarea.value = samples.hello;
    setStatus("Sample loaded", "info");
    setOutput('Click "Run code" to see stdout...');
  };

  const buildSandboxPayload = (source) => ({
    schema: "sandbox.v1",
    src: source,
  });

  const readResponsePayload = async (response) => {
    const contentType = response.headers?.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        if (data && typeof data === "object") {
          if (typeof data.stdout === "string") return data.stdout;
          if (typeof data.output === "string") return data.output;
          if (typeof data.error === "string") return data.error;
          return JSON.stringify(data, null, 2);
        }
      } catch (err) {
        console.warn("Failed to parse JSON response", err);
      }
    }
    return response.text();
  };

  const run = async () => {
    if (!textarea || !runButton) return;
    if (!sandboxReady) {
      setStatus("Preparing", "pending");
      setOutput("The Docker sandbox image is still loading. Try again once it is ready.");
      return;
    }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSandboxPayload(source))
      });

      const text = await readResponsePayload(response);
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

  const pollReadiness = async () => {
    try {
      const response = await fetch("/sandbox/ready", { headers: { "Accept": "application/json" } });
      const data = await response.json();
      const image = data && typeof data.image === "string" ? data.image : "sandbox image";
      const state = data && typeof data.status === "string" ? data.status : "preparing";

      if (data && data.ready === true) {
        setReadiness(true, `${image} is available.`, "success");
        setStatus("Ready", "success");
        return;
      }

      if (state === "error") {
        setReadiness(false, `${image} could not be prepared.`, "error");
        setStatus("Unavailable", "error");
        window.setTimeout(pollReadiness, 5000);
        return;
      }

      setReadiness(false, `${image} is still loading.`, "pending");
      setStatus("Preparing", "pending");
      window.setTimeout(pollReadiness, 2000);
    } catch (err) {
      console.warn("Failed to check sandbox readiness", err);
      setReadiness(false, "Unable to check sandbox readiness.", "error");
      setStatus("Checking", "pending");
      window.setTimeout(pollReadiness, 5000);
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

  setReadiness(false, "Checking Docker image readiness...", "pending");
  resetSample();
  pollReadiness();
})();
