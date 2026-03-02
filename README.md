---

# Ekko: AI-Powered Movie/Tv-Show Recommender

Welcome to **Ekko**! This guide will walk you through setting up the AI engine backend and the Next.js frontend to get your personalized movie recommendation system up and running.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

* **Python 3.14** (For the backend AI server)
* **Node.js** (For the frontend web app)

---

## Step 1: Download the Repository & Artifacts

1. **Clone or Donwload the repository** from GitHub and place it in a short, non-spaced directory path on your machine to avoid path-resolution issues.
2. **Download the required AI artifacts** (like models and embeddings) from this [Google Drive Link](https://drive.google.com/drive/folders/1b3Td6bobTzKWGB7Y2kJ8iyKo1M4qgHK6?usp=sharing).
3. **Download the 2 CSV Files** (MetaData:`400k_Basic_genome_movielens_keywords.csv` And Rating files:`merged_users_ratings.csv`) only if u want to work on the colab notebooks (starting form #01 notebook) from this [Google Drive Link](https://drive.google.com/drive/folders/1zlsN5W2oABCf2odlC37iWASwhG8Dh83Y?usp=sharing). (Change paths according to your needs)
4. Extract and place the downloaded (Size 1.64GB) `ekko_artifacts` into your local project so it matches the **Project Structure** outlined at the bottom of this guide.

---

## Step 2: Set Up the Backend (FastAPI + AI Engine)

The backend handles the AI models, crunching the math, and connecting to the SQLite database.

### 1. Initialize the Environment

Open your terminal or VS Code command prompt and navigate to the backend folder:

```bash
cd backend

```

Create and activate a virtual environment to keep your dependencies isolated:

```bash
# Create the virtual environment
python -m venv venv

# Activate it (Windows)
.\venv\Scripts\activate

```

### 2. Install Dependencies & Models

Install the required Python packages:

```bash
pip install -r requirements.txt

```

Next, download the `all-mpnet-base-v2` model for faster, offline local processing. Run the script and wait for it to finish (re-run if it fails):

```bash
python download_mpnet_model.py

```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` folder and configure your keys (You'll need a Google Gemini API key for the AI Search feature):

```env
# EKKO BACKEND CONFIG

# Security
SECRET_KEY=ekko_is_my_champ

# External APIs
GOOGLE_API_KEY=#####################################

```

### 4. For VS CODE

Create a `.vscode` folder beside the `backend` folder and create `settings.json` file and add these lines to it

```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore"
}

```

### 5. Start the Server

Boot up the FastAPI server:

```bash
uvicorn main:app --reload --port 8000

```

*Wait until you see the message: **"SYSTEM READY. Serving 428167 movies"**.*

---

## Step 3: Set Up the Frontend (Next.js)

### 1. Initialize Next.js

Open a **new** terminal window (keep the backend running) and navigate to your `frontend` directory.
*Note: The folder must be empty to run the `create-next-app` command successfully. Temporarily move existing downloaded frontend files out, run the command, and then move them back in (overwriting as needed).*

```bash
cd frontend
npx create-next-app@latest . 

```

* Press `y` to confirm.
* Select the **recommended defaults** when prompted.

### 2. Install Packages

install the required UI and utility dependencies:

```bash
npm install axios framer-motion lucide-react zustand clsx tailwind-merge
npm install -D tailwindcss@3.4.17 postcss@8 autoprefixer@10
npm audit fix

```
Once initialized, move your original Ekko frontend files back into the folder.

### 3. Configure Environment Variables

Edit the file `.env.local` file in the same folder as your `package.json`. You will need a TMDB API key to fetch movie posters.

```env
NEXT_PUBLIC_TMDB_API_KEY=#################################
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 4. Start the Web App

Ensure your `app` folder is correctly placed inside the `src` folder, then start the development server:

```bash
npm run dev

```

*(If you run into issues, try running `npm audit fix` and then `npm run dev` again).*

---

## Step 4: Boot It Up!

1. Open your browser and navigate to **`http://localhost:3000`**. You should see the Ekko landing page.
2. **Create an Account / Sign Up:** This will initialize your personal SQLite database entry.
3. **The Cold Start:** The AI doesn't know you yet! Rate 3 to 5 movies you love to get started.
4. **Enjoy the Magic:** Watch the `% Match Badges` light up across the app as our LightGBM model calculates your exact movie match probabilities in real-time!

---

## Troubleshooting

| Issue | Solution |
| --- | --- |
| **0% Matches Everywhere** | You are currently a "Baby User." Rate a few more movies or use CSV Importer to improve your Profile. |
| **Missing Posters** | Ensure your TMDB API key is valid and correctly placed in `.env.local`. |

---

## Expected Project Structure

Verify your files match this layout before running the application:

```text
├── .vscode
│   └── settings.json
├── backend
│   ├── data
│   │   ├── models
│   │   │   ├── lightgbm_model.joblib
│   │   │   ├── svd_item_factors.npy
│   │   │   └── tconst_map.joblib
│   │   ├── notebooks
│   │   │   ├── 01_data_preparation.ipynb
│   │   │   ├── 02_generating_embeddings.ipynb
│   │   │   ├── 03_vip_generation.ipynb
│   │   │   └── 04_train_classifier.ipynb
│   │   ├── ai_embeddings.npy
│   │   ├── metadata_enriched.parquet
│   │   ├── parquet_viewer.py
│   │   ├── ratings_labeled.parquet
│   │   ├── vip_list.csv
│   │   └── vip_llama_ai_tags.json
│   ├── local_mpnet_model
│   │   ├── 1_Pooling
│   │   │   └── config.json
│   │   ├── config_sentence_transformers.json
│   │   ├── config.json
│   │   ├── model.safetensors
│   │   ├── modules.json
│   │   ├── README.md
│   │   ├── sentence_bert_config.json
│   │   ├── special_tokens_map.json
│   │   ├── tokenizer_config.json
│   │   ├── tokenizer.json
│   │   └── vocab.txt
│   ├── auth.py
│   ├── brain.py
│   ├── check_models.py
│   ├── database.py
│   ├── download_clean_model.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   └── schemas.py
├── frontend
│    ├── src
│    │   ├── app
│    │   │   ├── favicon.ico
│    │   │   ├── globals.css
│    │   │   ├── layout.tsx
│    │   │   └── page.tsx
│    │   ├── components
│    │   │   ├── AISearchModal.tsx
│    │   │   ├── AuthForm.tsx
│    │   │   ├── Dashboard.tsx
│    │   │   ├── ExplorationRows.tsx
│    │   │   ├── GenreBar.tsx
│    │   │   ├── GlobalSearch.tsx
│    │   │   ├── GuestDashboard.tsx
│    │   │   ├── Importer.tsx
│    │   │   ├── LoadingScreen.tsx
│    │   │   ├── MovieModal.tsx
│    │   │   ├── Onboarding.tsx
│    │   │   ├── PersonModal.tsx
│    │   │   ├── SimilarRow.tsx
│    │   │   ├── UserProfile.tsx
│    │   │   └── WatchlistDrawer.tsx
│    │   ├── lib
│    │   │   ├── api.ts
│    │   │   └── tmdb.ts
│    │   └── store
│    │       └── authStore.ts
│    ├── .env.local
│    ├── eslint.config.mjs
│    ├── next-env.d.ts
│    ├── next.config.ts
│    ├── package.json
│    ├── postcss.config.mjs
│    ├── README.md
│    ├── tailwind.config.ts
│    └── tsconfig.json
└── README.md


```


---

