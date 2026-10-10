<div align="center">
  <img src="./frontend/public/icon.png" width="100" height="100" alt="PurposeCanvas Logo" />
  <h1>PurposeCanvas</h1>
  <p><strong>Purpose-Aware Image Generation Gateway for Schools</strong></p>
  <p><em>Built for Generative AI - PS1: Resource-Aware Image Generation</em></p>
</div>

<br/>

## 🏆 The Problem
A district education office rolled out an AI image generator to 300 schools. The cloud compute bill tripled in the first month. 

The core issue? **The tool never asked what the picture was for.** 
Teachers generating simple line-art coloring pages for 4-year-olds were unknowingly triggering massive 1024px, 25-step image generations using heavy models, consuming massive amounts of VRAM and energy.

## 💡 The Solution: PurposeCanvas
PurposeCanvas is a smart proxy/gateway that sits between the user and the image generation pipelines. It intercepts prompts, infers the true purpose of the image, and dynamically routes the request to the most resource-efficient model and settings.

By routing simple tasks (like flashcards and outlines) to a 512px **SD-Turbo** model (2-4 steps) and reserving the massive 12GB **SDXL** model (15-25 steps) strictly for high-fidelity classroom posters, PurposeCanvas reduces total GPU compute time and Energy usage by **up to 98%**.

---

## 🎯 How We Solved The Constraints

### Constraint 1: Honest Cost & Energy Calculation
> *"Every generation must display its estimated cost (compute time, energy) alongside the saving compared with the maximum setting. Teams must explain how the estimate is calculated."*

**Our Implementation:**
We don't use arbitrary math. We use live system telemetry.
1. **Live Compute Time**: The backend uses Python's `time.perf_counter()` wrapping the PyTorch generation execution to get millisecond-accurate GPU processing time.
2. **Live Energy Measurement**: The backend queries NVIDIA NVML (`pynvml.nvmlDeviceGetPowerUsage()`) during generation to measure actual Wattage, calculating Watt-hours (Wh) via `(Average Watts × GPU_seconds) / 3600`.
3. **Transparent UI**: Every generated image displays the exact compute seconds and `% Saved` vs the unoptimized baseline (SDXL 25-step). We built a dedicated **Formula Breakdown** dropdown that explains the exact math to the user directly in the UI.

### Constraint 2: Purpose Inference & Override
> *"The purpose must be inferred, not only selected from a menu. The system must propose a tier automatically from the user's request, explain why, and allow the user to override it."*

**Our Implementation:**
1. **LLM Smart Classification**: We use the Groq LLaMA/Gemini API to analyze the prompt. It returns a structured JSON schema identifying the `intent` (e.g., outline, worksheet) and extracts the specific **Signal Words** that influenced the decision.
2. **"Why the AI Chose This"**: The UI presents a glowing AI reasoning card explaining the exact rationale and the signal words it detected.
3. **Tier Ladder & Override**: The system presents a tier ladder (Draft, Standard, Quality) and automatically selects the most resource-efficient one. The user is clearly notified of the AI's choice via a badge, and can easily click a different tier to override the AI.

---

## 🚀 The 5-Stage "Under 3-Second" Pipeline

1. **🧠 Intent + RAG (Groq LLM)**: Classifies the prompt (Outline, Flashcard, Worksheet, Poster) and engineers a specialized prompt.
2. **⚡ Vector Cache (FAISS)**: Performs cosine similarity against past generations. If a teacher asks for a similar image, it serves the cached image instantly (0 GPU seconds).
3. **🎯 Smart Routing**: Selects the absolute lowest Profile (model, resolution, steps) that satisfies the inferred purpose.
4. **🖼️ Generation (SD-Turbo / SDXL)**: Executes the generation. To prevent VRAM crashes, models are dynamically loaded and offloaded to CPU as needed.
5. **✅ Quality Gate (OpenCV)**: Analyzes the resulting image (e.g., checking black/white ratio for outlines). If it fails, it automatically escalates to the next quality tier and regenerates.

---

## 🛠️ Architecture Stack
- **Frontend**: Next.js (App Router), TailwindCSS, Framer Motion, shadcn/ui.
- **Backend**: FastAPI (Python), PyTorch, HuggingFace Diffusers.
- **LLM/Intent**: Groq API.
- **Database/Cache**: SQLite (Analytics), FAISS (Vector Cache).
- **Models**: `stabilityai/sd-turbo` (Fast), `stabilityai/stable-diffusion-xl-base-1.0` (High Quality).

---

## 💻 Local Setup Instructions

### 1. Prerequisites
- NVIDIA GPU (Recommended: 8GB+ VRAM for SDXL offloading)
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run the FastAPI server
python -m uvicorn backend.main:app --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Running the App
Navigate to `http://localhost:3000` in your browser. The models (SD-Turbo and SDXL) will download automatically from HuggingFace upon first use.
